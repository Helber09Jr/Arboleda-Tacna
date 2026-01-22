/* ==========================================================
   CARTA-HIBRIDO.JS - SISTEMA HÍBRIDO DE ETIQUETAS
   La Arboleda Club - Tacna, Perú

   Este módulo combina datos estáticos del JSON con datos
   dinámicos de Firebase para mostrar etiquetas en tiempo real.

   Características:
   - Caché local con expiración configurable
   - Listener en tiempo real para actualizaciones
   - Fallback a datos locales si Firebase falla
   - Optimizado para rendimiento
   ========================================================== */

import {
  db,
  collection,
  getDocs,
  onSnapshot,
  query,
  where
} from './firebase-config.js';

// ==========================================================
// CONFIGURACIÓN
// ==========================================================

const CONFIG = {
  // Tiempo de caché en milisegundos (5 minutos)
  tiempoCacheMs: 5 * 60 * 1000,

  // Clave de localStorage para caché
  claveCache: 'arboleda_etiquetas_cache_v1',
  claveCacheEstados: 'arboleda_estados_cache_v1',

  // Habilitar logs de debug
  debug: false
};

// ==========================================================
// ESTADO GLOBAL DEL MÓDULO
// ==========================================================

let etiquetasMap = new Map();
let estadosPlatosMap = new Map();
let listenerActivo = null;
let cacheValido = false;

// ==========================================================
// FUNCIONES DE CACHÉ
// ==========================================================

/**
 * Guarda datos en caché local
 */
function guardarEnCache(clave, datos) {
  try {
    const cacheData = {
      datos: datos,
      timestamp: Date.now()
    };
    localStorage.setItem(clave, JSON.stringify(cacheData));

    if (CONFIG.debug) {
      console.log(`💾 Caché guardado: ${clave}`);
    }
  } catch (error) {
    console.warn('Error guardando caché:', error);
  }
}

/**
 * Obtiene datos del caché si son válidos
 */
function obtenerDeCache(clave) {
  try {
    const cached = localStorage.getItem(clave);
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    const ahora = Date.now();
    const edad = ahora - cacheData.timestamp;

    if (edad < CONFIG.tiempoCacheMs) {
      if (CONFIG.debug) {
        console.log(`📦 Caché válido: ${clave} (${Math.round(edad / 1000)}s)`);
      }
      return cacheData.datos;
    }

    if (CONFIG.debug) {
      console.log(`⏰ Caché expirado: ${clave}`);
    }
    return null;

  } catch (error) {
    console.warn('Error leyendo caché:', error);
    return null;
  }
}

/**
 * Limpia todo el caché
 */
function limpiarCache() {
  localStorage.removeItem(CONFIG.claveCache);
  localStorage.removeItem(CONFIG.claveCacheEstados);
  cacheValido = false;

  if (CONFIG.debug) {
    console.log('🗑️ Caché limpiado');
  }
}

// ==========================================================
// CARGA DE DATOS DESDE FIREBASE
// ==========================================================

/**
 * Carga las etiquetas desde Firebase
 */
async function cargarEtiquetasFirebase() {
  try {
    // Intentar desde caché primero
    const cacheEtiquetas = obtenerDeCache(CONFIG.claveCache);
    if (cacheEtiquetas) {
      etiquetasMap = new Map(Object.entries(cacheEtiquetas));
      return true;
    }

    // Cargar desde Firebase
    const etiquetasRef = collection(db, 'etiquetas');
    const snapshot = await getDocs(etiquetasRef);

    if (snapshot.empty) {
      console.warn('⚠️ No hay etiquetas en Firebase');
      return false;
    }

    const etiquetasObj = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.activo !== false) {
        etiquetasObj[doc.id] = data;
        etiquetasMap.set(doc.id, data);
      }
    });

    // Guardar en caché
    guardarEnCache(CONFIG.claveCache, etiquetasObj);

    if (CONFIG.debug) {
      console.log(`✅ ${etiquetasMap.size} etiquetas cargadas desde Firebase`);
    }

    return true;

  } catch (error) {
    console.error('Error cargando etiquetas:', error);
    return false;
  }
}

/**
 * Carga los estados de platos desde Firebase
 */
async function cargarEstadosPlatosFirebase() {
  try {
    // Intentar desde caché primero
    const cacheEstados = obtenerDeCache(CONFIG.claveCacheEstados);
    if (cacheEstados) {
      estadosPlatosMap = new Map(Object.entries(cacheEstados));
      cacheValido = true;
      return true;
    }

    // Cargar desde Firebase
    const estadosRef = collection(db, 'estadosPlatos');
    const snapshot = await getDocs(estadosRef);

    if (snapshot.empty) {
      console.warn('⚠️ No hay estados de platos en Firebase');
      return false;
    }

    const estadosObj = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.activo !== false) {
        estadosObj[doc.id] = data;
        estadosPlatosMap.set(doc.id, data);
      }
    });

    // Guardar en caché
    guardarEnCache(CONFIG.claveCacheEstados, estadosObj);
    cacheValido = true;

    if (CONFIG.debug) {
      console.log(`✅ ${estadosPlatosMap.size} estados cargados desde Firebase`);
    }

    return true;

  } catch (error) {
    console.error('Error cargando estados:', error);
    return false;
  }
}

