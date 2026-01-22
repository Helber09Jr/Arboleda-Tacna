/* ==========================================================
   CARTA.JS - SISTEMA DE MENÚ DIGITAL
   La Arboleda Club - Tacna, Perú
   ========================================================== */

// ==========================================================
// IMPORTACIÓN DEL SISTEMA DE ETIQUETAS
// ==========================================================

import {
  inicializarSistemaEtiquetas,
  generarHTMLEtiquetas,
  generarHTMLEtiquetasModal,
  estaAgotado,
  tieneEtiqueta,
  actualizarEtiquetasEnGrilla
} from './carta-hibrido.js';


let datosMenu = null;
let sistemaEtiquetasListo = false;
let platosFiltrados = [];
let categoriaActual = 'todos';
let etiquetaFiltroActual = 'todos';
let vistaActual = 'detallada';
let platoSeleccionado = null;
let cantidadSeleccionada = 1;

// Variables para galería de imágenes
let galeriaImagenes = [];
let galeriaIndiceActual = 0;

document.addEventListener('DOMContentLoaded', () => {
  cargarDatosMenu();
  inicializarEventos();
  ocultarCargador();
});

async function cargarDatosMenu() {
  try {
    const response = await fetch('data/carta.json');
    if (!response.ok) {
      throw new Error('Error al cargar el menú');
    }
    datosMenu = await response.json();

    if (typeof cargarMozos === 'function' && datosMenu.mozos) {
      cargarMozos(datosMenu.mozos);
    }

    renderizarCategorias();
    filtrarYRenderizarPlatos();

    await inicializarEtiquetas();

  } catch (error) {
    console.error('Error cargando menú:', error);
    mostrarErrorCarga();
  }
}

/**
 * Inicializa el sistema de etiquetas con Firebase
 */
async function inicializarEtiquetas() {
  try {
    const resultado = await inicializarSistemaEtiquetas(() => {

      renderizarPlatos();
    });

    if (resultado.exito) {
      sistemaEtiquetasListo = true;
      renderizarPlatos();
      console.log('✅ Sistema de etiquetas integrado');
    }
  } catch (error) {
    console.warn('Sistema de etiquetas no disponible:', error);
  }
}

function mostrarErrorCarga() {
  const grilla = document.getElementById('grillaPlatos');
  grilla.innerHTML = `
    <div class="sin-resultados">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h3>Error al cargar el menú</h3>
      <p>Por favor, recarga la página</p>
    </div>
  `;
}

function ocultarCargador() {
  setTimeout(() => {
    const cargador = document.getElementById('cargador-inicial');
    if (cargador) {
      cargador.classList.add('oculto');
    }
  }, 2000);
}


function inicializarEventos() {
  // Menú móvil
  const btnMenu = document.querySelector('.boton-menu-movil');
  const listaNav = document.querySelector('.lista-navegacion');
  
  if (btnMenu && listaNav) {
    btnMenu.onclick = () => {
      btnMenu.classList.toggle('activo');
      listaNav.classList.toggle('mostrar');
      const expandido = btnMenu.classList.contains('activo');
      btnMenu.setAttribute('aria-expanded', expandido);
    };
  }

  // Buscador
  const buscador = document.getElementById('buscadorPlatos');
  const btnLimpiar = document.getElementById('btnLimpiarBusqueda');
  
  if (buscador) {
    buscador.oninput = (e) => {
      const valor = e.target.value.trim();
      if (btnLimpiar) {
        btnLimpiar.style.display = valor ? 'block' : 'none';
      }
      filtrarYRenderizarPlatos();
    };
  }
  
  if (btnLimpiar) {
    btnLimpiar.onclick = () => {
      buscador.value = '';
      btnLimpiar.style.display = 'none';
      filtrarYRenderizarPlatos();
    };
  }

  // Toggle de vista
  const btnDetallada = document.getElementById('btnVistaDetallada');
  const btnSimple = document.getElementById('btnVistaSimple');
  
  if (btnDetallada) {
    btnDetallada.onclick = () => {
      vistaActual = 'detallada';
      btnDetallada.classList.add('activo');
      if (btnSimple) btnSimple.classList.remove('activo');
      renderizarPlatos();
    };
  }
  
  if (btnSimple) {
    btnSimple.onclick = () => {
      vistaActual = 'simple';
      btnSimple.classList.add('activo');
      if (btnDetallada) btnDetallada.classList.remove('activo');
      renderizarPlatos();
    };
  }

  // Modal de personalización
  inicializarModalPlato();

  // Modal de vista previa
  inicializarModalVistaPrevia();

  // Filtros por etiquetas
  inicializarFiltrosEtiquetas();
}

