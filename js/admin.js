/* ==========================================================
   ADMIN.JS - PANEL DE ADMINISTRACIÓN CON RESERVA MANUAL
   La Arboleda Club - Tacna, Perú
   ========================================================== */

import {
  db,
  auth,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Timestamp,
  serverTimestamp
} from './firebase-config.js';

import {
  ROLES_DEFINIDOS,
  verificarPermiso,
  obtenerPermisosUsuario,
  obtenerUsuariosAdmin,
  obtenerUsuarioAdminPorUid,
  registrarAuditoria,
  registrarAcceso,
  registrarAccesoDenegado,
  registrarAccionExitosa
} from './roles-permisos.js';

// ==========================================================
// VARIABLES GLOBALES
// ==========================================================

// Usuario actual y rol
let usuarioActual = null;
let usuarioAdminData = null;
let permisos = [];

let reservasData = [];
let reservasFiltradas = [];
let reservaSeleccionada = null;
let unsubscribeReservas = null;

// Variables para gestión de carta
let platosData = [];
let platosFiltrados = [];
let estadosPlatosData = {};
let etiquetasData = {};
let platoSeleccionado = null;

// Variables para gestión de usuarios y auditoría
let usuariosAdminData = [];
let auditData = [];
let auditFiltrada = [];

// ==========================================================
// INICIALIZACIÓN
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacion();
  inicializarEventos();
});

async function verificarAutenticacion() {
  onAuthStateChanged(auth, async (usuario) => {
    if (usuario) {
      usuarioActual = usuario;

      // Obtener datos de usuario admin
      usuarioAdminData = await obtenerUsuarioAdminPorUid(usuario.uid);

      if (!usuarioAdminData) {
        // Usuario no tiene rol asignado - Implementar mecanismo bootstrap
        console.log('Usuario sin rol asignado. Verificando si es el primer admin...');

        const adminsExisten = await verificarSiExistenAdmins();

        if (!adminsExisten) {
          // No hay admins en la base de datos - Crear este usuario como super_admin
          console.log('No hay admins. Auto-creando usuario como super_admin...');
          await crearPrimerAdmin(usuario);

          // Recargar datos del usuario después de crearlo
          usuarioAdminData = await obtenerUsuarioAdminPorUid(usuario.uid);

          // Verificar que se cargó correctamente
          if (!usuarioAdminData) {
            console.error('Error: No se pudo cargar el usuario creado');
            cerrarSesion();
            mostrarToast('Error al configurar la cuenta. Por favor intenta nuevamente');
            return;
          }
        } else {
          // Otros admins existen pero este usuario no es admin
          console.error('Usuario no autorizado como admin');
          cerrarSesion();
          mostrarToast('Tu cuenta no tiene permisos de administrador');
          return;
        }
      }

      // Obtener permisos del usuario
      permisos = obtenerPermisosUsuario(usuarioAdminData);

      // Registrar acceso
      await registrarAcceso(usuario.uid);

      mostrarPanel();
      document.getElementById('usuarioActual').textContent = `${usuarioAdminData.nombre} (${ROLES_DEFINIDOS[usuarioAdminData.rol].nombre})`;

      // Proteger pestañas según permisos
      protegerPestanas();

      // Inicializar listeners
      inicializarListenerReservas();
      inicializarEventosRoles();

    } else {
      mostrarLogin();
    }
  });
}

function mostrarLogin() {
  document.getElementById('pantallaLogin').classList.remove('oculto');
  document.getElementById('panelPrincipal').classList.add('oculto');
}

function mostrarPanel() {
  document.getElementById('pantallaLogin').classList.add('oculto');
  document.getElementById('panelPrincipal').classList.remove('oculto');
}

// ==========================================================
// MECANISMO BOOTSTRAP - PRIMER ADMIN
// ==========================================================

/**
 * Verifica si existen usuarios admin en la base de datos
 * @returns {boolean} true si hay al menos un admin, false si no hay ninguno
 */
async function verificarSiExistenAdmins() {
  try {
    const admins = await obtenerUsuariosAdmin();
    return admins && admins.length > 0;
  } catch (error) {
    console.error('Error al verificar admins:', error);
    return true; // Si hay error, asumir que existen admins por seguridad
  }
}

/**
 * Crea el primer usuario admin como super_admin
 * Este mecanismo permite que el primer usuario que se autentique
 * pueda acceder al sistema sin necesidad de crear usuarios manualmente
 * @param {Object} usuario - Objeto de usuario de Firebase Auth
 */
async function crearPrimerAdmin(usuario) {
  try {
    console.log('Iniciando creación del primer admin para UID:', usuario.uid);

    const usuariosRef = collection(db, 'usuarios_admin');
    const docRef = doc(usuariosRef, usuario.uid);

    // Extraer nombre del email o usar email completo
    const nombre = usuario.displayName || usuario.email.split('@')[0];

    const datosAdmin = {
      uid: usuario.uid,
      email: usuario.email,
      nombre: nombre,
      rol: 'super_admin',
      estado: 'activo',
      permisos_custom: {},
      fechaCreacion: serverTimestamp(),
      ultimoAcceso: serverTimestamp(),
      historialAcceso: [{
        fecha: Timestamp.now(),
        tipo: 'LOGIN_BOOTSTRAP'
      }],
      esBootstrap: true
    };

    await setDoc(docRef, datosAdmin);

    console.log('✅ Primer admin creado exitosamente');

    // Registrar en auditoría
    await registrarAuditoria({
      usuario: usuario.email,
      accion: 'SISTEMA_BOOTSTRAP',
      recurso: `usuario:${usuario.uid}`,
      detalles: 'Primer usuario admin creado automáticamente (bootstrap)',
      tipo: 'SISTEMA',
      timestamp: Timestamp.now()
    });

    mostrarToast('✅ Bienvenido! Tu cuenta ha sido configurada como Super Administrador');

    return true;
  } catch (error) {
    console.error('Error al crear primer admin:', error);
    mostrarToast('Error al configurar tu cuenta de administrador');
    return false;
  }
}

// ==========================================================
// AUTENTICACIÓN
// ==========================================================

function inicializarEventos() {
  const formLogin = document.getElementById('formularioLogin');
  if (formLogin) {
    formLogin.onsubmit = (e) => {
      e.preventDefault();
      iniciarSesion();
    };
  }

  const btnCerrarSesion = document.getElementById('btnCerrarSesion');
  if (btnCerrarSesion) {
    btnCerrarSesion.onclick = cerrarSesion;
  }

  // Toggle mostrar/ocultar contraseña
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('passwordAdmin');
  if (togglePassword && passwordInput) {
    togglePassword.onclick = () => {
      const tipo = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = tipo;
      togglePassword.classList.toggle('activo');
    };
  }

  // Validación en tiempo real del email
  const emailInput = document.getElementById('emailAdmin');
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      const valor = emailInput.value.trim();
      if (valor === '') {
        emailInput.classList.remove('valido', 'invalido');
      } else if (validarEmail(valor)) {
        emailInput.classList.remove('invalido');
        emailInput.classList.add('valido');
      } else {
        emailInput.classList.remove('valido');
        emailInput.classList.add('invalido');
      }
    });
  }

  inicializarFiltros();
  inicializarModal();
  inicializarModalConfirmacion();
  inicializarReservaManual();
  inicializarTabs();
  inicializarGestionCarta();
}

// Función para validar email
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Función para mostrar error
function mostrarErrorLogin(mensaje) {
  const errorEl = document.getElementById('errorLogin');
  const errorText = errorEl.querySelector('.error-text');
  if (errorText) {
    errorText.textContent = mensaje;
  }
  errorEl.classList.remove('visible');
  // Forzar reflow para reiniciar animación
  void errorEl.offsetWidth;
  errorEl.classList.add('visible');
}

// Función para ocultar error
function ocultarErrorLogin() {
  const errorEl = document.getElementById('errorLogin');
  errorEl.classList.remove('visible');
}