/**
 * Inicializa listener en tiempo real para cambios
 */
function iniciarListenerTiempoReal(callbackActualizacion) {
  if (listenerActivo) {
    listenerActivo();
    listenerActivo = null;
  }

  try {
    const estadosRef = collection(db, 'estadosPlatos');

    listenerActivo = onSnapshot(estadosRef, (snapshot) => {
      let cambios = false;

      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === 'added' || change.type === 'modified') {
          if (data.activo !== false) {
            estadosPlatosMap.set(id, data);
            cambios = true;
          }
        } else if (change.type === 'removed') {
          estadosPlatosMap.delete(id);
          cambios = true;
        }
      });

      if (cambios) {
        // Invalidar caché al recibir cambios
        limpiarCache();

        // Notificar al callback
        if (typeof callbackActualizacion === 'function') {
          callbackActualizacion();
        }

        if (CONFIG.debug) {
          console.log('🔄 Estados actualizados en tiempo real');
        }
      }
    }, (error) => {
      console.error('Error en listener de tiempo real:', error);
    });

    if (CONFIG.debug) {
      console.log('👂 Listener de tiempo real iniciado');
    }

  } catch (error) {
    console.error('Error iniciando listener:', error);
  }
}

/**
 * Detiene el listener de tiempo real
 */
function detenerListenerTiempoReal() {
  if (listenerActivo) {
    listenerActivo();
    listenerActivo = null;

    if (CONFIG.debug) {
      console.log('🔇 Listener de tiempo real detenido');
    }
  }
}

// ==========================================================
// FUNCIONES DE ACCESO A DATOS
// ==========================================================

/**
 * Obtiene las etiquetas de un plato específico
 */
function obtenerEtiquetasPlato(platoId) {
  const estado = estadosPlatosMap.get(platoId);
  if (!estado || !estado.etiquetas) {
    return [];
  }

  return estado.etiquetas
    .map(etiquetaId => etiquetasMap.get(etiquetaId))
    .filter(e => e != null)
    .sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0));
}

/**
 * Verifica si un plato está agotado
 */
function estaAgotado(platoId) {
  const estado = estadosPlatosMap.get(platoId);
  return estado?.etiquetas?.includes('agotado') || false;
}

/**
 * Verifica si un plato tiene una etiqueta específica
 */
function tieneEtiqueta(platoId, etiquetaId) {
  const estado = estadosPlatosMap.get(platoId);
  return estado?.etiquetas?.includes(etiquetaId) || false;
}

/**
 * Obtiene todas las etiquetas disponibles
 */
function obtenerTodasLasEtiquetas() {
  return Array.from(etiquetasMap.values());
}

/**
 * Obtiene etiquetas por tipo
 */
function obtenerEtiquetasPorTipo(tipo) {
  return Array.from(etiquetasMap.values())
    .filter(e => e.tipo === tipo);
}

// ==========================================================
// GENERACIÓN DE HTML PARA ETIQUETAS
// ==========================================================

/**
 * Genera el HTML de badges para un plato
 */
function generarHTMLEtiquetas(platoId, opciones = {}) {
  const {
    maxEtiquetas = 5,
    mostrarTooltip = true,
    claseContenedor = 'contenedor-etiquetas'
  } = opciones;

  const etiquetas = obtenerEtiquetasPlato(platoId);

  if (etiquetas.length === 0) {
    return '';
  }

  const etiquetasMostrar = etiquetas.slice(0, maxEtiquetas);

  const badges = etiquetasMostrar.map(etiqueta => {
    const claseEtiqueta = `etiqueta-${etiqueta.id}`;
    const tooltip = mostrarTooltip ? `data-tooltip="${etiqueta.descripcion}"` : '';

    return `
      <span class="etiqueta-badge ${claseEtiqueta}" ${tooltip}>
        ${etiqueta.icono ? `<span>${etiqueta.icono}</span>` : ''}
        ${etiqueta.nombre}
      </span>
    `;
  }).join('');

  return `<div class="${claseContenedor}">${badges}</div>`;
}

/**
 * Genera HTML de etiquetas para el modal
 */
function generarHTMLEtiquetasModal(platoId) {
  return generarHTMLEtiquetas(platoId, {
    maxEtiquetas: 10,
    mostrarTooltip: false,
    claseContenedor: 'modal-etiquetas'
  });
}

// ==========================================================
// INICIALIZACIÓN DEL SISTEMA
// ==========================================================

/**
 * Inicializa el sistema híbrido de etiquetas
 */