/**
 * Inicializa los filtros por etiquetas/estado
 */
function inicializarFiltrosEtiquetas() {
  const contenedor = document.getElementById('filtrosEtiquetas');
  if (!contenedor) return;

  contenedor.querySelectorAll('.filtro-etiqueta-carta').forEach(boton => {
    boton.onclick = () => {
      // Actualizar estado activo
      contenedor.querySelectorAll('.filtro-etiqueta-carta').forEach(b => {
        b.classList.remove('activo');
      });
      boton.classList.add('activo');

      // Actualizar filtro actual
      etiquetaFiltroActual = boton.getAttribute('data-etiqueta');
      filtrarYRenderizarPlatos();
    };
  });
}

// ==========================================================
// RENDERIZADO DE CATEGORÍAS
// ==========================================================

function renderizarCategorias() {
  const contenedor = document.getElementById('filtrosCategorias');
  if (!datosMenu || !datosMenu.categorias || !contenedor) return;
  
  let html = `
    <button class="filtro-categoria activo" data-categoria="todos" role="tab" aria-selected="true">
      <span class="filtro-icono">🍽️</span>
      Todos
    </button>
  `;
  
  datosMenu.categorias.forEach(cat => {
    html += `
      <button class="filtro-categoria" data-categoria="${cat.id}" role="tab" aria-selected="false">
        <span class="filtro-icono">${cat.icono}</span>
        ${cat.nombre}
      </button>
    `;
  });
  
  contenedor.innerHTML = html;
  
  // Event listeners para filtros
  contenedor.querySelectorAll('.filtro-categoria').forEach(boton => {
    boton.onclick = () => {
      contenedor.querySelectorAll('.filtro-categoria').forEach(b => {
        b.classList.remove('activo');
        b.setAttribute('aria-selected', 'false');
      });
      boton.classList.add('activo');
      boton.setAttribute('aria-selected', 'true');
      categoriaActual = boton.getAttribute('data-categoria');
      filtrarYRenderizarPlatos();
    };
  });
}

// ==========================================================
// FILTRADO Y RENDERIZADO DE PLATOS
// ==========================================================

function filtrarYRenderizarPlatos() {
  if (!datosMenu || !datosMenu.platos) return;

  const buscador = document.getElementById('buscadorPlatos');
  const busqueda = buscador ? buscador.value.toLowerCase().trim() : '';

  platosFiltrados = datosMenu.platos.filter(plato => {
    // Filtro por categoría
    const cumpleCategoria = categoriaActual === 'todos' || plato.categoria === categoriaActual;

    // Filtro por búsqueda
    const cumpleBusqueda = !busqueda ||
      plato.nombre.toLowerCase().includes(busqueda) ||
      plato.descripcion.toLowerCase().includes(busqueda);

    // Filtro por etiqueta/estado
    let cumpleEtiqueta = true;
    if (sistemaEtiquetasListo && etiquetaFiltroActual !== 'todos') {
      if (etiquetaFiltroActual === 'disponible') {
        // Mostrar solo platos disponibles (sin etiqueta agotado ni proximamente)
        cumpleEtiqueta = !estaAgotado(plato.id) && !tieneEtiqueta(plato.id, 'proximamente');
      } else if (etiquetaFiltroActual === 'promociones') {
        // Mostrar platos con promociones (nuevo, popular, 2x1, descuento, recomendado)
        cumpleEtiqueta = tieneEtiqueta(plato.id, 'nuevo') ||
                         tieneEtiqueta(plato.id, 'popular') ||
                         tieneEtiqueta(plato.id, '2x1') ||
                         tieneEtiqueta(plato.id, 'descuento') ||
                         tieneEtiqueta(plato.id, 'recomendado');
      } else if (etiquetaFiltroActual === 'agotado') {
        // Mostrar solo platos agotados
        cumpleEtiqueta = estaAgotado(plato.id);
      }
    }

    return cumpleCategoria && cumpleBusqueda && cumpleEtiqueta;
  });

  renderizarPlatos();
  actualizarContador();
}