async function iniciarSesion() {
  const email = document.getElementById('emailAdmin').value.trim();
  const password = document.getElementById('passwordAdmin').value;
  const boton = document.getElementById('btnLogin');

  // Ocultar error previo
  ocultarErrorLogin();

  if (!email || !password) {
    mostrarErrorLogin('Por favor completa todos los campos');
    return;
  }

  if (!validarEmail(email)) {
    mostrarErrorLogin('El correo electrónico no es válido');
    return;
  }

  try {
    // Activar estado de carga
    boton.classList.add('cargando');
    boton.disabled = true;

    await signInWithEmailAndPassword(auth, email, password);
    mostrarToast('Sesión iniciada correctamente');

  } catch (error) {
    console.error('Error de autenticación:', error);

    let mensaje = 'Error al iniciar sesión';
    if (error.code === 'auth/user-not-found') {
      mensaje = 'Usuario no encontrado';
    } else if (error.code === 'auth/wrong-password') {
      mensaje = 'Contraseña incorrecta';
    } else if (error.code === 'auth/invalid-email') {
      mensaje = 'Correo electrónico inválido';
    } else if (error.code === 'auth/too-many-requests') {
      mensaje = 'Demasiados intentos. Intenta más tarde';
    } else if (error.code === 'auth/invalid-credential') {
      mensaje = 'Credenciales inválidas';
    }

    mostrarErrorLogin(mensaje);
  } finally {
    // Desactivar estado de carga
    boton.classList.remove('cargando');
    boton.disabled = false;
  }
}

async function cerrarSesion() {
  try {
    if (unsubscribeReservas) {
      unsubscribeReservas();
    }
    await signOut(auth);
    mostrarToast('Sesión cerrada');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

// ==========================================================
// LISTENER TIEMPO REAL DE RESERVAS
// ==========================================================

function inicializarListenerReservas() {
  const reservasCollection = collection(db, 'reservas');
  const q = query(reservasCollection, orderBy('fechaCreacion', 'desc'));
  
  unsubscribeReservas = onSnapshot(q, (snapshot) => {
    reservasData = [];
    
    snapshot.forEach((documento) => {
      const reserva = documento.data();
      reserva.id = documento.id;
      reservasData.push(reserva);
    });
    
    console.log('📊 Reservas cargadas:', reservasData.length);
    
    actualizarEstadisticas();
    aplicarFiltros();
  }, (error) => {
    console.error('Error al escuchar reservas:', error);
    mostrarToast('Error de conexión con la base de datos');
  });
}

// ==========================================================
// ESTADÍSTICAS
// ==========================================================

function actualizarEstadisticas() {
  const pendientes = reservasData.filter(r => r.estado === 'pendiente').length;
  const reservados = reservasData.filter(r => r.estado === 'reservado').length;
  const cancelados = reservasData.filter(r => r.estado === 'cancelado').length;
  
  document.getElementById('totalPendientes').textContent = pendientes;
  document.getElementById('totalReservados').textContent = reservados;
  document.getElementById('totalCancelados').textContent = cancelados;
  document.getElementById('totalGeneral').textContent = reservasData.length;
}

// ==========================================================
// FILTROS
// ==========================================================

function inicializarFiltros() {
  const filtroFechaInicio = document.getElementById('filtroFechaInicio');
  const filtroFechaFin = document.getElementById('filtroFechaFin');
  const filtroInstalacion = document.getElementById('filtroInstalacion');
  const filtroEstado = document.getElementById('filtroEstado');
  const filtroBusqueda = document.getElementById('filtroBusqueda');
  const btnLimpiar = document.getElementById('btnLimpiarFiltros');
  
  if (filtroFechaInicio) filtroFechaInicio.onchange = aplicarFiltros;
  if (filtroFechaFin) filtroFechaFin.onchange = aplicarFiltros;
  if (filtroInstalacion) filtroInstalacion.onchange = aplicarFiltros;
  if (filtroEstado) filtroEstado.onchange = aplicarFiltros;
  if (filtroBusqueda) filtroBusqueda.oninput = aplicarFiltros;
  if (btnLimpiar) btnLimpiar.onclick = limpiarFiltros;
}

function aplicarFiltros() {
  const fechaInicio = document.getElementById('filtroFechaInicio').value;
  const fechaFin = document.getElementById('filtroFechaFin').value;
  const instalacion = document.getElementById('filtroInstalacion').value;
  const estado = document.getElementById('filtroEstado').value;
  const busqueda = document.getElementById('filtroBusqueda').value.toLowerCase().trim();
  
  reservasFiltradas = reservasData.filter(reserva => {
    if (instalacion && reserva.instalacion !== instalacion) {
      return false;
    }
    
    if (estado && reserva.estado !== estado) {
      return false;
    }
    
    if (fechaInicio) {
      const fechaInicioDate = new Date(fechaInicio);
      const fechaReserva = reserva.fecha.toDate ? reserva.fecha.toDate() : new Date(reserva.fecha);
      if (fechaReserva < fechaInicioDate) {
        return false;
      }
    }
    
    if (fechaFin) {
      const fechaFinDate = new Date(fechaFin);
      fechaFinDate.setHours(23, 59, 59, 999);
      const fechaReserva = reserva.fecha.toDate ? reserva.fecha.toDate() : new Date(reserva.fecha);
      if (fechaReserva > fechaFinDate) {
        return false;
      }
    }
    
    if (busqueda) {
      const nombreSocio = reserva.socio?.nombre?.toLowerCase() || '';
      const telefonoSocio = reserva.socio?.telefono?.toLowerCase() || '';
      const numeroSocio = reserva.socio?.numero?.toLowerCase() || '';
      const observaciones = reserva.observaciones?.toLowerCase() || '';
      const subInstalacion = reserva.subInstalacion?.toLowerCase() || '';
      
      const coincide = nombreSocio.includes(busqueda) ||
                       telefonoSocio.includes(busqueda) ||
                       numeroSocio.includes(busqueda) ||
                       observaciones.includes(busqueda) ||
                       subInstalacion.includes(busqueda);
      
      if (!coincide) return false;
    }
    
    return true;
  });
  
  renderizarReservas();
}

function limpiarFiltros() {
  document.getElementById('filtroFechaInicio').value = '';
  document.getElementById('filtroFechaFin').value = '';
  document.getElementById('filtroInstalacion').value = '';
  document.getElementById('filtroEstado').value = '';
  document.getElementById('filtroBusqueda').value = '';
  
  aplicarFiltros();
  mostrarToast('Filtros limpiados');
}

// ==========================================================
// RENDERIZAR LISTA DE RESERVAS
// ==========================================================

function renderizarReservas() {
  const contenedor = document.getElementById('listaReservas');
  const sinResultados = document.getElementById('sinResultados');
  const contador = document.getElementById('contadorResultados');
  
  if (!contenedor) return;
  
  contador.textContent = `${reservasFiltradas.length} resultado${reservasFiltradas.length !== 1 ? 's' : ''}`;
  
  if (reservasFiltradas.length === 0) {
    contenedor.innerHTML = '';
    sinResultados.classList.remove('oculto');
    return;
  }
  
  sinResultados.classList.add('oculto');
  
  let html = '';
  
  reservasFiltradas.forEach(reserva => {
    const fecha = reserva.fecha.toDate ? reserva.fecha.toDate() : new Date(reserva.fecha);
    const fechaFormateada = formatearFecha(fecha);
    const nombreSocio = reserva.socio?.nombre || 'Sin nombre';
    const telefono = reserva.socio?.telefono || 'Sin teléfono';
    const subInstalacion = formatearNombreInstalacion(reserva.subInstalacion);
    const estado = reserva.estado || 'pendiente';
    const esManual = reserva.socio?.tipo === 'manual' || reserva.socio?.numero === 'MANUAL';
    
    html += `
      <div class="tarjeta-reserva-admin" data-id="${reserva.id}">
        <div class="reserva-info-principal">
          <div class="reserva-instalacion">
            <span class="nombre-instalacion">${subInstalacion}</span>
            <span class="badge-estado ${estado}">${capitalizarTexto(estado)}</span>
            ${esManual ? '<span class="badge-manual">MANUAL</span>' : ''}
          </div>
          <div class="reserva-fecha">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            ${fechaFormateada}
          </div>
          <div class="reserva-horario">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${reserva.horario}
          </div>
        </div>
        <div class="reserva-info-socio">
          <div class="socio-nombre">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            ${nombreSocio}
          </div>
          <div class="socio-telefono">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
            ${telefono}
          </div>
          <div class="socio-personas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            ${reserva.personas} personas
          </div>
        </div>
        <button class="boton-ver-detalle" onclick="window.verDetalle('${reserva.id}')">
          Ver Detalle
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    `;
  });
  
  contenedor.innerHTML = html;
}

// ==========================================================
// MODAL DETALLE
// ==========================================================

function inicializarModal() {
  // Botón cerrar del modal de detalle de reserva
  const btnCerrarDetalle = document.getElementById('btnCerrarDetalle');
  if (btnCerrarDetalle) btnCerrarDetalle.onclick = cerrarModalDetalle;

  // Overlay del modal de detalle
  const modalDetalle = document.getElementById('modalDetalle');
  if (modalDetalle) {
    const overlayDetalle = modalDetalle.querySelector('.modal-overlay-admin');
    if (overlayDetalle) overlayDetalle.onclick = cerrarModalDetalle;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarModalDetalle();
      cerrarModalReservaManual();
      cerrarModalEtiquetas();
    }
  });

  document.querySelectorAll('.boton-estado').forEach(btn => {
    btn.onclick = () => {
      const nuevoEstado = btn.getAttribute('data-estado');
      cambiarEstado(nuevoEstado);
    };
  });
}

