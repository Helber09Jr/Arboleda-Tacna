/* ==========================================================
   RESERVAS.JS - SISTEMA DE RESERVAS OPTIMIZADO
   La Arboleda Club - Tacna, Perú
   Versión: 2.0 - Noviembre 2025
   ========================================================== */

import {
  db,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from './firebase-config.js';

// ==========================================================
// VARIABLES GLOBALES
// ==========================================================

let instalacionSeleccionada = null;
let subInstalacionSeleccionada = null;
let fechaSeleccionada = null;
let horarioSeleccionado = null;
let mesActual = new Date().getMonth();
let anioActual = new Date().getFullYear();
let reservasCache = {};
let reservasCompletasCache = {};
let unsubscribeReservas = null;
let firebaseDisponible = false;
let sociosData = [];
let socioVerificado = null;

const datosInstalaciones = {
  parrillas: {
    nombre: 'Parrillas',
    tipo: 'bloque-dia',
    horario: '10:00 AM - 6:00 PM',
    subopciones: [
      { id: 'parrilla-central', nombre: 'Parrilla Central', capacidad: 30 },
      { id: 'parrilla-grande', nombre: 'Parrilla Grande', capacidad: 35 },
      { id: 'parrilla-familiar', nombre: 'Parrilla Familiar', capacidad: 10 },
      { id: 'parrilla-1', nombre: 'Parrilla 1', capacidad: 25 },
      { id: 'parrilla-2', nombre: 'Parrilla 2', capacidad: 25 },
      { id: 'parrilla-3', nombre: 'Parrilla 3', capacidad: 25 },
      { id: 'parrilla-4', nombre: 'Parrilla 4', capacidad: 25 }
    ]
  },
  tenis: {
    nombre: 'Canchas de Tenis',
    tipo: 'bloques-hora',
    horaInicio: 6,
    horaFin: 21,
    subopciones: [
      { id: 'tenis-1', nombre: 'Cancha de Tenis 1', capacidad: 4 },
      { id: 'tenis-2', nombre: 'Cancha de Tenis 2', capacidad: 4 },
      { id: 'tenis-3', nombre: 'Cancha de Tenis 3', capacidad: 4 }
    ]
  },
  fronton: {
    nombre: 'Frontón',
    tipo: 'bloques-hora',
    horaInicio: 6,
    horaFin: 21,
    subopciones: [
      { id: 'fronton-1', nombre: 'Frontón 1', capacidad: 4 },
      { id: 'fronton-2', nombre: 'Frontón 2', capacidad: 4 },
      { id: 'fronton-3', nombre: 'Frontón 3', capacidad: 4 },
      { id: 'fronton-4', nombre: 'Frontón 4', capacidad: 4 }
    ]
  }
};

// ==========================================================
// INICIALIZACIÓN
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
  ocultarCargador();
  cargarSocios();
  inicializarMenuMovil();
  inicializarEventosInstalaciones();
  inicializarModales();
  inicializarFormularios();
  verificarFirebase();
});

function ocultarCargador() {
  setTimeout(() => {
    const cargador = document.getElementById('cargador-inicial');
    if (cargador) {
      cargador.classList.add('oculto');
    }
  }, 1500);
}

async function cargarSocios() {
  try {
    // Intentar múltiples rutas por si la estructura varía
    let respuesta;
    const rutas = ['data/socios.json', '/data/socios.json', './data/socios.json'];
    
    for (const ruta of rutas) {
      try {
        respuesta = await fetch(ruta);
        if (respuesta.ok) break;
      } catch (e) {
        continue;
      }
    }
    
    if (!respuesta || !respuesta.ok) {
      throw new Error('No se pudo cargar el archivo de socios');
    }
    
    const datos = await respuesta.json();
    sociosData = datos.socios || [];
    console.log('✅ Socios cargados:', sociosData.length);
  } catch (error) {
    console.error('❌ Error al cargar socios:', error);
    mostrarToast('Error al cargar datos de socios. Contacta al administrador.');
  }
}

function verificarFirebase() {
  try {
    if (db) {
      firebaseDisponible = true;
      inicializarListenerReservas();
      console.log('✅ Firebase conectado correctamente');
    }
  } catch (error) {
    console.warn('⚠️ Firebase no disponible:', error);
    firebaseDisponible = false;
    mostrarToast('Modo sin conexión. Puedes reservar por WhatsApp.');
  }
}

// ==========================================================
// VALIDACIÓN DE SOCIOS
// ==========================================================

function buscarSocio(busqueda) {
  const termino = busqueda.trim().toUpperCase();
  
  if (!termino) return null;
  
  return sociosData.find(socio => 
    socio.numero.toUpperCase() === termino || 
    socio.dni === termino
  );
}

function verificarSocio() {
  const campoBusqueda = document.getElementById('reservaBuscarSocio');
  const resultadoDiv = document.getElementById('resultadoVerificacion');
  const datosContainer = document.getElementById('datosSocioContainer');
  const btnVerificar = document.querySelector('.boton-verificar-socio');
  const busqueda = campoBusqueda ? campoBusqueda.value.trim() : '';

  if (!busqueda) {
    if (resultadoDiv) {
      resultadoDiv.innerHTML = '<span class="error-verificacion">Ingresa el número de socio o DNI</span>';
    }
    return;
  }

  if (btnVerificar) btnVerificar.classList.add('boton-cargando');
  
  if (sociosData.length === 0) {
    if (btnVerificar) btnVerificar.classList.remove('boton-cargando');
    if (resultadoDiv) {
      resultadoDiv.innerHTML = '<span class="error-verificacion">Base de datos no disponible. Intenta recargar.</span>';
    }
    return;
  }
  
  const socio = buscarSocio(busqueda);

  setTimeout(() => {
    if (btnVerificar) btnVerificar.classList.remove('boton-cargando');
  }, 300);

  if (socio) {
    if (socio.estado !== 'activo') {
      if (resultadoDiv) {
        resultadoDiv.innerHTML = '<span class="error-verificacion">Este socio no está activo. Contacta a administración.</span>';
      }
      if (datosContainer) datosContainer.classList.add('oculto');
      socioVerificado = null;
      return;
    }
    
    socioVerificado = socio;
    
    const tipoTexto = socio.tipo === 'convenio' ? 'Socio por Convenio' : 'Socio Titular';
    if (resultadoDiv) {
      resultadoDiv.innerHTML = `
        <span class="exito-verificacion">
          ✅ ${tipoTexto} verificado correctamente
        </span>
      `;
    }
    
    const campoNombre = document.getElementById('reservaNombre');
    const campoNumero = document.getElementById('reservaNumeroSocio');
    const campoTelefono = document.getElementById('reservaTelefono');
    const campoTipo = document.getElementById('reservaTipoSocio');
    
    if (campoNombre) campoNombre.value = socio.nombre;
    if (campoNumero) campoNumero.value = socio.numero;
    if (campoTelefono) campoTelefono.value = socio.telefono;
    if (campoTipo) campoTipo.value = socio.tipo;
    
    if (datosContainer) datosContainer.classList.remove('oculto');

    const campoObservaciones = document.getElementById('reservaObservaciones');
    if (campoObservaciones) campoObservaciones.focus();

    mostrarToast('Socio verificado exitosamente');
    
  } else {
    if (resultadoDiv) {
      resultadoDiv.innerHTML = '<span class="error-verificacion">❌ Socio no encontrado. Verifica el número o DNI ingresado.</span>';
    }
    if (datosContainer) datosContainer.classList.add('oculto');
    socioVerificado = null;
  }
}