function renderizarPlatos() {
  const grilla = document.getElementById('grillaPlatos');
  const sinResultados = document.getElementById('sinResultados');
  
  if (!grilla) return;
  
  if (platosFiltrados.length === 0) {
    grilla.innerHTML = '';
    if (sinResultados) sinResultados.style.display = 'block';
    return;
  }
  
  if (sinResultados) sinResultados.style.display = 'none';
  
  if (vistaActual === 'detallada') {
    grilla.classList.remove('vista-simple');
    grilla.innerHTML = platosFiltrados.map(plato => crearTarjetaDetallada(plato)).join('');
  } else {
    grilla.classList.add('vista-simple');
    grilla.innerHTML = platosFiltrados.map(plato => crearTarjetaSimple(plato)).join('');
  }
  
  // Agregar event listeners
  agregarEventListenersPlatos();
}

function crearTarjetaDetallada(plato) {
  const categoria = datosMenu.categorias.find(c => c.id === plato.categoria);
  const nombreCategoria = categoria ? categoria.nombre : plato.categoria;

  // Verificar si el plato está agotado
  const platoAgotado = sistemaEtiquetasListo && estaAgotado(plato.id);
  const claseAgotado = platoAgotado ? 'agotado' : '';

  // Generar etiquetas si el sistema está listo
  const htmlEtiquetas = sistemaEtiquetasListo ? generarHTMLEtiquetas(plato.id) : '';

  // Badge de temporalmente agotado
  const badgeAgotado = platoAgotado ? '<div class="badge-agotado-overlay">Temporalmente agotado</div>' : '';

  return `
    <article class="tarjeta-plato ${claseAgotado}" data-plato-id="${plato.id}" tabindex="0">
      <div class="tarjeta-plato-imagen" data-plato-id="${plato.id}">
        ${htmlEtiquetas}
        <img src="${plato.imagen}" alt="${plato.nombre}" loading="lazy">
        <span class="badge-categoria">${nombreCategoria}</span>
        ${badgeAgotado}
      </div>
      <div class="tarjeta-plato-contenido">
        <h3 class="tarjeta-plato-nombre">${plato.nombre}</h3>
        <p class="tarjeta-plato-descripcion">${plato.descripcion}</p>
        <div class="tarjeta-plato-footer">
          <span class="tarjeta-plato-precio">S/ ${plato.precio.toFixed(2)}</span>
          <button class="btn-agregar-rapido" data-plato-id="${plato.id}" aria-label="Agregar ${plato.nombre} al carrito" ${platoAgotado ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

function crearTarjetaSimple(plato) {
  // Obtener icono de la categoría del plato
  const categoria = datosMenu.categorias.find(c => c.id === plato.categoria);
  const iconoCategoria = categoria ? categoria.icono : '🍽️';

  // Verificar si el plato está agotado
  const platoAgotado = sistemaEtiquetasListo && estaAgotado(plato.id);
  const claseAgotado = platoAgotado ? 'agotado' : '';

  // Generar indicadores compactos para vista simple (solo puntos de colores)
  let indicadoresHtml = '';
  if (sistemaEtiquetasListo) {
    const indicadores = [];

    // Indicador de promoción (nuevo, popular, 2x1, descuento, recomendado)
    if (tieneEtiqueta(plato.id, 'nuevo')) {
      indicadores.push('<span class="indicador-simple nuevo" title="Nuevo"></span>');
    } else if (tieneEtiqueta(plato.id, 'popular')) {
      indicadores.push('<span class="indicador-simple popular" title="Popular"></span>');
    } else if (tieneEtiqueta(plato.id, '2x1') || tieneEtiqueta(plato.id, 'descuento')) {
      indicadores.push('<span class="indicador-simple promo" title="Promoción"></span>');
    }

    if (indicadores.length > 0) {
      indicadoresHtml = `<div class="indicadores-simple">${indicadores.join('')}</div>`;
    }
  }

  return `
    <div class="tarjeta-plato-simple ${claseAgotado}" data-plato-id="${plato.id}" tabindex="0">
      <div class="plato-simple-info">
        <span class="plato-simple-icono">${iconoCategoria}</span>
        <span class="plato-simple-nombre">${plato.nombre}</span>
      </div>
      <div class="plato-simple-acciones">
        ${indicadoresHtml}
        <span class="plato-simple-precio">S/ ${plato.precio.toFixed(2)}</span>
        <button class="btn-agregar-simple" data-plato-id="${plato.id}" aria-label="Agregar ${plato.nombre}" ${platoAgotado ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function agregarEventListenersPlatos() {
  // Botones de agregar rápido (vista detallada)
  document.querySelectorAll('.btn-agregar-rapido').forEach(boton => {
    boton.onclick = (e) => {
      e.stopPropagation();
      const platoId = boton.getAttribute('data-plato-id');
      abrirModalPlato(platoId);
    };
  });
  
  // Botones de agregar simple
  document.querySelectorAll('.btn-agregar-simple').forEach(boton => {
    boton.onclick = (e) => {
      e.stopPropagation();
      const platoId = boton.getAttribute('data-plato-id');
      abrirModalPlato(platoId);
    };
  });
  
  // Click en imagen de tarjeta (abre vista previa)
  document.querySelectorAll('.tarjeta-plato-imagen').forEach(imagen => {
    imagen.onclick = (e) => {
      e.stopPropagation();
      const platoId = imagen.getAttribute('data-plato-id');
      abrirModalVistaPrevia(platoId);
    };
  });

  // Click en tarjetas (abre modal de personalización)
  document.querySelectorAll('.tarjeta-plato').forEach(tarjeta => {
    tarjeta.onclick = (e) => {
      if (!e.target.closest('button') && !e.target.closest('.tarjeta-plato-imagen')) {
        const platoId = tarjeta.getAttribute('data-plato-id');
        abrirModalPlato(platoId);
      }
    };
  });
  
  document.querySelectorAll('.tarjeta-plato-simple').forEach(tarjeta => {
    tarjeta.onclick = (e) => {
      if (!e.target.closest('button')) {
        const platoId = tarjeta.getAttribute('data-plato-id');
        abrirModalPlato(platoId);
      }
    };
  });
}

function actualizarContador() {
  const contador = document.getElementById('numResultados');
  if (contador) {
    contador.textContent = platosFiltrados.length;
  }
}

// ==========================================================
// MODAL DE VISTA PREVIA
// ==========================================================

function inicializarModalVistaPrevia() {
  const modal = document.getElementById('modalVistaPrevia');
  if (!modal) return;

  const btnCerrar = document.getElementById('btnCerrarVistaPrevia');
  const overlay = modal.querySelector('.modal-overlay-vista');
  const btnAgregar = document.getElementById('btnAgregarDesdeVista');

  if (btnCerrar) {
    btnCerrar.onclick = cerrarModalVistaPrevia;
  }

  if (overlay) {
    overlay.onclick = cerrarModalVistaPrevia;
  }

  if (btnAgregar) {
    btnAgregar.onclick = () => {
      const platoId = btnAgregar.getAttribute('data-plato-id');
      cerrarModalVistaPrevia();
      setTimeout(() => {
        abrirModalPlato(platoId);
      }, 300);
    };
  }

  // Eventos de galería
  const btnAnterior = document.getElementById('btnGaleriaAnterior');
  const btnSiguiente = document.getElementById('btnGaleriaSiguiente');

  if (btnAnterior) {
    btnAnterior.onclick = (e) => {
      e.stopPropagation();
      navegarGaleria(-1);
    };
  }

  if (btnSiguiente) {
    btnSiguiente.onclick = (e) => {
      e.stopPropagation();
      navegarGaleria(1);
    };
  }

  document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('activo')) {
      if (e.key === 'Escape') {
        cerrarModalVistaPrevia();
      } else if (e.key === 'ArrowLeft' && galeriaImagenes.length > 1) {
        navegarGaleria(-1);
      } else if (e.key === 'ArrowRight' && galeriaImagenes.length > 1) {
        navegarGaleria(1);
      }
    }
  });
}