function verDetalle(reservaId) {
  const reserva = reservasData.find(r => r.id === reservaId);
  if (!reserva) {
    mostrarToast('Reserva no encontrada');
    return;
  }
  
  reservaSeleccionada = reserva;
  
  document.getElementById('detalleId').textContent = `ID: ${reservaId.substring(0, 8)}`;
  document.getElementById('detalleInstalacion').textContent = formatearNombreInstalacion(reserva.subInstalacion);
  
  const fecha = reserva.fecha.toDate ? reserva.fecha.toDate() : new Date(reserva.fecha);
  document.getElementById('detalleFecha').textContent = formatearFechaCompleta(fecha);
  document.getElementById('detalleHorario').textContent = reserva.horario;
  
  let socioTexto = reserva.socio?.nombre || 'Sin nombre';
  if (reserva.socio?.numero && reserva.socio.numero !== 'MANUAL') {
    socioTexto += ` (${reserva.socio.numero})`;
  } else if (reserva.socio?.numero === 'MANUAL') {
    socioTexto += ' [MANUAL]';
  }
  document.getElementById('detalleSocio').textContent = socioTexto;
  document.getElementById('detalleTelefono').textContent = reserva.socio?.telefono || 'No especificado';
  document.getElementById('detallePersonas').textContent = `${reserva.personas} personas`;
  document.getElementById('detalleObservaciones').textContent = reserva.observaciones || 'Sin observaciones';
  
  const estadoActual = document.getElementById('detalleEstadoActual');
  estadoActual.textContent = capitalizarTexto(reserva.estado);
  estadoActual.className = `detalle-valor badge ${reserva.estado}`;
  
  if (reserva.fechaCreacion) {
    const fechaCreacion = reserva.fechaCreacion.toDate ? reserva.fechaCreacion.toDate() : new Date(reserva.fechaCreacion);
    document.getElementById('detalleFechaCreacion').textContent = formatearFechaCompleta(fechaCreacion) + ' ' + formatearHora(fechaCreacion);
  } else {
    document.getElementById('detalleFechaCreacion').textContent = 'No disponible';
  }
  
  document.querySelectorAll('.boton-estado').forEach(btn => {
    btn.classList.remove('activo');
    if (btn.getAttribute('data-estado') === reserva.estado) {
      btn.classList.add('activo');
    }
  });
  
  const btnWhatsAppAdmin = document.getElementById('btnWhatsAppAdmin');
  if (btnWhatsAppAdmin) {
    if (reserva.socio?.telefono) {
      btnWhatsAppAdmin.style.display = 'flex';
      btnWhatsAppAdmin.onclick = () => enviarNotificacionWhatsApp(reserva);
    } else {
      btnWhatsAppAdmin.style.display = 'none';
    }
  }
  
  const modal = document.getElementById('modalDetalle');
  modal.classList.add('activo');
  document.body.style.overflow = 'hidden';
}

function cerrarModalDetalle() {
  const modal = document.getElementById('modalDetalle');
  modal.classList.remove('activo');
  document.body.style.overflow = 'auto';
  reservaSeleccionada = null;
}

// Variable para almacenar el estado pendiente de confirmación
let estadoPendienteConfirmacion = null;

async function cambiarEstado(nuevoEstado) {
  if (!reservaSeleccionada) {
    mostrarToast('No hay reserva seleccionada');
    return;
  }

  // VALIDACIÓN DE PERMISO
  if (!verificarPermiso(usuarioAdminData, 'reservas.cambiar_estado')) {
    await registrarAccesoDenegado(usuarioActual.email, 'cambiar_estado', `reserva:${reservaSeleccionada.id}`);
    mostrarToast('No tienes permiso para cambiar el estado de reservas');
    return;
  }

  if (reservaSeleccionada.estado === nuevoEstado) {
    mostrarToast('La reserva ya tiene este estado');
    return;
  }

  // Mostrar confirmación para estados importantes
  if (nuevoEstado === 'cancelado' || nuevoEstado === 'reservado') {
    mostrarConfirmacionEstado(nuevoEstado);
    return;
  }

  // Para estado pendiente, cambiar directamente
  await ejecutarCambioEstado(nuevoEstado, false);
}

function mostrarConfirmacionEstado(nuevoEstado) {
  estadoPendienteConfirmacion = nuevoEstado;

  const modal = document.getElementById('modalConfirmacion');
  const modalContenido = modal.querySelector('.modal-confirmacion');
  const titulo = document.getElementById('tituloConfirmacion');
  const mensaje = document.getElementById('mensajeConfirmacion');
  const checkbox = document.getElementById('checkNotificarWhatsApp');
  const btnAceptar = document.getElementById('btnAceptarConfirmacion');

  // Configurar según el estado
  if (nuevoEstado === 'cancelado') {
    modalContenido.classList.remove('confirmacion-positiva');
    titulo.textContent = 'Cancelar Reserva';
    mensaje.textContent = `¿Estás seguro de que deseas CANCELAR la reserva de ${reservaSeleccionada.socio?.nombre || 'este socio'}?`;
    btnAceptar.textContent = 'Sí, cancelar';
  } else if (nuevoEstado === 'reservado') {
    modalContenido.classList.add('confirmacion-positiva');
    titulo.textContent = 'Confirmar Reserva';
    mensaje.textContent = `¿Confirmas la reserva de ${reservaSeleccionada.socio?.nombre || 'este socio'}?`;
    btnAceptar.textContent = 'Sí, confirmar';
  }

  // Verificar si hay teléfono para mostrar opción de WhatsApp
  if (reservaSeleccionada.socio?.telefono) {
    checkbox.parentElement.style.display = 'flex';
    checkbox.checked = true;
  } else {
    checkbox.parentElement.style.display = 'none';
    checkbox.checked = false;
  }

  modal.classList.add('activo');
  document.body.style.overflow = 'hidden';
}

function cerrarModalConfirmacion() {
  const modal = document.getElementById('modalConfirmacion');
  modal.classList.remove('activo');
  document.body.style.overflow = 'auto';
  estadoPendienteConfirmacion = null;
}

async function confirmarCambioEstado() {
  if (!estadoPendienteConfirmacion) return;

  const notificar = document.getElementById('checkNotificarWhatsApp').checked;
  await ejecutarCambioEstado(estadoPendienteConfirmacion, notificar);
  cerrarModalConfirmacion();
}

async function ejecutarCambioEstado(nuevoEstado, notificarWhatsApp) {
  try {
    const reservaRef = doc(db, 'reservas', reservaSeleccionada.id);
    await updateDoc(reservaRef, {
      estado: nuevoEstado,
      fechaActualizacion: Timestamp.now()
    });

    const estadoActual = document.getElementById('detalleEstadoActual');
    estadoActual.textContent = capitalizarTexto(nuevoEstado);
    estadoActual.className = `detalle-valor badge ${nuevoEstado}`;

    document.querySelectorAll('.boton-estado').forEach(btn => {
      btn.classList.remove('activo');
      if (btn.getAttribute('data-estado') === nuevoEstado) {
        btn.classList.add('activo');
      }
    });

    reservaSeleccionada.estado = nuevoEstado;

    mostrarToast(`Estado cambiado a: ${capitalizarTexto(nuevoEstado)}`);

    // Enviar notificación por WhatsApp si está habilitado
    if (notificarWhatsApp && reservaSeleccionada.socio?.telefono) {
      setTimeout(() => {
        enviarNotificacionWhatsApp(reservaSeleccionada);
      }, 500);
    }

  } catch (error) {
    console.error('Error al cambiar estado:', error);
    mostrarToast('Error al actualizar el estado');
  }
}

// Inicializar modal de confirmación
function inicializarModalConfirmacion() {
  const btnCancelar = document.getElementById('btnCancelarConfirmacion');
  const btnAceptar = document.getElementById('btnAceptarConfirmacion');
  const overlay = document.querySelector('#modalConfirmacion .modal-overlay-admin');

  if (btnCancelar) btnCancelar.onclick = cerrarModalConfirmacion;
  if (btnAceptar) btnAceptar.onclick = confirmarCambioEstado;
  if (overlay) overlay.onclick = cerrarModalConfirmacion;
}

// ==========================================================
// RESERVA MANUAL
// ==========================================================