async function inicializarSistemaEtiquetas(callbackActualizacion = null) {
  console.log('🏷️ Inicializando sistema de etiquetas...');

  try {
    // Cargar datos
    const [etiquetasOk, estadosOk] = await Promise.all([
      cargarEtiquetasFirebase(),
      cargarEstadosPlatosFirebase()
    ]);

    if (!etiquetasOk || !estadosOk) {
      console.warn('⚠️ Sistema de etiquetas parcialmente inicializado');
    }

    // Iniciar listener de tiempo real
    if (callbackActualizacion) {
      iniciarListenerTiempoReal(callbackActualizacion);
    }

    console.log(`✅ Sistema de etiquetas listo: ${etiquetasMap.size} etiquetas, ${estadosPlatosMap.size} estados`);

    return {
      exito: true,
      etiquetas: etiquetasMap.size,
      estados: estadosPlatosMap.size
    };

  } catch (error) {
    console.error('❌ Error inicializando sistema de etiquetas:', error);

    return {
      exito: false,
      error: error.message
    };
  }
}

// ==========================================================
// FUNCIONES DE FILTRADO POR ETIQUETAS
// ==========================================================

/**
 * Filtra platos por etiqueta
 */
function filtrarPlatosPorEtiqueta(platos, etiquetaId) {
  if (!etiquetaId || etiquetaId === 'todos') {
    return platos;
  }

  return platos.filter(plato => tieneEtiqueta(plato.id, etiquetaId));
}

/**
 * Obtiene platos agotados
 */
function obtenerPlatosAgotados() {
  const agotados = [];
  estadosPlatosMap.forEach((estado, platoId) => {
    if (estado.etiquetas?.includes('agotado')) {
      agotados.push(platoId);
    }
  });
  return agotados;
}

/**
 * Obtiene platos por tipo de etiqueta
 */
function obtenerPlatosPorTipoEtiqueta(tipo) {
  const etiquetasDelTipo = obtenerEtiquetasPorTipo(tipo);
  const etiquetaIds = etiquetasDelTipo.map(e => e.id);

  const platos = [];
  estadosPlatosMap.forEach((estado, platoId) => {
    const tieneAlguna = estado.etiquetas?.some(e => etiquetaIds.includes(e));
    if (tieneAlguna) {
      platos.push(platoId);
    }
  });

  return platos;
}

// ==========================================================
// INTEGRACIÓN CON CARTA.JS
// ==========================================================

/**
 * Modifica una tarjeta de plato existente para agregar etiquetas
 */
function agregarEtiquetasATarjeta(tarjetaElement, platoId) {
  if (!tarjetaElement) return;

  // Verificar si ya tiene etiquetas
  const existente = tarjetaElement.querySelector('.contenedor-etiquetas');
  if (existente) {
    existente.remove();
  }

  // Generar nuevas etiquetas
  const htmlEtiquetas = generarHTMLEtiquetas(platoId);
  if (!htmlEtiquetas) return;

  // Insertar en la tarjeta
  const imagenContainer = tarjetaElement.querySelector('.tarjeta-plato-imagen');
  if (imagenContainer) {
    imagenContainer.insertAdjacentHTML('afterbegin', htmlEtiquetas);
  } else {
    // Para vista simple
    tarjetaElement.insertAdjacentHTML('afterbegin', htmlEtiquetas);
  }

  // Marcar como agotado si aplica
  if (estaAgotado(platoId)) {
    tarjetaElement.classList.add('agotado');
  } else {
    tarjetaElement.classList.remove('agotado');
  }
}

/**
 * Actualiza todas las etiquetas en la grilla
 */
function actualizarEtiquetasEnGrilla() {
  const tarjetas = document.querySelectorAll('[data-plato-id]');

  tarjetas.forEach(tarjeta => {
    const platoId = tarjeta.getAttribute('data-plato-id');
    if (platoId) {
      agregarEtiquetasATarjeta(tarjeta, platoId);
    }
  });

  if (CONFIG.debug) {
    console.log(`🔄 Etiquetas actualizadas en ${tarjetas.length} tarjetas`);
  }
}

// ==========================================================
// EXPORTAR API PÚBLICA
// ==========================================================

export {
  // Inicialización
  inicializarSistemaEtiquetas,
  detenerListenerTiempoReal,
  limpiarCache,

  // Acceso a datos
  obtenerEtiquetasPlato,
  obtenerTodasLasEtiquetas,
  obtenerEtiquetasPorTipo,
  estaAgotado,
  tieneEtiqueta,

  // Generación de HTML
  generarHTMLEtiquetas,
  generarHTMLEtiquetasModal,

  // Filtrado
  filtrarPlatosPorEtiqueta,
  obtenerPlatosAgotados,
  obtenerPlatosPorTipoEtiqueta,

  // Integración
  agregarEtiquetasATarjeta,
  actualizarEtiquetasEnGrilla,

  // Configuración
  CONFIG
};

// Hacer disponibles algunas funciones globalmente para debug
if (typeof window !== 'undefined') {
  window.sistemaEtiquetas = {
    obtenerEtiquetasPlato,
    estaAgotado,
    tieneEtiqueta,
    obtenerTodasLasEtiquetas,
    limpiarCache,
    actualizarEtiquetasEnGrilla
  };
}