function abrirModalVistaPrevia(platoId) {
  if (!datosMenu || !datosMenu.platos) return;

  const plato = datosMenu.platos.find(p => p.id === platoId);
  if (!plato) return;

  const modal = document.getElementById('modalVistaPrevia');
  if (!modal) return;

  // Configurar galería de imágenes
  if (plato.imagenes && Array.isArray(plato.imagenes) && plato.imagenes.length > 0) {
    galeriaImagenes = plato.imagenes;
  } else {
    galeriaImagenes = [plato.imagen];
  }
  galeriaIndiceActual = 0;

  const img = document.getElementById('vistaPreviaImg');
  const titulo = document.getElementById('vistaPreviaTitulo');
  const precio = document.getElementById('vistaPreviaPrecio');
  const descripcion = document.getElementById('vistaPreviaDescripcion');
  const btnAgregar = document.getElementById('btnAgregarDesdeVista');

  if (img) {
    img.src = galeriaImagenes[0];
    img.alt = plato.nombre;
  }
  if (titulo) titulo.textContent = plato.nombre;
  if (precio) precio.textContent = `S/ ${plato.precio.toFixed(2)}`;
  if (descripcion) descripcion.textContent = plato.descripcion;
  if (btnAgregar) btnAgregar.setAttribute('data-plato-id', platoId);

  // Configurar controles de galería
  configurarControlesGaleria();

  modal.classList.add('activo');
  document.body.style.overflow = 'hidden';
}