// ==========================================================
// LISTENER EN TIEMPO REAL DE RESERVAS
// ==========================================================

function inicializarListenerReservas() {
  if (!firebaseDisponible || !db) return;

  try {
    // Desuscribirse del listener anterior si existe
    if (unsubscribeReservas) {
      unsubscribeReservas();
    }

    const reservasCollection = collection(db, 'reservas');
    const q = query(reservasCollection, orderBy('fechaCreacion', 'desc'));

    unsubscribeReservas = onSnapshot(q, (snapshot) => {
      reservasCache = {};
      reservasCompletasCache = {};

      snapshot.forEach((documento) => {
        const reserva = documento.data();
        const key = generarClaveReserva(reserva);

        // Solo considerar reservas activas (pendiente o reservado)
        if (reserva.estado !== 'cancelado') {
          reservasCache[key] = reserva.estado;

          // Guardar info completa para mostrar en calendario
          reservasCompletasCache[key] = {
            estado: reserva.estado,
            socioNombre: reserva.socio?.nombre || 'Reservado'
          };
        }
      });

      console.log('📊 Reservas actualizadas:', Object.keys(reservasCache).length);
      console.log('🔑 Claves en caché:', Object.keys(reservasCache));

      // Actualizar calendario si está visible (modal abierto)
      const modalCalendario = document.getElementById('modalCalendario');
      if (modalCalendario && modalCalendario.classList.contains('activo')) {
        console.log('🔄 Regenerando calendario (modal visible)');
        generarCalendario();
      }

      // Actualizar horarios si están visibles
      const modalHorarios = document.getElementById('modalHorarios');
      if (modalHorarios && modalHorarios.classList.contains('activo')) {
        console.log('🔄 Regenerando horarios (modal visible)');
        generarHorarios();
      }
    }, (error) => {
      console.error('❌ Error al escuchar reservas:', error);
      mostrarToast('Error de conexión. Los datos pueden no estar actualizados.');
    });
  } catch (error) {
    console.error('❌ Error inicializando listener:', error);
  }
}