function inicializarReservaManual() {
  const btnAbrir = document.getElementById('btnReservaManual');
  const btnCerrar = document.getElementById('btnCerrarReservaManual');
  const btnCancelar = document.getElementById('btnCancelarManual');
  const formulario = document.getElementById('formularioReservaManual');
  
  if (btnAbrir) {
    btnAbrir.onclick = abrirModalReservaManual;
  }
  
  if (btnCerrar) {
    btnCerrar.onclick = cerrarModalReservaManual;
  }
  
  if (btnCancelar) {
    btnCancelar.onclick = cerrarModalReservaManual;
  }
  
  if (formulario) {
    formulario.onsubmit = (e) => {
      e.preventDefault();
      guardarReservaManual();
    };
  }
}

function abrirModalReservaManual() {
  const modal = document.getElementById('modalReservaManual');
  const formulario = document.getElementById('formularioReservaManual');
  
  if (formulario) formulario.reset();
  
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('manualFecha').value = hoy;
  document.getElementById('manualHorario').value = '10:00 AM - 6:00 PM';
  
  if (modal) {
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden';
  }
}

function cerrarModalReservaManual() {
  const modal = document.getElementById('modalReservaManual');
  if (modal) {
    modal.classList.remove('activo');
    document.body.style.overflow = 'auto';
  }
}