/**
 * Configura la visibilidad y estado de los controles de galería
 */
function configurarControlesGaleria() {
  const btnAnterior = document.getElementById('btnGaleriaAnterior');
  const btnSiguiente = document.getElementById('btnGaleriaSiguiente');
  const indicadores = document.getElementById('galeriaIndicadores');
  const contador = document.getElementById('galeriaContador');

  const tieneMultiples = galeriaImagenes.length > 1;

  // Mostrar/ocultar botones de navegación
  if (btnAnterior) {
    btnAnterior.style.display = tieneMultiples ? 'flex' : 'none';
  }
  if (btnSiguiente) {
    btnSiguiente.style.display = tieneMultiples ? 'flex' : 'none';
  }

  // Mostrar/ocultar contador
  if (contador) {
    contador.style.display = tieneMultiples ? 'block' : 'none';
    contador.textContent = `1/${galeriaImagenes.length}`;
  }

  // Generar indicadores
  if (indicadores) {
    if (tieneMultiples) {
      indicadores.style.display = 'flex';
      indicadores.innerHTML = galeriaImagenes.map((_, index) => `
        <button class="galeria-indicador ${index === 0 ? 'activo' : ''}"
                data-index="${index}"
                aria-label="Ir a imagen ${index + 1}">
        </button>
      `).join('');

      // Agregar eventos a indicadores
      indicadores.querySelectorAll('.galeria-indicador').forEach(indicador => {
        indicador.onclick = (e) => {
          e.stopPropagation();
          const index = parseInt(indicador.getAttribute('data-index'));
          irAImagenGaleria(index);
        };
      });
    } else {
      indicadores.style.display = 'none';
      indicadores.innerHTML = '';
    }
  }
}

/**
 * Navega a la imagen anterior o siguiente
 */
function navegarGaleria(direccion) {
  if (galeriaImagenes.length <= 1) return;

  let nuevoIndice = galeriaIndiceActual + direccion;

  // Loop circular
  if (nuevoIndice < 0) {
    nuevoIndice = galeriaImagenes.length - 1;
  } else if (nuevoIndice >= galeriaImagenes.length) {
    nuevoIndice = 0;
  }

  irAImagenGaleria(nuevoIndice);
}

/**
 * Va a una imagen específica de la galería
 */