function formatearFechaParaClave(fecha) {
  let fechaObj;

  // Convertir Timestamp de Firebase a Date si es necesario
  if (fecha && typeof fecha.toDate === 'function') {
    fechaObj = fecha.toDate();
  } else if (fecha instanceof Date) {
    fechaObj = fecha;
  } else {
    fechaObj = new Date();
  }

  // Obtener año, mes, día en zona horaria local
  const year = fechaObj.getFullYear();
  const month = String(fechaObj.getMonth() + 1).padStart(2, '0');
  const day = String(fechaObj.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function generarClaveReserva(reserva) {
  const fechaStr = formatearFechaParaClave(reserva.fecha);

  // Para bloques por hora, incluir el horario en la clave
  if (reserva.horario && reserva.horario !== '10:00 AM - 6:00 PM') {
    return `${reserva.subInstalacion}_${fechaStr}_${reserva.horario}`;
  }
  return `${reserva.subInstalacion}_${fechaStr}`;
}

// ==========================================================
// MENÚ MÓVIL
// ==========================================================

function inicializarMenuMovil() {
  const botonMenu = document.querySelector('.boton-menu-movil');
  const menuNav = document.querySelector('.lista-navegacion');

  if (!botonMenu || !menuNav) return;

  botonMenu.onclick = () => {
    botonMenu.classList.toggle('activo');
    menuNav.classList.toggle('mostrar');
    const expandido = botonMenu.classList.contains('activo');
    botonMenu.setAttribute('aria-expanded', expandido);
  };

  document.querySelectorAll('.enlace-nav').forEach(enlace => {
    enlace.onclick = () => {
      menuNav.classList.remove('mostrar');
      botonMenu.classList.remove('activo');
      botonMenu.setAttribute('aria-expanded', 'false');
    };
  });

  document.addEventListener('click', (e) => {
    if (!botonMenu.contains(e.target) && !menuNav.contains(e.target)) {
      menuNav.classList.remove('mostrar');
      botonMenu.classList.remove('activo');
      botonMenu.setAttribute('aria-expanded', 'false');
    }
  });
}

// ==========================================================
// EVENTOS DE INSTALACIONES
// ==========================================================

function inicializarEventosInstalaciones() {
  const botonesInstalacion = document.querySelectorAll('.boton-seleccionar-instalacion');
  
  botonesInstalacion.forEach(boton => {
    boton.onclick = (e) => {
      e.stopPropagation();
      const instalacion = boton.getAttribute('data-instalacion');
      seleccionarInstalacion(instalacion);
    };
  });

  const tarjetasInstalacion = document.querySelectorAll('.tarjeta-instalacion-reserva');
  tarjetasInstalacion.forEach(tarjeta => {
    tarjeta.onclick = () => {
      const instalacion = tarjeta.getAttribute('data-instalacion');
      seleccionarInstalacion(instalacion);
    };
  });
}

function seleccionarInstalacion(tipo) {
  instalacionSeleccionada = tipo;
  
  switch (tipo) {
    case 'mesas':
      abrirModalMesas();
      break;
    case 'parrillas':
      abrirModalSubseleccion('modalParrillas');
      break;
    case 'tenis':
      abrirModalSubseleccion('modalTenis');
      break;
    case 'fronton':
      abrirModalSubseleccion('modalFronton');
      break;
    default:
      console.warn('Tipo de instalación no reconocido:', tipo);
  }
}

// ==========================================================
// MODALES
// ==========================================================

function inicializarModales() {
  // Botones de cierre de sub-selección
  document.querySelectorAll('.boton-cerrar-modal-sub').forEach(btn => {
    btn.onclick = () => cerrarTodosModales();
  });
  
  // Botón cerrar calendario
  const btnCerrarCalendario = document.querySelector('.boton-cerrar-modal-calendario');
  if (btnCerrarCalendario) {
    btnCerrarCalendario.onclick = () => cerrarModal('modalCalendario');
  }
  
  // Botón cerrar horarios
  const btnCerrarHorarios = document.querySelector('.boton-cerrar-modal-horarios');
  if (btnCerrarHorarios) {
    btnCerrarHorarios.onclick = () => cerrarModal('modalHorarios');
  }
  
  // Botón cerrar reserva
  const btnCerrarReserva = document.querySelector('.boton-cerrar-modal-reserva');
  if (btnCerrarReserva) {
    btnCerrarReserva.onclick = () => cerrarModal('modalReserva');
  }
  
  // Botón cerrar éxito
  const btnCerrarExito = document.getElementById('btnCerrarExito');
  if (btnCerrarExito) {
    btnCerrarExito.onclick = () => {
      cerrarModal('modalExito');
      limpiarFormularios();

      // Guardar la sub-instalación seleccionada antes de resetear
      const subInstalacionTemp = subInstalacionSeleccionada;

      // Resetear pero mantener la instalación actual
      fechaSeleccionada = null;
      horarioSeleccionado = null;
      socioVerificado = null;
      mesActual = new Date().getMonth();
      anioActual = new Date().getFullYear();

      // Volver a abrir el calendario con la sub-instalación
      if (subInstalacionTemp) {
        subInstalacionSeleccionada = subInstalacionTemp;
        setTimeout(() => {
          abrirCalendario();
        }, 300);
      }
    };
  }

  // Overlays de sub-selección
  document.querySelectorAll('.modal-overlay-subseleccion').forEach(overlay => {
    overlay.onclick = () => cerrarTodosModales();
  });
  
  // Overlay calendario
  const overlayCalendario = document.querySelector('.modal-overlay-calendario');
  if (overlayCalendario) {
    overlayCalendario.onclick = () => cerrarModal('modalCalendario');
  }
  
  // Overlay horarios
  const overlayHorarios = document.querySelector('.modal-overlay-horarios');
  if (overlayHorarios) {
    overlayHorarios.onclick = () => cerrarModal('modalHorarios');
  }
  
  // Overlay reserva
  const overlayReserva = document.querySelector('.modal-overlay-reserva');
  if (overlayReserva) {
    overlayReserva.onclick = () => cerrarModal('modalReserva');
  }
  
  // Overlay éxito
  const overlayExito = document.querySelector('.modal-overlay-exito');
  if (overlayExito) {
    overlayExito.onclick = () => {
      cerrarModal('modalExito');
      resetearSeleccion();
      limpiarFormularios();
    };
  }

  // Cerrar con ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarTodosModales();
    }
  });

  // Tarjetas de sub-opción
  document.querySelectorAll('.tarjeta-subopcion').forEach(tarjeta => {
    tarjeta.onclick = () => {
      const subId = tarjeta.getAttribute('data-sub');
      seleccionarSubInstalacion(subId);
    };
  });

  // Navegación del calendario
  const btnMesAnterior = document.getElementById('btnMesAnterior');
  const btnMesSiguiente = document.getElementById('btnMesSiguiente');
  
  if (btnMesAnterior) btnMesAnterior.onclick = () => navegarMes(-1);
  if (btnMesSiguiente) btnMesSiguiente.onclick = () => navegarMes(1);
}

function abrirModalSubseleccion(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden';
  }
}

function abrirModalMesas() {
  limpiarFormularioMesas();
  const modal = document.getElementById('modalMesas');
  if (modal) {
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden';
  }
}

function cerrarModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('activo');
    document.body.style.overflow = 'auto';
  }
}

function cerrarTodosModales() {
  const modales = document.querySelectorAll('.modal-subseleccion, .modal-calendario, .modal-horarios, .modal-reserva, .modal-exito');
  modales.forEach(modal => {
    modal.classList.remove('activo');
  });
  document.body.style.overflow = 'auto';
}

function seleccionarSubInstalacion(subId) {
  subInstalacionSeleccionada = subId;
  cerrarTodosModales();
  
  setTimeout(() => {
    abrirCalendario();
  }, 300);
}

// ==========================================================
// CALENDARIO
// ==========================================================

function abrirCalendario() {
  const modal = document.getElementById('modalCalendario');
  const nombreSub = obtenerNombreSubInstalacion(subInstalacionSeleccionada);
  
  const subtitulo = document.getElementById('subtituloCalendario');
  if (subtitulo) subtitulo.textContent = nombreSub;
  
  // Resetear a mes actual
  mesActual = new Date().getMonth();
  anioActual = new Date().getFullYear();
  
  generarCalendario();
  
  if (modal) {
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden';
  }
}