async function guardarReservaManual() {
  // VALIDACIÓN DE PERMISO - CREAR RESERVAS
  if (!verificarPermiso(usuarioAdminData, 'reservas.crear')) {
    await registrarAccesoDenegado(usuarioActual.email, 'crear_reserva_manual', 'reserva:nueva');
    mostrarToast('No tienes permiso para crear reservas');
    return;
  }

  const instalacion = document.getElementById('manualInstalacion').value;
  const fecha = document.getElementById('manualFecha').value;
  const horario = document.getElementById('manualHorario').value.trim();
  const nombre = document.getElementById('manualNombre').value.trim();
  const telefono = document.getElementById('manualTelefono').value.trim();
  const personas = document.getElementById('manualPersonas').value;
  const estado = document.getElementById('manualEstado').value;
  const observaciones = document.getElementById('manualObservaciones').value.trim();

  if (!instalacion || !fecha || !nombre || !telefono || !personas) {
    mostrarToast('Completa todos los campos obligatorios');
    return;
  }

  let tipoInstalacion = 'parrillas';
  if (instalacion.startsWith('tenis')) tipoInstalacion = 'tenis';
  else if (instalacion.startsWith('fronton')) tipoInstalacion = 'fronton';
  else if (instalacion === 'mesa-restaurante') tipoInstalacion = 'mesas';

  const reserva = {
    instalacion: tipoInstalacion,
    subInstalacion: instalacion,
    fecha: Timestamp.fromDate(new Date(fecha + 'T12:00:00')),
    horario: horario || '10:00 AM - 6:00 PM',
    socio: {
      nombre: nombre,
      numero: 'MANUAL',
      telefono: telefono,
      tipo: 'manual'
    },
    personas: parseInt(personas),
    observaciones: observaciones ? `[RESERVA MANUAL] ${observaciones}` : '[RESERVA MANUAL]',
    estado: estado,
    fechaCreacion: serverTimestamp(),
    creadoPor: auth.currentUser?.email || 'admin'
  };

  try {
    const btnGuardar = document.querySelector('.boton-guardar-manual');
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    const reservasCollection = collection(db, 'reservas');
    const docRef = await addDoc(reservasCollection, reserva);

    // Registrar en auditoría
    await registrarAccionExitosa(
      usuarioActual.email,
      'crear',
      'reserva',
      docRef.id,
      {
        antes: {},
        despues: {
          instalacion: tipoInstalacion,
          subInstalacion: instalacion,
          socio: nombre,
          personas: personas,
          estado: estado
        }
      }
    );

    cerrarModalReservaManual();
    mostrarToast(`✅ Reserva manual guardada - ID: ${docRef.id.substring(0, 8)}`);

    btnGuardar.disabled = false;
    btnGuardar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      Guardar Reserva
    `;

  } catch (error) {
    console.error('Error al guardar reserva manual:', error);
    mostrarToast('Error al guardar la reserva');

    const btnGuardar = document.querySelector('.boton-guardar-manual');
    btnGuardar.disabled = false;
  }
}

// ==========================================================
// NOTIFICACIÓN POR WHATSAPP
// ==========================================================

function enviarNotificacionWhatsApp(reserva) {
  const telefono = reserva.socio?.telefono;
  if (!telefono) {
    mostrarToast('El socio no tiene teléfono registrado');
    return;
  }
  
  const nombreSocio = reserva.socio?.nombre || 'Estimado socio';
  const instalacion = formatearNombreInstalacion(reserva.subInstalacion);
  const fecha = reserva.fecha.toDate ? reserva.fecha.toDate() : new Date(reserva.fecha);
  const fechaFormateada = formatearFechaCompleta(fecha);
  const estado = reserva.estado;
  
  let mensaje = '';
  
  if (estado === 'reservado') {
    mensaje = `Hola ${nombreSocio}, le confirmamos que su reserva ha sido APROBADA:\n\n`;
    mensaje += `📍 *Instalación:* ${instalacion}\n`;
    mensaje += `📅 *Fecha:* ${fechaFormateada}\n`;
    mensaje += `⏰ *Horario:* ${reserva.horario}\n`;
    mensaje += `👥 *Personas:* ${reserva.personas}\n\n`;
    mensaje += `¡Lo esperamos en La Arboleda Club! 🌳`;
  } else if (estado === 'cancelado') {
    mensaje = `Hola ${nombreSocio}, lamentamos informarle que su reserva ha sido CANCELADA:\n\n`;
    mensaje += `📍 *Instalación:* ${instalacion}\n`;
    mensaje += `📅 *Fecha:* ${fechaFormateada}\n\n`;
    mensaje += `Para más información, contáctenos. Disculpe las molestias.`;
  } else {
    mensaje = `Hola ${nombreSocio}, su reserva está en estado: ${capitalizarTexto(estado)}.\n\n`;
    mensaje += `📍 *Instalación:* ${instalacion}\n`;
    mensaje += `📅 *Fecha:* ${fechaFormateada}\n`;
    mensaje += `⏰ *Horario:* ${reserva.horario}\n\n`;
    mensaje += `Pronto le confirmaremos. Gracias.`;
  }
  
  const numeroLimpio = telefono.replace(/\D/g, '');
  const urlWhatsApp = `https://wa.me/51${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
  window.open(urlWhatsApp, '_blank');
}
// EXPORTACIÓN A EXCEL

function exportarAExcel() {
  if (reservasFiltradas.length === 0) {
    mostrarToast('No hay reservas para exportar');
    return;
  }
  
  mostrarToast('Generando reporte Excel...');
  
  let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Reservas</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table {
          border-collapse: collapse;
          width: 100%;
        }
        th {
          background-color: #0052B4;
          color: white;
          font-weight: bold;
          padding: 12px 8px;
          text-align: center;
          border: 2px solid #003d8a;
          font-size: 12pt;
        }
        td {
          padding: 8px;
          border: 1px solid #ddd;
          text-align: left;
          font-size: 11pt;
        }
        tr:nth-child(even) {
          background-color: #f2f2f2;
        }
        tr:hover {
          background-color: #e8f4f8;
        }
        .estado-pendiente {
          background-color: #fff3cd;
          color: #856404;
          font-weight: bold;
          text-align: center;
        }
        .estado-reservado {
          background-color: #d4edda;
          color: #155724;
          font-weight: bold;
          text-align: center;
        }
        .estado-cancelado {
          background-color: #f8d7da;
          color: #721c24;
          font-weight: bold;
          text-align: center;
        }
        .titulo-reporte {
          font-size: 18pt;
          font-weight: bold;
          color: #0052B4;
          text-align: center;
          padding: 20px;
          background-color: #f8f9fa;
        }
        .subtitulo {
          font-size: 12pt;
          color: #666;
          text-align: center;
          padding-bottom: 15px;
        }
        .resumen {
          margin-top: 30px;
          font-size: 12pt;
        }
        .resumen th {
          background-color: #28a745;
          width: 200px;
        }
        .resumen td {
          font-weight: bold;
          text-align: center;
          font-size: 14pt;
        }
        .numero {
          text-align: center;
        }
        .fecha {
          text-align: center;
          white-space: nowrap;
        }
        .id {
          font-family: monospace;
          text-align: center;
          background-color: #e9ecef;
        }
      </style>
    </head>
    <body>
      <div class="titulo-reporte">
        📊 REPORTE DE RESERVAS - LA ARBOLEDA CLUB
      </div>
      <div class="subtitulo">
        Generado el: ${formatearFechaHoraCompleta(new Date())} | Total: ${reservasFiltradas.length} reservas
      </div>
      
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Fecha Reserva</th>
            <th>Horario</th>
            <th>Instalación</th>
            <th>Estado</th>
            <th>Nombre del Socio</th>
            <th>N° Socio</th>
            <th>Teléfono</th>
            <th>Personas</th>
            <th>Observaciones</th>
            <th>Tipo</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Agregar filas de datos
  reservasFiltradas.forEach(reserva => {
    const fechaReserva = reserva.fecha.toDate ? reserva.fecha.toDate() : new Date(reserva.fecha);
    const fechaCreacion = reserva.fechaCreacion?.toDate ? reserva.fechaCreacion.toDate() : new Date();
    const estado = reserva.estado || 'pendiente';
    const esManual = reserva.socio?.tipo === 'manual' || reserva.socio?.numero === 'MANUAL';
    
    htmlContent += `
          <tr>
            <td class="id">${reserva.id.substring(0, 8).toUpperCase()}</td>
            <td class="fecha">${formatearFechaCorta(fechaReserva)}</td>
            <td class="fecha">${reserva.horario || '-'}</td>
            <td>${formatearNombreInstalacion(reserva.subInstalacion || '')}</td>
            <td class="estado-${estado}">${capitalizarTexto(estado)}</td>
            <td>${escapeHtml(reserva.socio?.nombre || 'Sin nombre')}</td>
            <td class="numero">${reserva.socio?.numero || '-'}</td>
            <td class="numero">${reserva.socio?.telefono || '-'}</td>
            <td class="numero">${reserva.personas || 0}</td>
            <td>${escapeHtml(reserva.observaciones || '-')}</td>
            <td class="numero">${esManual ? '📝 Manual' : '💻 Sistema'}</td>
            <td class="fecha">${formatearFechaCorta(fechaCreacion)}</td>
          </tr>
    `;
  });
  
  htmlContent += `
        </tbody>
      </table>
      
      <table class="resumen">
        <thead>
          <tr>
            <th colspan="2">📈 RESUMEN ESTADÍSTICO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total de Reservas</td>
            <td>${reservasFiltradas.length}</td>
          </tr>
          <tr>
            <td>⏳ Pendientes</td>
            <td>${reservasFiltradas.filter(r => r.estado === 'pendiente').length}</td>
          </tr>
          <tr>
            <td>✅ Reservados (Confirmados)</td>
            <td>${reservasFiltradas.filter(r => r.estado === 'reservado').length}</td>
          </tr>
          <tr>
            <td>❌ Cancelados</td>
            <td>${reservasFiltradas.filter(r => r.estado === 'cancelado').length}</td>
          </tr>
          <tr>
            <td>👥 Total de Personas</td>
            <td>${reservasFiltradas.reduce((sum, r) => sum + (parseInt(r.personas) || 0), 0)}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="margin-top: 30px; font-size: 10pt; color: #888; text-align: center;">
        La Arboleda Club - Av. Celestino Vargas 1820, Tacna, Perú<br>
        Tel: +51 908 881 162 | www.laarboledaclub.com
      </div>
    </body>
    </html>
  `;
  
  // Crear y descargar archivo
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const fechaActual = new Date();
  const nombreArchivo = `Reservas_Arboleda_${fechaActual.getFullYear()}-${String(fechaActual.getMonth() + 1).padStart(2, '0')}-${String(fechaActual.getDate()).padStart(2, '0')}.xls`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', nombreArchivo);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  mostrarToast(`✅ Reporte exportado: ${nombreArchivo}`);
}

// ==========================================================
// FUNCIONES AUXILIARES PARA EXPORTACIÓN
// ==========================================================

function formatearFechaCorta(fecha) {
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function formatearFechaHoraCompleta(fecha) {
  const opciones = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return fecha.toLocaleDateString('es-PE', opciones);
}

function escapeHtml(texto) {
  if (!texto) return '';
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================
// EXPORTAR FUNCIÓN GLOBAL
// ==========================================================

window.exportarAExcel = exportarAExcel;
document.addEventListener('DOMContentLoaded', () => {
  const btnExportar = document.getElementById('btnExportarExcel');
  if (btnExportar) {
    btnExportar.onclick = exportarAExcel;
  }
});

// ==========================================================
// FUNCIONES AUXILIARES
// ==========================================================

function formatearNombreInstalacion(subId) {
  const nombres = {
    'parrilla-central': 'Parrilla Central',
    'parrilla-grande': 'Parrilla Grande',
    'parrilla-familiar': 'Parrilla Familiar',
    'parrilla-1': 'Parrilla 1',
    'parrilla-2': 'Parrilla 2',
    'parrilla-3': 'Parrilla 3',
    'parrilla-4': 'Parrilla 4',
    'tenis-1': 'Cancha de Tenis 1',
    'tenis-2': 'Cancha de Tenis 2',
    'tenis-3': 'Cancha de Tenis 3',
    'fronton-1': 'Frontón 1',
    'fronton-2': 'Frontón 2',
    'fronton-3': 'Frontón 3',
    'fronton-4': 'Frontón 4',
    'mesa-restaurante': 'Mesa Restaurante'
  };
  
  return nombres[subId] || subId;
}

function formatearFecha(fecha) {
  const opciones = { day: 'numeric', month: 'short', year: 'numeric' };
  return fecha.toLocaleDateString('es-PE', opciones);
}

function formatearFechaCompleta(fecha) {
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  return fecha.toLocaleDateString('es-PE', opciones);
}

function formatearHora(fecha) {
  return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function capitalizarTexto(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function mostrarToast(mensaje) {
  const toast = document.getElementById('toastAdmin');
  const toastMensaje = document.getElementById('toastMensajeAdmin');
  
  if (toast && toastMensaje) {
    toastMensaje.textContent = mensaje;
    toast.classList.add('mostrar');
    
    setTimeout(() => {
      toast.classList.remove('mostrar');
    }, 3000);
  }
}

// ==========================================================
// NAVEGACIÓN POR PESTAÑAS
// ==========================================================

function inicializarTabs() {
  const tabs = document.querySelectorAll('.tab-admin');

  tabs.forEach(tab => {
    tab.onclick = () => {
      const tabId = tab.getAttribute('data-tab');

      // Actualizar pestañas activas
      tabs.forEach(t => t.classList.remove('activo'));
      tab.classList.add('activo');

      // Mostrar contenido correspondiente
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('activo');
      });

      const tabContent = document.getElementById(`tab${capitalizarTexto(tabId)}`);
      if (tabContent) {
        tabContent.classList.add('activo');
      }

      // Cargar datos de carta si es la primera vez
      if (tabId === 'carta' && platosData.length === 0) {
        cargarDatosCarta();
      }
    };
  });
}

// ==========================================================
// GESTIÓN DE CARTA - ETIQUETAS
// ==========================================================

function inicializarGestionCarta() {
  // Filtros de carta
  const filtroCategoria = document.getElementById('filtroCategoriaCarta');
  const filtroBusqueda = document.getElementById('filtroBusquedaCarta');
  const filtroEtiqueta = document.getElementById('filtroEtiquetaCarta');

  if (filtroCategoria) filtroCategoria.onchange = aplicarFiltrosCarta;
  if (filtroBusqueda) filtroBusqueda.oninput = aplicarFiltrosCarta;
  if (filtroEtiqueta) filtroEtiqueta.onchange = aplicarFiltrosCarta;

  // Modal de etiquetas
  const btnCerrarEtiquetas = document.getElementById('btnCerrarEditarEtiquetas');
  const btnCancelarEtiquetas = document.getElementById('btnCancelarEtiquetas');
  const btnGuardarEtiquetas = document.getElementById('btnGuardarEtiquetas');
  const modalOverlay = document.querySelector('#modalEditarEtiquetas .modal-overlay-admin');

  if (btnCerrarEtiquetas) btnCerrarEtiquetas.onclick = cerrarModalEtiquetas;
  if (btnCancelarEtiquetas) btnCancelarEtiquetas.onclick = cerrarModalEtiquetas;
  if (btnGuardarEtiquetas) btnGuardarEtiquetas.onclick = guardarEtiquetasPlato;
  if (modalOverlay) modalOverlay.onclick = cerrarModalEtiquetas;
}

async function cargarDatosCarta() {
  try {
    mostrarToast('Cargando platos...');

    // Cargar platos desde carta.json
    const responsePlatos = await fetch('data/carta.json');
    if (!responsePlatos.ok) throw new Error('Error al cargar carta.json');
    const dataPlatos = await responsePlatos.json();

    // Crear mapa de categorías para búsqueda rápida
    const categoriasMap = {};
    if (dataPlatos.categorias) {
      dataPlatos.categorias.forEach(cat => {
        categoriasMap[cat.id] = cat.nombre;
      });
    }

    // Cargar platos del array principal
    platosData = [];
    if (dataPlatos.platos) {
      dataPlatos.platos.forEach(plato => {
        platosData.push({
          ...plato,
          categoria: categoriasMap[plato.categoria] || plato.categoria,
          categoriaId: plato.categoria
        });
      });
    }

    // Llenar select de categorías
    const selectCategoria = document.getElementById('filtroCategoriaCarta');
    if (selectCategoria && dataPlatos.categorias) {
      selectCategoria.innerHTML = '<option value="">Todas</option>';
      dataPlatos.categorias.forEach(cat => {
        selectCategoria.innerHTML += `<option value="${cat.id}">${cat.nombre}</option>`;
      });
    }

    // Cargar estados de platos desde Firebase
    await cargarEstadosPlatos();

    // Cargar etiquetas disponibles
    await cargarEtiquetasDisponibles();

    platosFiltrados = [...platosData];
    renderizarPlatos();
    actualizarEstadisticasCarta();

    console.log(`✅ Cargados ${platosData.length} platos`);

  } catch (error) {
    console.error('Error al cargar datos de carta:', error);
    mostrarToast('Error al cargar los platos');
  }
}

async function cargarEstadosPlatos() {
  try {
    const estadosSnapshot = await getDocs(collection(db, 'estadosPlatos'));
    estadosPlatosData = {};

    estadosSnapshot.forEach(doc => {
      estadosPlatosData[doc.id] = doc.data().etiquetas || [];
    });

    console.log(`📋 Estados cargados: ${Object.keys(estadosPlatosData).length}`);
  } catch (error) {
    console.error('Error al cargar estados de platos:', error);
  }
}

async function cargarEtiquetasDisponibles() {
  try {
    const etiquetasSnapshot = await getDocs(collection(db, 'etiquetas'));
    etiquetasData = {};

    etiquetasSnapshot.forEach(doc => {
      etiquetasData[doc.id] = doc.data();
    });

    console.log(`🏷️ Etiquetas disponibles: ${Object.keys(etiquetasData).length}`);
  } catch (error) {
    console.error('Error al cargar etiquetas:', error);
  }
}

function aplicarFiltrosCarta() {
  const categoria = document.getElementById('filtroCategoriaCarta')?.value || '';
  const busqueda = document.getElementById('filtroBusquedaCarta')?.value.toLowerCase().trim() || '';
  const etiqueta = document.getElementById('filtroEtiquetaCarta')?.value || '';

  platosFiltrados = platosData.filter(plato => {
    // Filtro por categoría
    if (categoria && plato.categoriaId !== categoria) {
      return false;
    }

    // Filtro por búsqueda
    if (busqueda) {
      const nombre = plato.nombre?.toLowerCase() || '';
      const descripcion = plato.descripcion?.toLowerCase() || '';
      if (!nombre.includes(busqueda) && !descripcion.includes(busqueda)) {
        return false;
      }
    }

    // Filtro por etiqueta
    if (etiqueta) {
      const etiquetasPlato = estadosPlatosData[plato.id] || [];
      if (!etiquetasPlato.includes(etiqueta)) {
        return false;
      }
    }

    return true;
  });

  renderizarPlatos();
}

function renderizarPlatos() {
  const contenedor = document.getElementById('listaPlatosAdmin');
  const sinResultados = document.getElementById('sinPlatosCarta');
  const contador = document.getElementById('contadorPlatosCarta');

  if (!contenedor) return;

  contador.textContent = `${platosFiltrados.length} plato${platosFiltrados.length !== 1 ? 's' : ''}`;

  if (platosFiltrados.length === 0) {
    contenedor.innerHTML = '';
    if (sinResultados) sinResultados.classList.remove('oculto');
    return;
  }

  if (sinResultados) sinResultados.classList.add('oculto');

  let html = '';

  platosFiltrados.forEach(plato => {
    const etiquetasPlato = estadosPlatosData[plato.id] || [];
    const imagen = plato.imagen || 'imagenes/platos/default.jpg';

    // Generar mini etiquetas
    let etiquetasHtml = '';
    etiquetasPlato.forEach(etiquetaId => {
      const etiquetaInfo = etiquetasData[etiquetaId];
      const nombreEtiqueta = etiquetaInfo?.nombre || capitalizarTexto(etiquetaId);
      etiquetasHtml += `<span class="mini-etiqueta ${etiquetaId}">${nombreEtiqueta}</span>`;
    });

    if (etiquetasPlato.length === 0) {
      etiquetasHtml = '<span style="color: #999; font-size: 0.75rem;">Sin etiquetas</span>';
    }

    // Verificar si el plato está agotado
    const estaAgotado = etiquetasPlato.includes('agotado');
    const claseAgotado = estaAgotado ? 'activo' : '';
    const tooltipAgotado = estaAgotado ? 'Quitar agotado' : 'Marcar agotado';

    html += `
      <div class="tarjeta-plato-admin" data-id="${plato.id}">
        <img src="${imagen}" alt="${plato.nombre}" class="plato-imagen-admin"
             onerror="this.src='imagenes/platos/default.jpg'">
        <div class="plato-info-admin">
          <div class="plato-nombre-admin">${plato.nombre}</div>
          <div class="plato-categoria-admin">${plato.categoria} - S/ ${plato.precio?.toFixed(2) || '0.00'}</div>
          <div class="plato-etiquetas-actuales">
            ${etiquetasHtml}
          </div>
        </div>
        <div class="acciones-plato-admin">
          <button class="boton-toggle-agotado ${claseAgotado}" data-tooltip="${tooltipAgotado}" onclick="window.toggleAgotado('${plato.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </button>
          <button class="boton-editar-etiquetas" onclick="window.abrirModalEtiquetas('${plato.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>Editar</span>
          </button>
        </div>
      </div>
    `;
  });

  contenedor.innerHTML = html;
}

function abrirModalEtiquetas(platoId) {
  const plato = platosData.find(p => p.id === platoId);
  if (!plato) {
    mostrarToast('Plato no encontrado');
    return;
  }

  platoSeleccionado = plato;
  const etiquetasPlato = estadosPlatosData[platoId] || [];

  // Actualizar título del modal
  document.getElementById('modalEtiquetasTitulo').textContent = plato.nombre;
  document.getElementById('modalEtiquetasPrecio').textContent = `S/ ${plato.precio?.toFixed(2) || '0.00'}`;

  // Desmarcar todos los checkboxes y radio buttons
  document.querySelectorAll('#modalEditarEtiquetas input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // Por defecto, seleccionar "Sin estado" en disponibilidad
  const radioSinEstado = document.querySelector('#modalEditarEtiquetas input[name="estadoDisponibilidad"][value=""]');
  if (radioSinEstado) radioSinEstado.checked = true;

  // Marcar las etiquetas actuales
  etiquetasPlato.forEach(etiquetaId => {
    // Primero buscar en radio buttons (estado de disponibilidad)
    const radio = document.querySelector(`#modalEditarEtiquetas input[type="radio"][value="${etiquetaId}"]`);
    if (radio) {
      radio.checked = true;
      return;
    }

    // Luego buscar en checkboxes
    const checkbox = document.querySelector(`#modalEditarEtiquetas input[type="checkbox"][value="${etiquetaId}"]`);
    if (checkbox) {
      checkbox.checked = true;
    }
  });

  // Mostrar modal
  const modal = document.getElementById('modalEditarEtiquetas');
  modal.classList.add('activo');
  document.body.style.overflow = 'hidden';
}

function cerrarModalEtiquetas() {
  const modal = document.getElementById('modalEditarEtiquetas');
  modal.classList.remove('activo');
  document.body.style.overflow = 'auto';
  platoSeleccionado = null;
}

async function guardarEtiquetasPlato() {
  if (!platoSeleccionado) {
    mostrarToast('No hay plato seleccionado');
    return;
  }

  // VALIDACIÓN DE PERMISO
  if (!verificarPermiso(usuarioAdminData, 'carta.modificar')) {
    await registrarAccesoDenegado(usuarioActual.email, 'modificar_etiquetas', `plato:${platoSeleccionado.id}`);
    mostrarToast('No tienes permiso para modificar etiquetas de platos');
    return;
  }

  // Obtener etiquetas seleccionadas
  const etiquetasSeleccionadas = [];

  // Obtener el estado de disponibilidad (radio button)
  const radioSeleccionado = document.querySelector('#modalEditarEtiquetas input[name="estadoDisponibilidad"]:checked');
  if (radioSeleccionado && radioSeleccionado.value) {
    etiquetasSeleccionadas.push(radioSeleccionado.value);
  }

  // Obtener los checkboxes seleccionados
  const checkboxes = document.querySelectorAll('#modalEditarEtiquetas input[type="checkbox"]:checked');
  checkboxes.forEach(cb => {
    etiquetasSeleccionadas.push(cb.value);
  });

  try {
    const btnGuardar = document.getElementById('btnGuardarEtiquetas');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = 'Guardando...';

    // Guardar en Firebase
    const estadoRef = doc(db, 'estadosPlatos', platoSeleccionado.id);
    await setDoc(estadoRef, {
      platoId: platoSeleccionado.id,
      etiquetas: etiquetasSeleccionadas,
      fechaActualizacion: serverTimestamp()
    }, { merge: true });

    // Actualizar datos locales
    estadosPlatosData[platoSeleccionado.id] = etiquetasSeleccionadas;

    // Guardar nombre antes de cerrar modal
    const nombrePlato = platoSeleccionado.nombre;

    // Re-renderizar lista
    renderizarPlatos();
    actualizarEstadisticasCarta();

    cerrarModalEtiquetas();
    mostrarToast(`Etiquetas actualizadas para: ${nombrePlato}`);

    // Restaurar botón
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      Guardar Cambios
    `;

  } catch (error) {
    console.error('Error al guardar etiquetas:', error);
    mostrarToast('Error al guardar las etiquetas');

    const btnGuardar = document.getElementById('btnGuardarEtiquetas');
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      Guardar Cambios
    `;
  }
}

// ==========================================================
// TOGGLE RÁPIDO DE AGOTADO
// ==========================================================

async function toggleAgotado(platoId) {
  const plato = platosData.find(p => p.id === platoId);
  if (!plato) {
    mostrarToast('Plato no encontrado');
    return;
  }

  // VALIDACIÓN DE PERMISO
  if (!verificarPermiso(usuarioAdminData, 'carta.modificar')) {
    await registrarAccesoDenegado(usuarioActual.email, 'toggle_agotado', `plato:${platoId}`);
    mostrarToast('No tienes permiso para cambiar la disponibilidad de platos');
    return;
  }

  try {
    // Obtener etiquetas actuales
    let etiquetasActuales = estadosPlatosData[platoId] || [];
    let nuevasEtiquetas = [];

    // Toggle agotado
    if (etiquetasActuales.includes('agotado')) {
      // Quitar agotado
      nuevasEtiquetas = etiquetasActuales.filter(e => e !== 'agotado');
    } else {
      // Agregar agotado y quitar disponible/proximamente
      nuevasEtiquetas = etiquetasActuales.filter(e => e !== 'disponible' && e !== 'proximamente');
      nuevasEtiquetas.push('agotado');
    }

    // Guardar en Firebase
    const estadoRef = doc(db, 'estadosPlatos', platoId);
    await setDoc(estadoRef, {
      platoId: platoId,
      etiquetas: nuevasEtiquetas,
      fechaActualizacion: serverTimestamp()
    }, { merge: true });

    // Actualizar datos locales
    estadosPlatosData[platoId] = nuevasEtiquetas;

    // Re-renderizar lista
    renderizarPlatos();
    actualizarEstadisticasCarta();

    const estado = nuevasEtiquetas.includes('agotado') ? 'marcado como agotado' : 'marcado como disponible';
    mostrarToast(`${plato.nombre}: ${estado}`);

  } catch (error) {
    console.error('Error al toggle agotado:', error);
    mostrarToast('Error al actualizar el estado');
  }
}

// ==========================================================
// ESTADÍSTICAS DE CARTA
// ==========================================================

function actualizarEstadisticasCarta() {
  if (platosData.length === 0) return;

  let disponibles = 0;
  let agotados = 0;
  let promociones = 0;

  platosData.forEach(plato => {
    const etiquetas = estadosPlatosData[plato.id] || [];

    // Contar agotados
    if (etiquetas.includes('agotado')) {
      agotados++;
    } else if (!etiquetas.includes('proximamente')) {
      // Disponibles son los que no están agotados ni próximamente
      disponibles++;
    }

    // Contar promociones (nuevo, popular, 2x1, descuento, recomendado)
    if (etiquetas.includes('nuevo') ||
        etiquetas.includes('popular') ||
        etiquetas.includes('2x1') ||
        etiquetas.includes('descuento') ||
        etiquetas.includes('recomendado')) {
      promociones++;
    }
  });

  // Actualizar contadores en el DOM
  const elDisponibles = document.getElementById('totalDisponibles');
  const elAgotados = document.getElementById('totalAgotados');
  const elPromociones = document.getElementById('totalPromociones');
  const elTotal = document.getElementById('totalPlatosCarta');

  if (elDisponibles) elDisponibles.textContent = disponibles;
  if (elAgotados) elAgotados.textContent = agotados;
  if (elPromociones) elPromociones.textContent = promociones;
  if (elTotal) elTotal.textContent = platosData.length;
}

// ==========================================================
// PROTECCIÓN DE PESTAÑAS POR ROLES
// ==========================================================

function protegerPestanas() {
  // Solo super_admin puede ver gestión de usuarios
  const tabUsuarios = document.querySelector('[data-tab="usuarios"]');
  const tabAuditoria = document.querySelector('[data-tab="auditoria"]');

  if (tabUsuarios) {
    if (usuarioAdminData.rol === 'super_admin') {
      tabUsuarios.style.display = 'flex';
    } else {
      tabUsuarios.style.display = 'none';
    }
  }

  if (tabAuditoria) {
    if (usuarioAdminData.rol === 'super_admin') {
      tabAuditoria.style.display = 'flex';
    } else {
      tabAuditoria.style.display = 'none';
    }
  }

  // Ocultar tab de carta si no tiene permiso
  const tabCarta = document.querySelector('[data-tab="carta"]');
  if (tabCarta && !verificarPermiso(usuarioAdminData, 'carta.leer')) {
    tabCarta.style.display = 'none';
  }

  // Ocultar tab de reservas si no tiene permiso
  const tabReservas = document.querySelector('[data-tab="reservas"]');
  if (tabReservas && !verificarPermiso(usuarioAdminData, 'reservas.leer')) {
    tabReservas.style.display = 'none';
  }
}

// ==========================================================
// INICIALIZAR EVENTOS DE ROLES Y USUARIOS
// ==========================================================

function inicializarEventosRoles() {
  // Botón agregar usuario
  const btnAgregarUsuario = document.getElementById('btnAgregarUsuario');
  if (btnAgregarUsuario) {
    btnAgregarUsuario.onclick = () => {
      if (usuarioAdminData.rol === 'super_admin') {
        abrirModalAgregarUsuario();
      } else {
        mostrarToast('No tienes permisos para agregar usuarios');
      }
    };
  }

  // Cargar usuarios y auditoría
  cargarUsuariosAdmin();
  cargarAuditoriaAdmin();

  // Filtros de auditoría
  const filtroAudUsuario = document.getElementById('filtroAudUsuario');
  const filtroAudFechaInicio = document.getElementById('filtroAudFechaInicio');
  const filtroAudFechaFin = document.getElementById('filtroAudFechaFin');
  const filtroAudAccion = document.getElementById('filtroAudAccion');
  const btnLimpiarFiltrosAud = document.getElementById('btnLimpiarFiltrosAud');

  if (filtroAudUsuario) {
    filtroAudUsuario.addEventListener('input', filtrarAuditoria);
  }
  if (filtroAudFechaInicio) {
    filtroAudFechaInicio.addEventListener('change', filtrarAuditoria);
  }
  if (filtroAudFechaFin) {
    filtroAudFechaFin.addEventListener('change', filtrarAuditoria);
  }
  if (filtroAudAccion) {
    filtroAudAccion.addEventListener('change', filtrarAuditoria);
  }
  if (btnLimpiarFiltrosAud) {
    btnLimpiarFiltrosAud.onclick = limpiarFiltrosAuditoria;
  }

  // Event listeners para modal de crear usuario
  const btnCerrarModalUsuario = document.getElementById('btnCerrarModalUsuario');
  const btnCancelarUsuario = document.getElementById('btnCancelarUsuario');
  const formularioAgregarUsuario = document.getElementById('formularioAgregarUsuario');

  if (btnCerrarModalUsuario) {
    btnCerrarModalUsuario.onclick = cerrarModalAgregarUsuario;
  }

  if (btnCancelarUsuario) {
    btnCancelarUsuario.onclick = cerrarModalAgregarUsuario;
  }

  if (formularioAgregarUsuario) {
    formularioAgregarUsuario.onsubmit = crearUsuarioAdmin;
  }

  // Cerrar modal al hacer click en overlay
  const modalAgregarUsuario = document.getElementById('modalAgregarUsuario');
  if (modalAgregarUsuario) {
    const overlay = modalAgregarUsuario.querySelector('.modal-overlay-admin');
    if (overlay) {
      overlay.onclick = cerrarModalAgregarUsuario;
    }
  }
}

// ==========================================================
// GESTIÓN DE USUARIOS ADMINISTRATIVOS
// ==========================================================

async function cargarUsuariosAdmin() {
  try {
    usuariosAdminData = await obtenerUsuariosAdmin();
    renderizarTablaUsuarios();
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    mostrarToast('Error al cargar usuarios');
  }
}

function renderizarTablaUsuarios() {
  const tbody = document.getElementById('tablaUsuariosAdmin');
  if (!tbody) return;

  if (usuariosAdminData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="sin-datos">No hay usuarios registrados</td></tr>';
    return;
  }

  tbody.innerHTML = usuariosAdminData.map(usuario => {
    const rol = ROLES_DEFINIDOS[usuario.rol];
    const ultimoAcceso = usuario.ultimoAcceso
      ? new Date(usuario.ultimoAcceso.toDate()).toLocaleDateString('es-PE')
      : 'Nunca';

    return `
      <tr>
        <td class="usuario-email">${usuario.email}</td>
        <td>${usuario.nombre}</td>
        <td>
          <span class="usuario-rol ${usuario.rol.replace(/_/g, '-')}">${rol.nombre}</span>
        </td>
        <td>
          <span class="usuario-estado estado-${usuario.estado}">
            ${usuario.estado.charAt(0).toUpperCase() + usuario.estado.slice(1)}
          </span>
        </td>
        <td class="usuario-acceso">${ultimoAcceso}</td>
        <td>
          <div class="acciones-usuario">
            <button class="btn-editar-usuario" onclick="editarUsuarioAdmin('${usuario.id}')">Editar</button>
            <button class="btn-eliminar-usuario" onclick="eliminarUsuarioAdmin('${usuario.id}')">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirModalAgregarUsuario() {
  const modal = document.getElementById('modalAgregarUsuario');
  const formulario = document.getElementById('formularioAgregarUsuario');

  if (modal && formulario) {
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden';
    formulario.reset();
  }
}

function cerrarModalAgregarUsuario() {
  const modal = document.getElementById('modalAgregarUsuario');
  if (modal) {
    modal.classList.remove('activo');
    document.body.style.overflow = 'auto';
  }
}

async function crearUsuarioAdmin(evento) {
  evento.preventDefault();

  // Obtener valores del formulario
  const uid = document.getElementById('adminUID').value.trim();
  const email = document.getElementById('adminEmail').value.trim();
  const nombre = document.getElementById('adminNombre').value.trim();
  const rol = document.getElementById('adminRol').value;

  // Validaciones
  if (!uid || !email || !nombre || !rol) {
    mostrarToast('Todos los campos son obligatorios');
    return;
  }

  if (uid.length < 20) {
    mostrarToast('El UID parece inválido. Verifica que hayas copiado correctamente');
    return;
  }

  if (!email.includes('@')) {
    mostrarToast('Email inválido');
    return;
  }

  try {
    // Verificar permiso
    if (!verificarPermiso(usuarioAdminData, 'usuarios.crear')) {
      await registrarAccesoDenegado(usuarioActual.email, 'crear_usuario', `usuario:${email}`);
      mostrarToast('No tienes permiso para crear usuarios');
      return;
    }

    // Crear usuario en Firebase
    const usuariosRef = collection(db, 'usuarios_admin');
    const docRef = doc(usuariosRef, uid);

    await setDoc(docRef, {
      uid: uid,
      email: email,
      nombre: nombre,
      rol: rol,
      estado: 'activo',
      permisos_custom: {},
      fechaCreacion: serverTimestamp(),
      ultimoAcceso: null,
      historialAcceso: []
    });

    // Registrar en auditoría
    await registrarAccionExitosa(
      usuarioActual.email,
      'crear',
      'usuario',
      uid,
      {
        antes: {},
        despues: { email, nombre, rol }
      }
    );

    // Cerrar modal
    cerrarModalAgregarUsuario();

    // Recargar tabla de usuarios
    await cargarUsuariosAdmin();

    mostrarToast(`✅ Usuario ${nombre} creado exitosamente`);

  } catch (error) {
    console.error('Error al crear usuario:', error);

    if (error.code === 'permission-denied') {
      mostrarToast('Error de permisos. Verifica las reglas de seguridad de Firebase');
    } else if (error.message.includes('Document already exists')) {
      mostrarToast('Este UID ya existe. Usa otro diferente');
    } else {
      mostrarToast('Error al crear usuario: ' + error.message);
    }
  }
}

async function editarUsuarioAdmin(usuarioId) {
  // Placeholder - se implementará después
  mostrarToast('Funcionalidad de editar usuario en desarrollo');
  console.log('Editar usuario:', usuarioId);
}

async function eliminarUsuarioAdmin(usuarioId) {
  // Placeholder - se implementará después
  mostrarToast('Funcionalidad de eliminar usuario en desarrollo');
  console.log('Eliminar usuario:', usuarioId);
}

// ==========================================================
// GESTIÓN DE AUDITORÍA
// ==========================================================

async function cargarAuditoriaAdmin() {
  try {
    const auditRef = collection(db, 'auditoria');
    const q = query(auditRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);

    auditData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    auditFiltrada = [...auditData];
    renderizarTablaAuditoria();
  } catch (error) {
    console.error('Error al cargar auditoría:', error);
    mostrarToast('Error al cargar auditoría');
  }
}

function renderizarTablaAuditoria() {
  const tbody = document.getElementById('tablaAuditoriaAdmin');
  if (!tbody) return;

  if (auditFiltrada.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="sin-datos">No hay registros</td></tr>';
    return;
  }

  tbody.innerHTML = auditFiltrada.map(registro => {
    const fecha = new Date(registro.timestamp.toDate()).toLocaleString('es-PE');
    const tipoAccion = getClaseAccion(registro.accion);

    return `
      <tr>
        <td class="aud-fecha">${fecha}</td>
        <td class="aud-usuario">${registro.usuario}</td>
        <td>
          <span class="aud-accion ${tipoAccion}">
            ${registro.accion.replace(/_/g, ' ')}
          </span>
        </td>
        <td class="aud-recurso">${registro.recurso || '-'}</td>
        <td class="aud-detalles">${registro.detalles || registro.tipo || '-'}</td>
      </tr>
    `;
  }).join('');
}

function getClaseAccion(accion) {
  if (accion.includes('CREAR')) return 'accion-crear';
  if (accion.includes('MODIFICAR')) return 'accion-modificar';
  if (accion.includes('ELIMINAR')) return 'accion-eliminar';
  if (accion.includes('DENEGADO')) return 'accion-acceso-denegado';
  return 'accion-modificar';
}

function filtrarAuditoria() {
  const usuario = document.getElementById('filtroAudUsuario')?.value || '';
  const fechaInicio = document.getElementById('filtroAudFechaInicio')?.value;
  const fechaFin = document.getElementById('filtroAudFechaFin')?.value;
  const accion = document.getElementById('filtroAudAccion')?.value || '';

  auditFiltrada = auditData.filter(registro => {
    // Filtrar por usuario
    if (usuario && !registro.usuario.toLowerCase().includes(usuario.toLowerCase())) {
      return false;
    }

    // Filtrar por fecha
    if (fechaInicio || fechaFin) {
      const fechaReg = new Date(registro.timestamp.toDate());
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        if (fechaReg < inicio) return false;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        if (fechaReg > fin) return false;
      }
    }

    // Filtrar por acción
    if (accion && !registro.accion.includes(accion)) {
      return false;
    }

    return true;
  });

  renderizarTablaAuditoria();
}

function limpiarFiltrosAuditoria() {
  document.getElementById('filtroAudUsuario').value = '';
  document.getElementById('filtroAudFechaInicio').value = '';
  document.getElementById('filtroAudFechaFin').value = '';
  document.getElementById('filtroAudAccion').value = '';

  auditFiltrada = [...auditData];
  renderizarTablaAuditoria();
  mostrarToast('Filtros limpios');
}

// ==========================================================
// EXPORTAR FUNCIONES GLOBALES
// ==========================================================

window.verDetalle = verDetalle;
window.abrirModalEtiquetas = abrirModalEtiquetas;
window.toggleAgotado = toggleAgotado;
window.editarUsuarioAdmin = editarUsuarioAdmin;
window.eliminarUsuarioAdmin = eliminarUsuarioAdmin;