function irAImagenGaleria(indice) {
  if (indice < 0 || indice >= galeriaImagenes.length) return;

  galeriaIndiceActual = indice;

  const img = document.getElementById('vistaPreviaImg');
  const contador = document.getElementById('galeriaContador');
  const indicadores = document.getElementById('galeriaIndicadores');

  // Animación de cambio
  if (img) {
    img.classList.add('cambiando');
    setTimeout(() => {
      img.src = galeriaImagenes[indice];
      img.classList.remove('cambiando');
    }, 150);
  }

  // Actualizar contador
  if (contador) {
    contador.textContent = `${indice + 1}/${galeriaImagenes.length}`;
  }

  // Actualizar indicadores
  if (indicadores) {
    indicadores.querySelectorAll('.galeria-indicador').forEach((indicador, i) => {
      indicador.classList.toggle('activo', i === indice);
    });
  }
}

function cerrarModalVistaPrevia() {
  const modal = document.getElementById('modalVistaPrevia');
  if (modal) {
    modal.classList.remove('activo');
    document.body.style.overflow = 'auto';
  }
}

// ==========================================================
// MODAL DE PERSONALIZACIÓN
// ==========================================================

function inicializarModalPlato() {
  const modal = document.getElementById('modalPlato');
  if (!modal) return;
  
  const btnCerrar = document.getElementById('btnCerrarModalPlato');
  const overlay = modal.querySelector('.modal-overlay-plato');
  
  if (btnCerrar) {
    btnCerrar.onclick = cerrarModalPlato;
  }
  
  if (overlay) {
    overlay.onclick = cerrarModalPlato;
  }
  
  // Controles de cantidad
  const btnRestar = document.getElementById('btnRestarCantidad');
  const btnSumar = document.getElementById('btnSumarCantidad');
  
  if (btnRestar) {
    btnRestar.onclick = () => {
      if (cantidadSeleccionada > 1) {
        cantidadSeleccionada--;
        actualizarCantidadModal();
      }
    };
  }
  
  if (btnSumar) {
    btnSumar.onclick = () => {
      if (cantidadSeleccionada < 99) {
        cantidadSeleccionada++;
        actualizarCantidadModal();
      }
    };
  }
  
  // Observación
  const observacion = document.getElementById('observacionPlato');
  if (observacion) {
    observacion.oninput = () => {
      const contador = document.getElementById('contadorObservacion');
      if (contador) {
        contador.textContent = observacion.value.length;
      }
    };
  }
  
  // Botón agregar al carrito
  const btnAgregar = document.getElementById('btnAgregarCarrito');
  if (btnAgregar) {
    btnAgregar.onclick = agregarAlCarrito;
  }
  
  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('activo')) {
      cerrarModalPlato();
    }
  });
}

function abrirModalPlato(platoId) {
  if (!datosMenu || !datosMenu.platos) return;
  
  const plato = datosMenu.platos.find(p => p.id === platoId);
  if (!plato) return;
  
  platoSeleccionado = plato;
  cantidadSeleccionada = 1;
  
  const modal = document.getElementById('modalPlato');
  if (!modal) return;
  
  // Llenar información básica
  const img = document.getElementById('modalPlatoImg');
  const titulo = document.getElementById('modalPlatoTitulo');
  const precio = document.getElementById('modalPlatoPrecio');
  const descripcion = document.getElementById('modalPlatoDescripcion');
  
  if (img) {
    img.src = plato.imagen;
    img.alt = plato.nombre;
  }
  if (titulo) titulo.textContent = plato.nombre;
  if (precio) precio.textContent = `S/ ${plato.precio.toFixed(2)}`;
  if (descripcion) descripcion.textContent = plato.descripcion;

  // Renderizar etiquetas en el modal
  renderizarEtiquetasModal(plato.id);

  // Renderizar opciones
  renderizarOpciones(plato);
  
  // Renderizar guarniciones
  renderizarGuarniciones(plato);
  
  // Mostrar observación
  const observacionContainer = document.getElementById('modalObservacionContainer');
  if (observacionContainer) {
    observacionContainer.style.display = 'block';
  }
  const observacionInput = document.getElementById('observacionPlato');
  if (observacionInput) {
    observacionInput.value = '';
  }
  const contadorObs = document.getElementById('contadorObservacion');
  if (contadorObs) {
    contadorObs.textContent = '0';
  }
  
  // Resetear cantidad
  actualizarCantidadModal();
  
  // Mostrar modal
  modal.classList.add('activo');
  document.body.style.overflow = 'hidden';
}