function generarCalendario() {
  const contenedor = document.getElementById('calendarioDias');
  if (!contenedor) return;

  console.log('📅 Generando calendario para:', subInstalacionSeleccionada);
  console.log('💾 Caché actual:', reservasCache);
  console.log('📊 Total reservas en caché:', Object.keys(reservasCache).length);

  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  const mesTexto = document.getElementById('mesActualTexto');
  if (mesTexto) mesTexto.textContent = `${meses[mesActual]} ${anioActual}`;
  
  const primerDia = new Date(anioActual, mesActual, 1);
  const ultimoDia = new Date(anioActual, mesActual + 1, 0);
  const diasEnMes = ultimoDia.getDate();
  
  // Ajustar para que semana empiece en Lunes
  let diaInicio = primerDia.getDay() - 1;
  if (diaInicio < 0) diaInicio = 6;
  
  let html = '';
  
  // Días vacíos al inicio
  for (let i = 0; i < diaInicio; i++) {
    html += '<div class="dia-calendario vacio"></div>';
  }
  
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  // Días del mes
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaActual = new Date(anioActual, mesActual, dia);
    fechaActual.setHours(0, 0, 0, 0);

    let clases = 'dia-calendario';
    let clickeable = true;
    let dataAtributos = '';

    // Marcar día de hoy
    if (fechaActual.getTime() === hoy.getTime()) {
      clases += ' hoy';
    }

    // Verificar si es pasado
    if (fechaActual < hoy) {
      clases += ' no-disponible';
      clickeable = false;
    } else {
      const infoReserva = obtenerInfoReservaCompleta(fechaActual);

      if (infoReserva) {
        clases += ` ${infoReserva.estado}`;
        clases += ' tiene-reserva';
        dataAtributos = `data-socio="${infoReserva.socioNombre}" data-estado="${infoReserva.estado}"`;

        if (infoReserva.estado === 'reservado') {
          clickeable = false;
        }
      } else {
        clases += ' disponible';
      }
    }

    if (clickeable) {
      html += `
        <div class="${clases}" ${dataAtributos} onclick="window.seleccionarFecha(${dia})" ontouchstart="window.mostrarInfoReserva(event, ${dia})" onmouseenter="window.mostrarInfoReserva(event, ${dia})" onmouseleave="window.ocultarInfoReserva()">
          <span class="numero-dia">${dia}</span>
        </div>
      `;
    } else {
      html += `
        <div class="${clases}" ${dataAtributos} ontouchstart="window.mostrarInfoReserva(event, ${dia})" onmouseenter="window.mostrarInfoReserva(event, ${dia})" onmouseleave="window.ocultarInfoReserva()">
          <span class="numero-dia">${dia}</span>
        </div>
      `;
    }
  }
  
  contenedor.innerHTML = html;
  
  // Actualizar botón de mes anterior
  const btnMesAnterior = document.getElementById('btnMesAnterior');
  if (btnMesAnterior) {
    const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
    const anioAnterior = mesActual === 0 ? anioActual - 1 : anioActual;
    const primerDiaMesAnterior = new Date(anioAnterior, mesAnterior, 1);
    
    if (primerDiaMesAnterior < hoy) {
      btnMesAnterior.disabled = true;
      btnMesAnterior.style.opacity = '0.3';
    } else {
      btnMesAnterior.disabled = false;
      btnMesAnterior.style.opacity = '1';
    }
  }
}

function navegarMes(direccion) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  // Calcular nuevo mes
  let nuevoMes = mesActual + direccion;
  let nuevoAnio = anioActual;
  
  if (nuevoMes > 11) {
    nuevoMes = 0;
    nuevoAnio++;
  } else if (nuevoMes < 0) {
    nuevoMes = 11;
    nuevoAnio--;
  }
  
  // No permitir ir a meses pasados
  const primerDiaNuevoMes = new Date(nuevoAnio, nuevoMes, 1);
  const ultimoDiaNuevoMes = new Date(nuevoAnio, nuevoMes + 1, 0);
  
  if (ultimoDiaNuevoMes < hoy) {
    mostrarToast('No puedes navegar a meses pasados');
    return;
  }
  
  mesActual = nuevoMes;
  anioActual = nuevoAnio;
  
  generarCalendario();
}

function seleccionarFecha(dia) {
  fechaSeleccionada = new Date(anioActual, mesActual, dia);
  fechaSeleccionada.setHours(12, 0, 0, 0); // Mediodía para evitar problemas de zona horaria
  
  cerrarModal('modalCalendario');
  
  const tipoInstalacion = obtenerTipoInstalacion();
  
  if (tipoInstalacion === 'bloque-dia') {
    setTimeout(() => {
      abrirFormularioReserva();
    }, 300);
  } else {
    setTimeout(() => {
      abrirModalHorarios();
    }, 300);
  }
}

function obtenerEstadoReserva(fecha) {
  const fechaStr = formatearFechaParaClave(fecha);
  const key = `${subInstalacionSeleccionada}_${fechaStr}`;
  
  if (reservasCache[key]) {
    return reservasCache[key];
  }
  
  return 'disponible';
}

function obtenerInfoReservaCompleta(fecha) {
  const fechaStr = formatearFechaParaClave(fecha);

  // Buscar CUALQUIER reserva para esta fecha en esta subInstalacion (ignorando horario)
  // porque puede haber múltiples reservas con diferentes horarios el mismo día
  let primeraReserva = null;

  for (const [key, info] of Object.entries(reservasCompletasCache)) {
    // Verificar si la clave comienza con subInstalacion_fecha
    const keyPattern = `${subInstalacionSeleccionada}_${fechaStr}`;
    if (key.startsWith(keyPattern)) {
      console.log(`✅ Encontrado en caché completo: ${key} -> ${info.estado}`);
      // Retornar la primera que encuentre (priorizar reservado > pendiente)
      if (!primeraReserva || info.estado === 'reservado') {
        primeraReserva = info;
      }
    }
  }

  if (primeraReserva) {
    return primeraReserva;
  }

  // Fallback a búsqueda en reservasCache
  for (const [key, estado] of Object.entries(reservasCache)) {
    const keyPattern = `${subInstalacionSeleccionada}_${fechaStr}`;
    if (key.startsWith(keyPattern)) {
      console.log(`✅ Encontrado en caché: ${key} -> ${estado}`);
      return {
        estado: estado,
        socioNombre: 'Reservado'
      };
    }
  }

  console.log(`❌ NO encontrado para: ${subInstalacionSeleccionada}_${fechaStr}`);
  return null;
}

function acortarNombre(nombreCompleto) {
  if (!nombreCompleto) return '';

  // Si tiene coma (Apellido, Nombre), tomar solo el apellido
  if (nombreCompleto.includes(',')) {
    return nombreCompleto.split(',')[0].trim();
  }

  // Si no, tomar primera palabra
  const palabras = nombreCompleto.trim().split(' ');
  return palabras[0];
}

// ==========================================================
// POPUP DE INFORMACIÓN DE RESERVA
// ==========================================================