function cerrarModalPlato() {
  const modal = document.getElementById('modalPlato');
  if (modal) {
    modal.classList.remove('activo');
    document.body.style.overflow = 'auto';
  }
  platoSeleccionado = null;
}

function renderizarOpciones(plato) {
  const contenedor = document.getElementById('modalOpcionesContainer');
  if (!contenedor) return;
  
  contenedor.innerHTML = '';
  
  if (!plato.opciones || Object.keys(plato.opciones).length === 0) {
    return;
  }
  
  Object.entries(plato.opciones).forEach(([key, valores]) => {
    const nombreOpcion = formatearNombreOpcion(key);
    
    let html = `
      <div class="opcion-grupo">
        <h4>${nombreOpcion}</h4>
        <div class="opcion-lista">
    `;
    
    valores.forEach((valor, index) => {
      const checked = index === 0 ? 'checked' : '';
      html += `
        <div class="opcion-item">
          <input type="radio" 
                 id="opcion_${key}_${index}" 
                 name="opcion_${key}" 
                 value="${valor}"
                 ${checked}>
          <label for="opcion_${key}_${index}">${valor}</label>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    contenedor.innerHTML += html;
  });
}

function formatearNombreOpcion(key) {
  const nombres = {
    'picante': 'Nivel de Picante',
    'termino': 'Término de Cocción',
    'temperatura': 'Temperatura',
    'tamanio': 'Tamaño',
    'tipo': 'Tipo'
  };
  return nombres[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Renderiza las etiquetas en el modal del plato
 */
function renderizarEtiquetasModal(platoId) {
  // Buscar o crear contenedor de etiquetas en el modal
  let contenedor = document.getElementById('modalEtiquetasContainer');

  if (!contenedor) {
    // Crear contenedor si no existe
    const modalHeader = document.querySelector('.modal-plato-header');
    if (modalHeader) {
      contenedor = document.createElement('div');
      contenedor.id = 'modalEtiquetasContainer';
      contenedor.className = 'modal-etiquetas-container';
      modalHeader.insertAdjacentElement('afterend', contenedor);
    }
  }

  if (!contenedor) return;

  // Generar y mostrar etiquetas
  if (sistemaEtiquetasListo) {
    const htmlEtiquetas = generarHTMLEtiquetasModal(platoId);
    contenedor.innerHTML = htmlEtiquetas;
    contenedor.style.display = htmlEtiquetas ? 'block' : 'none';
  } else {
    contenedor.style.display = 'none';
  }
}

function renderizarGuarniciones(plato) {
  const contenedor = document.getElementById('modalGuarnicionesContainer');
  const lista = document.getElementById('listaGuarniciones');
  
  if (!contenedor || !lista) return;
  
  // Verificar si el plato tiene guarniciones definidas
  if (!plato.guarniciones || !plato.guarniciones.lista || plato.guarniciones.lista.length === 0) {
    contenedor.style.display = 'none';
    return;
  }
  
  contenedor.style.display = 'block';
  lista.innerHTML = '';
  
  const maxGuarniciones = plato.guarniciones.max || 2;
  
  // Usar las guarniciones específicas del plato
  plato.guarniciones.lista.forEach((guarnicion, index) => {
    lista.innerHTML += `
      <div class="guarnicion-item">
        <input type="checkbox" 
               id="guarnicion_${index}" 
               value="${guarnicion}"
               data-max="${maxGuarniciones}"
               onchange="verificarLimiteGuarniciones(${maxGuarniciones})">
        <label for="guarnicion_${index}">${guarnicion}</label>
      </div>
    `;
  });
  
  // Actualizar el texto del contador
  const contadorTexto = document.getElementById('contadorGuarniciones');
  if (contadorTexto) {
    contadorTexto.textContent = `0/${maxGuarniciones} seleccionadas`;
  }
  
  actualizarContadorGuarniciones(maxGuarniciones);
}

function verificarLimiteGuarniciones(max) {
  const limite = max || 2;
  const checkboxes = document.querySelectorAll('#listaGuarniciones input[type="checkbox"]');
  const seleccionadas = Array.from(checkboxes).filter(cb => cb.checked).length;
  
  checkboxes.forEach(cb => {
    if (!cb.checked && seleccionadas >= limite) {
      cb.disabled = true;
    } else {
      cb.disabled = false;
    }
  });
  
  actualizarContadorGuarniciones(limite);
}

function actualizarContadorGuarniciones(max) {
  const limite = max || 2;
  const checkboxes = document.querySelectorAll('#listaGuarniciones input[type="checkbox"]');
  const seleccionadas = Array.from(checkboxes).filter(cb => cb.checked).length;
  const contador = document.getElementById('contadorGuarniciones');
  
  if (contador) {
    contador.textContent = `${seleccionadas}/${limite} seleccionadas`;
    
    if (seleccionadas >= limite) {
      contador.classList.add('limite');
    } else {
      contador.classList.remove('limite');
    }
  }
}

function actualizarCantidadModal() {
  const cantidadElem = document.getElementById('cantidadPlato');
  if (cantidadElem) {
    cantidadElem.textContent = cantidadSeleccionada;
  }
  
  const btnRestar = document.getElementById('btnRestarCantidad');
  if (btnRestar) {
    btnRestar.disabled = cantidadSeleccionada <= 1;
  }
  
  if (platoSeleccionado) {
    const subtotal = platoSeleccionado.precio * cantidadSeleccionada;
    const subtotalElem = document.getElementById('modalSubtotal');
    if (subtotalElem) {
      subtotalElem.textContent = `S/ ${subtotal.toFixed(2)}`;
    }
  }
}

// ==========================================================
// AGREGAR AL CARRITO
// ==========================================================

function agregarAlCarrito() {
  if (!platoSeleccionado) return;
  
  // Recopilar opciones seleccionadas
  const opcionesSeleccionadas = {};
  
  if (platoSeleccionado.opciones) {
    Object.keys(platoSeleccionado.opciones).forEach(key => {
      const radio = document.querySelector(`input[name="opcion_${key}"]:checked`);
      if (radio) {
        opcionesSeleccionadas[key] = radio.value;
      }
    });
  }
  
  // Recopilar guarniciones
  const guarnicionesSeleccionadas = [];
  const checkboxes = document.querySelectorAll('#listaGuarniciones input[type="checkbox"]:checked');
  checkboxes.forEach(cb => {
    guarnicionesSeleccionadas.push(cb.value);
  });
  
  // Obtener observación
  const observacionInput = document.getElementById('observacionPlato');
  const observacion = observacionInput ? observacionInput.value.trim() : '';
  
  // Crear item del carrito
  const item = {
    id: platoSeleccionado.id,
    nombre: platoSeleccionado.nombre,
    precio: platoSeleccionado.precio,
    cantidad: cantidadSeleccionada,
    opciones: opcionesSeleccionadas,
    guarniciones: guarnicionesSeleccionadas,
    observacion: observacion,
    subtotal: platoSeleccionado.precio * cantidadSeleccionada
  };
  
  // Agregar al carrito (función del carrito.js)
  if (typeof agregarItemCarrito === 'function') {
    agregarItemCarrito(item);
  }
  
  // Mostrar notificación
  mostrarToast(`${platoSeleccionado.nombre} agregado al pedido`);
  
  // Cerrar modal
  cerrarModalPlato();
}

// ==========================================================
// NOTIFICACIONES TOAST
// ==========================================================

function mostrarToast(mensaje) {
  const toast = document.getElementById('toastNotificacion');
  const toastMensaje = document.getElementById('toastMensaje');
  
  if (toast && toastMensaje) {
    toastMensaje.textContent = mensaje;
    toast.classList.add('mostrar');
    
    setTimeout(() => {
      toast.classList.remove('mostrar');
    }, 3000);
  }
}

// ==========================================================
// EXPORTAR FUNCIONES GLOBALES
// ==========================================================

window.mostrarToast = mostrarToast;
window.verificarLimiteGuarniciones = verificarLimiteGuarniciones;
window.abrirModalPlato = abrirModalPlato;
window.abrirModalVistaPrevia = abrirModalVistaPrevia;
window.cerrarModalPlato = cerrarModalPlato;
window.cerrarModalVistaPrevia = cerrarModalVistaPrevia;
window.navegarGaleria = navegarGaleria;
window.irAImagenGaleria = irAImagenGaleria;