let popupTimeout = null;

function mostrarInfoReserva(event, dia) {
  const elemento = event.currentTarget;
  const socio = elemento.getAttribute('data-socio');
  const estado = elemento.getAttribute('data-estado');

  if (!socio) return;

  // Limpiar timeout anterior
  if (popupTimeout) {
    clearTimeout(popupTimeout);
  }

  // Obtener o crear el popup
  let popup = document.getElementById('popupInfoReserva');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'popupInfoReserva';
    popup.className = 'popup-info-reserva';
    document.body.appendChild(popup);
  }

  // Texto del estado
  const estadoTexto = estado === 'reservado' ? 'Reservado' : 'Pendiente';
  const estadoIcono = estado === 'reservado' ? '🔒' : '⏳';

  // Contenido del popup
  popup.innerHTML = `
    <div class="popup-contenido">
      <span class="popup-icono">${estadoIcono}</span>
      <div class="popup-datos">
        <span class="popup-socio">${socio}</span>
        <span class="popup-estado ${estado}">${estadoTexto}</span>
      </div>
    </div>
  `;

  // Posicionar el popup
  const rect = elemento.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();

  // Calcular posición centrada debajo del día
  let left = rect.left + (rect.width / 2);
  let top = rect.bottom + 8;

  // Ajustar si se sale de la pantalla
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
  popup.style.transform = 'translateX(-50%)';

  // Mostrar
  popup.classList.add('visible');

  // En móvil, ocultar después de un tiempo
  if ('ontouchstart' in window) {
    popupTimeout = setTimeout(() => {
      ocultarInfoReserva();
    }, 2500);
  }
}

function ocultarInfoReserva() {
  const popup = document.getElementById('popupInfoReserva');
  if (popup) {
    popup.classList.remove('visible');
  }
  if (popupTimeout) {
    clearTimeout(popupTimeout);
    popupTimeout = null;
  }
}

// ==========================================================
// MODAL HORARIOS
// ==========================================================

function abrirModalHorarios() {
  const modal = document.getElementById('modalHorarios');
  const nombreSub = obtenerNombreSubInstalacion(subInstalacionSeleccionada);
  const fechaFormateada = formatearFecha(fechaSeleccionada);
  
  const subtitulo = document.getElementById('subtituloHorarios');
  if (subtitulo) subtitulo.textContent = `${nombreSub} - ${fechaFormateada}`;
  
  generarHorarios();
  
  if (modal) {
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden';
  }
}

function generarHorarios() {
  const contenedor = document.getElementById('listaHorarios');
  if (!contenedor) return;
  
  const datosInst = obtenerDatosInstalacion();
  
  if (!datosInst || datosInst.tipo !== 'bloques-hora') return;
  
  let html = '';
  const fechaStr = formatearFechaParaClave(fechaSeleccionada);

  for (let hora = datosInst.horaInicio; hora < datosInst.horaFin; hora++) {
    const horaInicio = formatearHora(hora);
    const horaFin = formatearHora(hora + 1);
    const bloqueId = `${hora}:00-${hora + 1}:00`;

    const key = `${subInstalacionSeleccionada}_${fechaStr}_${bloqueId}`;
    const estadoReserva = reservasCache[key];
    const reservado = estadoReserva === 'reservado' || estadoReserva === 'pendiente';
    
    const claseEstado = reservado ? 'reservado' : 'disponible';
    const estadoTexto = reservado ? (estadoReserva === 'pendiente' ? '(Pendiente)' : '(Reservado)') : '';
    const onclick = reservado ? '' : `onclick="window.seleccionarHorario('${bloqueId}')"`;
    const tabindex = reservado ? '' : 'tabindex="0" role="button"';
    
    html += `
      <div class="bloque-horario ${claseEstado}" ${onclick} ${tabindex}>
        <span class="horario-texto">${horaInicio} - ${horaFin}</span>
        ${estadoTexto ? `<span class="horario-estado">${estadoTexto}</span>` : ''}
      </div>
    `;
  }
  
  contenedor.innerHTML = html;
}

function seleccionarHorario(bloque) {
  horarioSeleccionado = bloque;
  cerrarModal('modalHorarios');
  
  setTimeout(() => {
    abrirFormularioReserva();
  }, 300);
}

// ==========================================================
// FORMULARIO DE RESERVA
// ==========================================================

function abrirFormularioReserva() {
  const modal = document.getElementById('modalReserva');
  const nombreSub = obtenerNombreSubInstalacion(subInstalacionSeleccionada);
  const fechaFormateada = formatearFechaCompleta(fechaSeleccionada);
  
  // Actualizar resumen
  const resumenInstalacion = document.getElementById('resumenInstalacion');
  if (resumenInstalacion) {
    resumenInstalacion.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      ${nombreSub}
    `;
  }
  
  const resumenFecha = document.getElementById('resumenFecha');
  if (resumenFecha) {
    resumenFecha.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      ${fechaFormateada}
    `;
  }
  
  const tipoInstalacion = obtenerTipoInstalacion();
  let horarioTexto = tipoInstalacion === 'bloque-dia' ? '10:00 AM - 6:00 PM' : horarioSeleccionado;
  
  const resumenHorario = document.getElementById('resumenHorario');
  if (resumenHorario) {
    resumenHorario.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      ${horarioTexto}
    `;
  }
  
  // Limpiar formulario
  const formulario = document.getElementById('formularioReserva');
  if (formulario) formulario.reset();
  
  socioVerificado = null;
  const datosContainer = document.getElementById('datosSocioContainer');
  if (datosContainer) datosContainer.classList.add('oculto');
  
  const resultadoDiv = document.getElementById('resultadoVerificacion');
  if (resultadoDiv) resultadoDiv.innerHTML = '';
  
  const contador = document.getElementById('contadorObservaciones');
  if (contador) contador.textContent = '0';
  
  // Mostrar capacidad máxima
  const capacidad = obtenerCapacidadSubInstalacion();
  const aviso = document.getElementById('avisoCapacidad');
  if (aviso) aviso.textContent = `Máximo ${capacidad} personas`;
  
  if (modal) {
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden';
    
    // Enfocar campo de búsqueda
    setTimeout(() => {
      const campoBusqueda = document.getElementById('reservaBuscarSocio');
      if (campoBusqueda) campoBusqueda.focus();
    }, 400);
  }
}

function inicializarFormularios() {
  // Botón verificar socio
  const btnVerificar = document.getElementById('btnVerificarSocio');
  if (btnVerificar) {
    btnVerificar.onclick = verificarSocio;
  }
  
  // Enter en campo de búsqueda
  const campoBusqueda = document.getElementById('reservaBuscarSocio');
  if (campoBusqueda) {
    campoBusqueda.onkeypress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verificarSocio();
      }
    };
  }
  
  // Contador de caracteres para observaciones
  const textareaReserva = document.getElementById('reservaObservaciones');
  if (textareaReserva) {
    textareaReserva.oninput = () => {
      const contador = document.getElementById('contadorObservaciones');
      if (contador) contador.textContent = textareaReserva.value.length;
    };
  }

  // Validación de personas en tiempo real
  const campoPersonas = document.getElementById('reservaPersonas');
  if (campoPersonas) {
    campoPersonas.oninput = () => {
      const capacidad = obtenerCapacidadSubInstalacion();
      const valor = parseInt(campoPersonas.value);
      const aviso = document.getElementById('avisoCapacidad');

      if (valor > capacidad) {
        if (aviso) {
          aviso.textContent = `⚠️ Excede capacidad máxima (${capacidad})`;
          aviso.style.color = 'var(--rojo-error)';
        }
      } else {
        if (aviso) {
          aviso.textContent = `Máximo ${capacidad} personas`;
          aviso.style.color = '';
        }
      }
    };
  }

  // Formulario de reserva principal
  const formReserva = document.getElementById('formularioReserva');
  if (formReserva) {
    formReserva.onsubmit = (e) => {
      e.preventDefault();
      procesarReserva();
    };
  }
  
  // Botón WhatsApp reserva
  const btnWhatsApp = document.getElementById('btnWhatsAppReserva');
  if (btnWhatsApp) {
    btnWhatsApp.onclick = () => {
      enviarReservaWhatsApp();
    };
  }
  
  // Formulario de mesas
  const formMesas = document.getElementById('formularioMesas');
  if (formMesas) {
    formMesas.onsubmit = (e) => {
      e.preventDefault();
      procesarReservaMesa();
    };
  }
  
  // Botón WhatsApp mesa
  const btnWhatsAppMesa = document.querySelector('.boton-whatsapp-mesa');
  if (btnWhatsAppMesa) {
    btnWhatsAppMesa.onclick = () => {
      enviarConsultaMesaWhatsApp();
    };
  }
}

function limpiarFormularios() {
  const formReserva = document.getElementById('formularioReserva');
  if (formReserva) formReserva.reset();
  
  const formMesas = document.getElementById('formularioMesas');
  if (formMesas) formMesas.reset();
  
  const contador = document.getElementById('contadorObservaciones');
  if (contador) contador.textContent = '0';
  
  const datosContainer = document.getElementById('datosSocioContainer');
  if (datosContainer) datosContainer.classList.add('oculto');
  
  const resultadoDiv = document.getElementById('resultadoVerificacion');
  if (resultadoDiv) resultadoDiv.innerHTML = '';
  
  socioVerificado = null;
}

function limpiarFormularioMesas() {
  const formMesas = document.getElementById('formularioMesas');
  if (formMesas) formMesas.reset();
}

// ==========================================================
// GUARDAR RESERVA EN FIREBASE
// ==========================================================

async function procesarReserva() {
  if (!socioVerificado) {
    mostrarToast('Debes verificar tu número de socio primero');
    return;
  }

  const nombre = document.getElementById('reservaNombre').value.trim();
  const numeroSocio = document.getElementById('reservaNumeroSocio').value.trim();
  const tipoSocio = document.getElementById('reservaTipoSocio').value;
  const telefono = document.getElementById('reservaTelefono').value.trim();
  const personas = document.getElementById('reservaPersonas').value;
  const observaciones = document.getElementById('reservaObservaciones').value.trim();
  const horaIngreso = document.getElementById('reservaHoraIngreso')?.value || '';

  if (!validarFormularioReserva(nombre, personas)) {
    return;
  }

  if (!firebaseDisponible) {
    mostrarToast('Sin conexión a la base de datos. Usa el botón de WhatsApp.');
    return;
  }

  const tipoInstalacion = obtenerTipoInstalacion();
  let horarioTexto = horarioSeleccionado || '10:00 AM - 6:00 PM';

  // Para parrillas, usar la hora de ingreso seleccionada
  if (tipoInstalacion === 'bloque-dia' && horaIngreso) {
    horarioTexto = `Ingreso a las ${convertirHoraFormato12(horaIngreso)}`;
  }

  const reserva = {
    instalacion: instalacionSeleccionada,
    subInstalacion: subInstalacionSeleccionada,
    fecha: Timestamp.fromDate(fechaSeleccionada),
    horario: horarioTexto,
    horaIngreso: horaIngreso, // Guardar hora de ingreso para parrillas
    socio: {
      nombre: nombre,
      numero: numeroSocio,
      telefono: telefono,
      tipo: tipoSocio
    },
    personas: parseInt(personas),
    observaciones: observaciones,
    estado: 'pendiente',
    fechaCreacion: serverTimestamp()
  };

  try {
    mostrarCargando(true);

    const reservasCollection = collection(db, 'reservas');
    const docRef = await addDoc(reservasCollection, reserva);

    cerrarModal('modalReserva');
    mostrarCargando(false);
    limpiarFormularios();

    const idCorto = docRef.id.substring(0, 8).toUpperCase();

    console.log('✅ Reserva guardada:', idCorto);

    // El listener de Firebase se actualizará automáticamente en tiempo real
    // Mostrar ticket de confirmación
    setTimeout(() => {
      mostrarModalExito(idCorto);
    }, 300);

  } catch (error) {
    console.error('❌ Error al guardar reserva:', error);
    mostrarCargando(false);
    mostrarToast('Error al guardar la reserva. Intenta nuevamente o usa WhatsApp.');
  }
}

async function procesarReservaMesa() {
  const nombre = document.getElementById('mesaNombre').value.trim();
  const numeroSocio = document.getElementById('mesaNumeroSocio').value.trim();
  const telefono = document.getElementById('mesaTelefono').value.trim();
  const personas = document.getElementById('mesaPersonas').value;
  const zona = document.getElementById('mesaZona').value;
  const observaciones = document.getElementById('mesaObservaciones').value.trim();
  
  if (!nombre || !personas) {
    mostrarToast('Por favor completa los campos obligatorios');
    return;
  }
  
  if (!firebaseDisponible) {
    mostrarToast('Sin conexión. Usa el botón de WhatsApp para consultar.');
    return;
  }
  
  const reserva = {
    instalacion: 'mesas',
    subInstalacion: 'mesa-restaurante',
    fecha: Timestamp.fromDate(new Date()),
    horario: 'Por definir',
    socio: {
      nombre: nombre,
      numero: numeroSocio || 'No registrado',
      telefono: telefono || 'No proporcionado',
      tipo: 'socio'
    },
    personas: parseInt(personas),
    zona: zona || 'Sin preferencia',
    observaciones: observaciones,
    estado: 'pendiente',
    fechaCreacion: serverTimestamp()
  };
  
  try {
    mostrarCargando(true);
    
    const reservasCollection = collection(db, 'reservas');
    const docRef = await addDoc(reservasCollection, reserva);
    
    cerrarModal('modalMesas');
    mostrarCargando(false);
    
    const idCorto = docRef.id.substring(0, 8).toUpperCase();
    
    setTimeout(() => {
      mostrarModalExito(`Tu solicitud de mesa ha sido registrada.\n\nID: ${idCorto}\n\nTe contactaremos pronto para confirmar disponibilidad.`);
    }, 300);
    
  } catch (error) {
    console.error('❌ Error al guardar reserva de mesa:', error);
    mostrarCargando(false);
    mostrarToast('Error al guardar. Intenta por WhatsApp.');
  }
}

// ==========================================================
// VALIDACIONES
// ==========================================================

function validarFormularioReserva(nombre, personas) {
  if (!nombre) {
    mostrarToast('Por favor verifica tu número de socio primero');
    return false;
  }

  if (!personas || personas < 1) {
    mostrarToast('Por favor ingresa la cantidad de personas');
    const campo = document.getElementById('reservaPersonas');
    if (campo) campo.focus();
    return false;
  }

  const capacidadMax = obtenerCapacidadSubInstalacion();
  if (parseInt(personas) > capacidadMax) {
    mostrarToast(`La capacidad máxima es ${capacidadMax} personas`);
    return false;
  }

  if (!fechaSeleccionada) {
    mostrarToast('Error: No hay fecha seleccionada');
    return false;
  }

  // Validar hora de ingreso para parrillas
  const tipoInstalacion = obtenerTipoInstalacion();
  if (tipoInstalacion === 'bloque-dia') {
    const horaIngreso = document.getElementById('reservaHoraIngreso')?.value;
    if (!horaIngreso) {
      mostrarToast('Por favor selecciona la hora de ingreso');
      const campo = document.getElementById('reservaHoraIngreso');
      if (campo) campo.focus();
      return false;
    }
  }

  return true;
}

// ==========================================================
// WHATSAPP
// ==========================================================

function enviarReservaWhatsApp() {
  if (!socioVerificado) {
    mostrarToast('Debes verificar tu número de socio primero');
    return;
  }
  
  const nombre = document.getElementById('reservaNombre').value.trim();
  const numeroSocio = document.getElementById('reservaNumeroSocio').value.trim();
  const telefono = document.getElementById('reservaTelefono').value.trim();
  const personas = document.getElementById('reservaPersonas').value;
  const observaciones = document.getElementById('reservaObservaciones').value.trim();
  const horaIngreso = document.getElementById('reservaHoraIngreso')?.value || '';

  if (!validarFormularioReserva(nombre, personas)) {
    return;
  }

  const nombreSub = obtenerNombreSubInstalacion(subInstalacionSeleccionada);
  const fechaFormateada = formatearFechaCompleta(fechaSeleccionada);
  const tipoInstalacion = obtenerTipoInstalacion();
  let horarioTexto = horarioSeleccionado || '10:00 AM - 6:00 PM';

  // Para parrillas, usar la hora de ingreso seleccionada
  if (tipoInstalacion === 'bloque-dia' && horaIngreso) {
    horarioTexto = `Ingreso a las ${convertirHoraFormato12(horaIngreso)}`;
  }
  
  let mensaje = `🏡 *SOLICITUD DE RESERVA - LA ARBOLEDA CLUB*\n\n`;
  mensaje += `📍 *Instalación:* ${nombreSub}\n`;
  mensaje += `📅 *Fecha:* ${fechaFormateada}\n`;
  mensaje += `🕐 *Horario:* ${horarioTexto}\n`;
  mensaje += `👤 *Socio:* ${nombre}`;
  if (numeroSocio) mensaje += ` (N° ${numeroSocio})`;
  mensaje += `\n`;
  if (telefono) mensaje += `📞 *Teléfono:* ${telefono}\n`;
  mensaje += `👥 *Personas:* ${personas}\n`;
  if (observaciones) mensaje += `📝 *Observaciones:* ${observaciones}\n`;
  mensaje += `\n¡Gracias! Espero su confirmación.`;
  
  const urlWhatsApp = `https://wa.me/51908881162?text=${encodeURIComponent(mensaje)}`;
  window.open(urlWhatsApp, '_blank');
  
  mostrarToast('Redirigiendo a WhatsApp...');
}

function enviarConsultaMesaWhatsApp() {
  const nombre = document.getElementById('mesaNombre').value.trim();
  const personas = document.getElementById('mesaPersonas').value;
  const zona = document.getElementById('mesaZona').value;
  const observaciones = document.getElementById('mesaObservaciones').value.trim();
  
  let mensaje = `🍽️ *CONSULTA RESERVA DE MESA - LA ARBOLEDA CLUB*\n\n`;
  if (nombre) mensaje += `👤 *Nombre:* ${nombre}\n`;
  if (personas) mensaje += `👥 *Personas:* ${personas}\n`;
  if (zona) mensaje += `📍 *Zona preferida:* ${zona}\n`;
  if (observaciones) mensaje += `📝 *Observaciones:* ${observaciones}\n`;
  mensaje += `\n¿Podrían indicarme disponibilidad? ¡Gracias!`;
  
  const urlWhatsApp = `https://wa.me/51908881162?text=${encodeURIComponent(mensaje)}`;
  window.open(urlWhatsApp, '_blank');
  
  mostrarToast('Redirigiendo a WhatsApp...');
}

// ==========================================================
// FUNCIONES AUXILIARES
// ==========================================================

function obtenerNombreSubInstalacion(subId) {
  for (const key in datosInstalaciones) {
    const inst = datosInstalaciones[key];
    if (inst.subopciones) {
      const sub = inst.subopciones.find(s => s.id === subId);
      if (sub) return sub.nombre;
    }
  }
  return subId || 'Instalación';
}

function obtenerCapacidadSubInstalacion() {
  for (const key in datosInstalaciones) {
    const inst = datosInstalaciones[key];
    if (inst.subopciones) {
      const sub = inst.subopciones.find(s => s.id === subInstalacionSeleccionada);
      if (sub) return sub.capacidad;
    }
  }
  return 10; // Capacidad por defecto
}

function obtenerTipoInstalacion() {
  if (!instalacionSeleccionada) return null;
  const datos = datosInstalaciones[instalacionSeleccionada];
  return datos ? datos.tipo : null;
}

function obtenerDatosInstalacion() {
  if (!instalacionSeleccionada) return null;
  return datosInstalaciones[instalacionSeleccionada];
}

function formatearFecha(fecha) {
  const opciones = { day: 'numeric', month: 'long' };
  return fecha.toLocaleDateString('es-PE', opciones);
}

function formatearFechaCompleta(fecha) {
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  return fecha.toLocaleDateString('es-PE', opciones);
}

function formatearHora(hora) {
  if (hora < 12) {
    return `${hora}:00 AM`;
  } else if (hora === 12) {
    return `12:00 PM`;
  } else {
    return `${hora - 12}:00 PM`;
  }
}

// ==========================================================
// UI HELPERS
// ==========================================================

function mostrarModalExito(idReserva) {
  // Obtener datos de la reserva
  const instalacion = formatearNombreInstalacion(subInstalacionSeleccionada || '');

  // Formato simple de fecha sin día de semana
  let fechaSimple = 'Por confirmar';
  if (fechaSeleccionada) {
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    fechaSimple = fechaSeleccionada.toLocaleDateString('es-PE', opciones);
  }

  const tipoInstalacion = obtenerTipoInstalacion();

  // Determinar la hora según el tipo de instalación
  let hora = '10:00 AM';
  if (tipoInstalacion === 'bloque-dia') {
    // Para parrillas, usar hora de ingreso
    const horaIngreso = document.getElementById('reservaHoraIngreso')?.value || '10:00';
    hora = convertirHoraFormato12(horaIngreso);
  } else {
    // Para otros tipos, usar horario seleccionado
    hora = horarioSeleccionado ? convertirHoraFormato12(horarioSeleccionado) : '10:00 AM';
  }

  const personas = document.getElementById('reservaPersonas')?.value || 'N/A';

  // Llenar datos del ticket
  const idElement = document.getElementById('idReservaConfirmacion');
  const instElement = document.getElementById('instReservaConfirmacion');
  const fechaElement = document.getElementById('fechaReservaConfirmacion');
  const horaElement = document.getElementById('horaReservaConfirmacion');
  const personasElement = document.getElementById('personasReservaConfirmacion');

  if (idElement) idElement.textContent = idReserva || 'PENDIENTE';
  if (instElement) instElement.textContent = instalacion;
  if (fechaElement) fechaElement.textContent = fechaSimple;
  if (horaElement) horaElement.textContent = hora;
  if (personasElement) personasElement.textContent = personas;

  const modal = document.getElementById('modalExito');
  if (modal) {
    modal.classList.add('activo');
    document.body.style.overflow = 'hidden';
  }
}

function generarIdReserva() {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return id;
}

function convertirHoraFormato12(hora) {
  if (!hora) return '10:00 AM';

  // Si ya está en formato 12h, devolver como está
  if (hora.includes('AM') || hora.includes('PM')) {
    return hora;
  }

  // Convertir de formato 24h a 12h
  const [horaNum] = hora.split(':');
  const num = parseInt(horaNum);

  if (num === 0) return '12:00 AM';
  if (num < 12) return `${num}:00 AM`;
  if (num === 12) return '12:00 PM';
  return `${num - 12}:00 PM`;
}

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

function resetearSeleccion() {
  instalacionSeleccionada = null;
  subInstalacionSeleccionada = null;
  fechaSeleccionada = null;
  horarioSeleccionado = null;
  socioVerificado = null;
  mesActual = new Date().getMonth();
  anioActual = new Date().getFullYear();
}

function mostrarToast(mensaje) {
  const toast = document.getElementById('toastNotificacion');
  const toastMensaje = document.getElementById('toastMensaje');
  
  if (toast && toastMensaje) {
    toastMensaje.textContent = mensaje;
    toast.classList.add('mostrar');
    
    // Limpiar timeout anterior si existe
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }
    
    toast.timeoutId = setTimeout(() => {
      toast.classList.remove('mostrar');
    }, 4000);
  }
}

function mostrarCargando(mostrar) {
  const btnConfirmar = document.querySelector('.boton-confirmar-reserva');
  const btnMesa = document.querySelector('.boton-reservar-mesa');
  const btnWhatsapp = document.querySelector('.boton-whatsapp-reserva');

  const botones = [btnConfirmar, btnMesa, btnWhatsapp].filter(b => b);

  botones.forEach(btn => {
    if (mostrar) {
      btn.classList.add('boton-cargando');
      btn.disabled = true;
    } else {
      btn.classList.remove('boton-cargando');
      btn.disabled = false;
    }
  });
}

// ==========================================================
// LIMPIEZA AL SALIR
// ==========================================================

window.addEventListener('beforeunload', () => {
  if (unsubscribeReservas) {
    unsubscribeReservas();
  }
});

// ==========================================================
// EXPORTAR FUNCIONES GLOBALES
// ==========================================================

window.seleccionarFecha = seleccionarFecha;
window.seleccionarHorario = seleccionarHorario;
window.mostrarToast = mostrarToast;
window.mostrarInfoReserva = mostrarInfoReserva;
window.ocultarInfoReserva = ocultarInfoReserva;