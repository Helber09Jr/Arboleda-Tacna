

import {
  db,
  collection,
  doc,
  setDoc,
  getDocs,
  serverTimestamp
} from './firebase-config.js';

// ==========================================================
// DEFINICIÓN DE LAS 15 ETIQUETAS
// ==========================================================

const ETIQUETAS_BASE = [
  // Estados de disponibilidad
  {
    id: 'disponible',
    nombre: 'Disponible',
    tipo: 'estado',
    icono: '✓',
    color: '#10b981',
    descripcion: 'Plato disponible para ordenar',
    prioridad: 1
  },
  {
    id: 'agotado',
    nombre: 'Agotado',
    tipo: 'estado',
    icono: '✗',
    color: '#ef4444',
    descripcion: 'Plato temporalmente no disponible',
    prioridad: 0
  },
  {
    id: 'proximamente',
    nombre: 'Próximamente',
    tipo: 'estado',
    icono: '⏳',
    color: '#8b5cf6',
    descripcion: 'Plato que se agregará pronto al menú',
    prioridad: 2
  },

  // Promociones
  {
    id: 'nuevo',
    nombre: 'Nuevo',
    tipo: 'promocion',
    icono: '★',
    color: '#3b82f6',
    descripcion: 'Plato recién agregado al menú',
    prioridad: 10
  },
  {
    id: 'popular',
    nombre: 'Popular',
    tipo: 'promocion',
    icono: '🔥',
    color: '#f59e0b',
    descripcion: 'Plato favorito de nuestros clientes',
    prioridad: 9
  },
  {
    id: '2x1',
    nombre: '2x1',
    tipo: 'promocion',
    icono: '🎉',
    color: '#ec4899',
    descripcion: 'Promoción 2x1 activa',
    prioridad: 11
  },
  {
    id: 'descuento',
    nombre: 'Descuento',
    tipo: 'promocion',
    icono: '%',
    color: '#14b8a6',
    descripcion: 'Plato con descuento especial',
    prioridad: 8
  },
  {
    id: 'recomendado',
    nombre: 'Recomendado',
    tipo: 'promocion',
    icono: '👨‍🍳',
    color: '#f97316',
    descripcion: 'Recomendación del chef',
    prioridad: 7
  },

  // Restricciones alimentarias
  {
    id: 'picante',
    nombre: 'Picante',
    tipo: 'restriccion',
    icono: '🌶️',
    color: '#dc2626',
    descripcion: 'Contiene ingredientes picantes',
    prioridad: 5
  },
  {
    id: 'vegetariano',
    nombre: 'Vegetariano',
    tipo: 'restriccion',
    icono: '🥬',
    color: '#22c55e',
    descripcion: 'Apto para vegetarianos',
    prioridad: 6
  },
  {
    id: 'vegano',
    nombre: 'Vegano',
    tipo: 'restriccion',
    icono: '🌱',
    color: '#16a34a',
    descripcion: 'Apto para veganos',
    prioridad: 6
  },
  {
    id: 'sin-gluten',
    nombre: 'Sin Gluten',
    tipo: 'restriccion',
    icono: '🌾',
    color: '#a855f7',
    descripcion: 'Libre de gluten',
    prioridad: 5
  },

  // Disponibilidad temporal
  {
    id: 'fin-semana',
    nombre: 'Solo Fin de Semana',
    tipo: 'disponibilidad',
    icono: '📅',
    color: '#6366f1',
    descripcion: 'Disponible solo sábados y domingos',
    prioridad: 3
  },
  {
    id: 'almuerzo',
    nombre: 'Solo Almuerzo',
    tipo: 'disponibilidad',
    icono: '☀️',
    color: '#0ea5e9',
    descripcion: 'Disponible solo en horario de almuerzo',
    prioridad: 3
  },
  {
    id: 'temporada',
    nombre: 'De Temporada',
    tipo: 'disponibilidad',
    icono: '🍂',
    color: '#f43f5e',
    descripcion: 'Plato de temporada limitada',
    prioridad: 4
  }
];

// ==========================================================
// ESTADOS INICIALES PARA 133 PLATOS
// Asignación estratégica de etiquetas por plato
// ==========================================================

const ESTADOS_PLATOS = [
  // === ENTRADAS (6 platos) ===
  { platoId: 'papa-huancaina', etiquetas: ['disponible', 'popular', 'vegetariano'] },
  { platoId: 'choclo-queso', etiquetas: ['disponible', 'vegetariano'] },
  { platoId: 'palta-reina', etiquetas: ['disponible'] },
  { platoId: 'causa-limena', etiquetas: ['disponible', 'popular'] },
  { platoId: 'causa-atun', etiquetas: ['disponible'] },
  { platoId: 'leche-tigre', etiquetas: ['disponible', 'picante', 'popular'] },

  // === PIQUEOS (5 platos) ===
  { platoId: 'tequenos-queso', etiquetas: ['disponible', 'popular', 'vegetariano'] },
  { platoId: 'yucas-fritas', etiquetas: ['disponible', 'vegetariano'] },
  { platoId: 'canchita-picante', etiquetas: ['disponible', 'picante', 'vegetariano'] },
  { platoId: 'salchipapa', etiquetas: ['disponible', 'popular'] },
  { platoId: 'salchitodo', etiquetas: ['disponible'] },

  // === CARNES (12 platos) ===
  { platoId: 'lomo-saltado-arboleda', etiquetas: ['disponible', 'popular', 'recomendado'] },
  { platoId: 'lomo-fino', etiquetas: ['disponible', 'recomendado'] },
  { platoId: 'medallon-lomo', etiquetas: ['disponible', 'nuevo'] },
  { platoId: 'sudado-lomo-fino', etiquetas: ['disponible'] },
  { platoId: 'lomo-victoriana', etiquetas: ['disponible'] },
  { platoId: 'lomo-pimienta', etiquetas: ['disponible', 'picante'] },
  { platoId: 'lomo-champignones', etiquetas: ['disponible'] },
  { platoId: 'lomo-mozzarella', etiquetas: ['disponible'] },
  { platoId: 'chuleta-vacuno', etiquetas: ['disponible'] },
  { platoId: 'lomo-strogonof', etiquetas: ['disponible'] },

  // === POLLO (4 platos) ===
  { platoId: 'cordon-blue', etiquetas: ['disponible', 'popular'] },
  { platoId: 'milanesa-pollo', etiquetas: ['disponible'] },
  { platoId: 'chicharron-pollo', etiquetas: ['disponible', 'popular'] },
  { platoId: 'pollo-plancha', etiquetas: ['disponible'] },

  // === PESCADOS (10 platos) ===
  { platoId: 'ceviche-pescado', etiquetas: ['disponible', 'popular', 'sin-gluten'] },
  { platoId: 'ceviche-mixto', etiquetas: ['disponible', 'popular', 'sin-gluten'] },
  { platoId: 'ceviche-erizo', etiquetas: ['disponible', 'nuevo', 'sin-gluten'] },
  { platoId: 'ceviche-rocoto', etiquetas: ['disponible', 'picante', 'sin-gluten'] },
  { platoId: 'sudado-pescado', etiquetas: ['disponible'] },
  { platoId: 'pescado-plancha', etiquetas: ['disponible', 'sin-gluten'] },
  { platoId: 'chicharron-pescado', etiquetas: ['disponible'] },
  { platoId: 'pescado-macho', etiquetas: ['disponible', 'picante'] },
  { platoId: 'arroz-mariscos', etiquetas: ['disponible', 'popular'] },

  // === PASTAS (5 platos) ===
  { platoId: 'fetuccini-huancaina-lomo', etiquetas: ['disponible', 'popular'] },
  { platoId: 'tallarin-pesto-bistec', etiquetas: ['disponible'] },
  { platoId: 'fetuccini-pesto-apanado', etiquetas: ['disponible'] },
  { platoId: 'fetuccini-alfredo', etiquetas: ['disponible', 'vegetariano'] },
  { platoId: 'tallarin-saltado-criollo', etiquetas: ['disponible'] },

  // === ENSALADAS (2 platos) ===
  { platoId: 'ensalada-arboleda', etiquetas: ['disponible', 'recomendado'] },
  { platoId: 'ensalada-hawaiana', etiquetas: ['disponible'] },

  // === KIDS (3 platos) ===
  { platoId: 'kids-chicharron-pollo', etiquetas: ['disponible'] },
  { platoId: 'kids-nuggets', etiquetas: ['disponible', 'popular'] },
  { platoId: 'kids-milanesa', etiquetas: ['disponible'] },

  // === SANDWICHES (8 platos) ===
  { platoId: 'sandwich-hot-dog', etiquetas: ['disponible'] },
  { platoId: 'sandwich-chorizo', etiquetas: ['disponible'] },
  { platoId: 'sandwich-pollo', etiquetas: ['disponible'] },
  { platoId: 'sandwich-bistec-palta', etiquetas: ['disponible', 'popular'] },
  { platoId: 'sandwich-bistec-queso', etiquetas: ['disponible'] },
  { platoId: 'sandwich-pollo-palta', etiquetas: ['disponible'] },
  { platoId: 'sandwich-lomo-queso-palta', etiquetas: ['disponible', 'recomendado'] },
  { platoId: 'hamburguesa', etiquetas: ['disponible', 'popular'] },

  // === EMPANADAS (4 platos) ===
  { platoId: 'empanada-mariscos', etiquetas: ['disponible', 'nuevo'] },
  { platoId: 'empanada-pulpo-olivo', etiquetas: ['disponible'] },
  { platoId: 'empanada-lomo-saltado', etiquetas: ['disponible', 'popular'] },
  { platoId: 'empanada-aji-gallina', etiquetas: ['disponible', 'picante'] },

  // === JUGOS (5 platos) ===
  { platoId: 'jugo-fresa', etiquetas: ['disponible', 'vegetariano', 'vegano'] },
  { platoId: 'jugo-mango', etiquetas: ['disponible', 'vegetariano', 'vegano'] },
  { platoId: 'jugo-pina', etiquetas: ['disponible', 'vegetariano', 'vegano'] },
  { platoId: 'jugo-papaya', etiquetas: ['disponible', 'vegetariano', 'vegano'] },
  { platoId: 'jugo-mixto', etiquetas: ['disponible', 'vegetariano', 'vegano', 'popular'] },

  // === INFUSIONES (6 platos) ===
  { platoId: 'te-canela-clavo', etiquetas: ['disponible', 'vegetariano', 'vegano'] },
  { platoId: 'manzanilla', etiquetas: ['disponible', 'vegetariano', 'vegano'] },
  { platoId: 'anis', etiquetas: ['disponible', 'vegetariano', 'vegano'] },
  { platoId: 'hierba-luisa', etiquetas: ['disponible', 'vegetariano', 'vegano'] },
  { platoId: 'cafe', etiquetas: ['disponible', 'vegetariano', 'vegano'] },
  { platoId: 'frutos-rojos', etiquetas: ['disponible', 'vegetariano', 'vegano', 'nuevo'] },

  // === BEBIDAS (17 platos) ===
  { platoId: 'inca-kola-600', etiquetas: ['disponible'] },
  { platoId: 'inca-zero-600', etiquetas: ['disponible'] },
  { platoId: 'inca-kola-2500', etiquetas: ['disponible'] },
  { platoId: 'coca-cola-600', etiquetas: ['disponible'] },
  { platoId: 'coca-zero-600', etiquetas: ['disponible'] },
  { platoId: 'coca-cola-2500', etiquetas: ['disponible'] },
  { platoId: 'fanta-500', etiquetas: ['disponible'] },
  { platoId: 'sprite-500', etiquetas: ['disponible'] },
  { platoId: 'san-mateo-600', etiquetas: ['disponible'] },
  { platoId: 'san-mateo-2500', etiquetas: ['disponible'] },
  { platoId: 'evervess-1500', etiquetas: ['disponible'] },
  { platoId: 'ginger-ale', etiquetas: ['disponible'] },
  { platoId: 'limonada', etiquetas: ['disponible', 'popular', 'vegetariano'] },
  { platoId: 'limonada-rosa', etiquetas: ['disponible', 'nuevo', 'vegetariano'] },
  { platoId: 'limonada-frozen', etiquetas: ['disponible', 'vegetariano'] },
  { platoId: 'limonada-rosa-frozen', etiquetas: ['disponible', 'nuevo', 'vegetariano'] },
  { platoId: 'maracuya', etiquetas: ['disponible', 'vegetariano'] },
  { platoId: 'chicha-morada', etiquetas: ['disponible', 'popular', 'vegetariano', 'vegano'] },

  // === MILKSHAKES (4 platos) ===
  { platoId: 'milkshake-oreo', etiquetas: ['disponible', 'popular'] },
  { platoId: 'milkshake-chocolate', etiquetas: ['disponible'] },
  { platoId: 'milkshake-fresa', etiquetas: ['disponible'] },
  { platoId: 'milkshake-vainilla', etiquetas: ['disponible'] },

  // === COCTELES (30 platos) ===
  { platoId: 'pisco-sour', etiquetas: ['disponible', 'popular', 'recomendado'] },
  { platoId: 'tacna-sour', etiquetas: ['disponible', 'recomendado'] },
  { platoId: 'maracuya-sour', etiquetas: ['disponible', 'popular'] },
  { platoId: 'chilcano-clasico', etiquetas: ['disponible', 'popular'] },
  { platoId: 'chilcano-fresa', etiquetas: ['disponible'] },
  { platoId: 'chilcano-maracuya', etiquetas: ['disponible'] },
  { platoId: 'mojito-clasico', etiquetas: ['disponible', 'popular'] },
  { platoId: 'mojito-fresa', etiquetas: ['disponible'] },
  { platoId: 'mojito-maracuya', etiquetas: ['disponible'] },
  { platoId: 'algarrobina', etiquetas: ['disponible', 'popular'] },
  { platoId: 'machu-picchu', etiquetas: ['disponible'] },
  { platoId: 'hulk', etiquetas: ['disponible', 'nuevo'] },
  { platoId: 'daiquiri', etiquetas: ['disponible'] },
  { platoId: 'pina-colada', etiquetas: ['disponible', 'popular'] },
  { platoId: 'cuba-libre', etiquetas: ['disponible'] },
  { platoId: 'alejandra', etiquetas: ['disponible'] },
  { platoId: 'ruso-negro', etiquetas: ['disponible'] },
  { platoId: 'ruso-blanco', etiquetas: ['disponible'] },
  { platoId: 'capiroska', etiquetas: ['disponible'] },
  { platoId: 'laguna-azul', etiquetas: ['disponible'] },
  { platoId: 'negroni', etiquetas: ['disponible'] },
  { platoId: 'gin-tonic', etiquetas: ['disponible', 'popular'] },
  { platoId: 'margarita-limon', etiquetas: ['disponible', 'popular'] },
  { platoId: 'margarita-blue', etiquetas: ['disponible'] },
  { platoId: 'tequila-sunrise', etiquetas: ['disponible'] },
  { platoId: 'tequila-shot', etiquetas: ['disponible'] },
  { platoId: 'tinto-verano', etiquetas: ['disponible', 'temporada'] },
  { platoId: 'gin-rosa', etiquetas: ['disponible', 'nuevo'] },
  { platoId: 'mojito-jagger', etiquetas: ['disponible'] },
  { platoId: 'mojito-corona', etiquetas: ['disponible'] },

  // === LICORES (13 platos) ===
  { platoId: 'old-parr-12', etiquetas: ['disponible'] },
  { platoId: 'jw-swing', etiquetas: ['disponible'] },
  { platoId: 'jw-double-black', etiquetas: ['disponible', 'popular'] },
  { platoId: 'jw-gold-label', etiquetas: ['disponible', 'recomendado'] },
  { platoId: 'flor-cana-12', etiquetas: ['disponible'] },
  { platoId: 'flor-cana-18', etiquetas: ['disponible'] },
  { platoId: 'pisco-res-chilcanera', etiquetas: ['disponible', 'popular'] },
  { platoId: 'pisco-mosto-verde-cuneo', etiquetas: ['disponible'] },
  { platoId: 'pisco-cuatro-gallos', etiquetas: ['disponible'] },
  { platoId: 'pisco-porton', etiquetas: ['disponible', 'recomendado'] },
  { platoId: 'gin-beefeater', etiquetas: ['disponible'] },
  { platoId: 'gin-hendricks', etiquetas: ['disponible', 'recomendado'] },
  { platoId: 'gin-tanqueray-sevilla', etiquetas: ['disponible', 'nuevo'] },

  // === VINOS (3 platos) ===
  { platoId: 'vino-misiones-dorado', etiquetas: ['disponible'] },
  { platoId: 'vino-misiones-morado', etiquetas: ['disponible', 'popular'] },
  { platoId: 'vino-misiones-black', etiquetas: ['disponible', 'recomendado'] },

  // === CERVEZAS (6 platos) ===
  { platoId: 'cerveza-stella-artois', etiquetas: ['disponible', 'popular'] },
  { platoId: 'cerveza-pilsen-305', etiquetas: ['disponible'] },
  { platoId: 'cerveza-pilsen-630', etiquetas: ['disponible', 'popular'] },
  { platoId: 'cerveza-cusquena-310', etiquetas: ['disponible'] },
  { platoId: 'cerveza-cusquena-620', etiquetas: ['disponible'] },
  { platoId: 'cerveza-corona', etiquetas: ['disponible', 'popular'] }
];

// ==========================================================
// FUNCIONES DE MIGRACIÓN
// ==========================================================

/**
 * Migra las etiquetas base a Firestore
 */
async function migrarEtiquetas() {
  console.log('📋 Iniciando migración de etiquetas...');

  const coleccionEtiquetas = collection(db, 'etiquetas');
  let contador = 0;

  for (const etiqueta of ETIQUETAS_BASE) {
    try {
      await setDoc(doc(coleccionEtiquetas, etiqueta.id), {
        ...etiqueta,
        activo: true,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp()
      });
      contador++;
      console.log(`  ✓ Etiqueta "${etiqueta.nombre}" creada`);
    } catch (error) {
      console.error(`  ✗ Error en etiqueta "${etiqueta.nombre}":`, error);
    }
  }

  console.log(`✅ ${contador}/${ETIQUETAS_BASE.length} etiquetas migradas`);
  return contador;
}

/**
 * Migra los estados de platos a Firestore
 */
async function migrarEstadosPlatos() {
  console.log('🍽️ Iniciando migración de estados de platos...');

  const coleccionEstados = collection(db, 'estadosPlatos');
  let contador = 0;

  for (const estado of ESTADOS_PLATOS) {
    try {
      await setDoc(doc(coleccionEstados, estado.platoId), {
        platoId: estado.platoId,
        etiquetas: estado.etiquetas,
        activo: true,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp()
      });
      contador++;

      if (contador % 20 === 0) {
        console.log(`  📊 Progreso: ${contador}/${ESTADOS_PLATOS.length} estados...`);
      }
    } catch (error) {
      console.error(`  ✗ Error en plato "${estado.platoId}":`, error);
    }
  }

  console.log(`✅ ${contador}/${ESTADOS_PLATOS.length} estados migrados`);
  return contador;
}

/**
 * Verifica si ya existe la migración
 */
async function verificarMigracionExistente() {
  try {
    const etiquetasRef = collection(db, 'etiquetas');
    const snapshot = await getDocs(etiquetasRef);
    return snapshot.size > 0;
  } catch (error) {
    console.error('Error verificando migración:', error);
    return false;
  }
}

/**
 * Ejecuta la migración completa
 */
async function ejecutarMigracionEtiquetas() {
  console.log('═══════════════════════════════════════════');
  console.log('🚀 MIGRACIÓN DE ETIQUETAS - LA ARBOLEDA');
  console.log('═══════════════════════════════════════════');

  // Verificar si ya existe
  const existe = await verificarMigracionExistente();
  if (existe) {
    console.warn('⚠️ Ya existen datos de etiquetas en Firebase.');
    const confirmar = confirm('¿Desea sobrescribir los datos existentes?');
    if (!confirmar) {
      console.log('❌ Migración cancelada por el usuario.');
      return;
    }
  }

  const inicio = Date.now();

  try {
    // Migrar etiquetas
    const etiquetasMigradas = await migrarEtiquetas();

    // Migrar estados
    const estadosMigrados = await migrarEstadosPlatos();

    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

    console.log('═══════════════════════════════════════════');
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('═══════════════════════════════════════════');
    console.log(`📋 Etiquetas creadas: ${etiquetasMigradas}`);
    console.log(`🍽️ Estados de platos: ${estadosMigrados}`);
    console.log(`⏱️ Tiempo total: ${duracion}s`);
    console.log('═══════════════════════════════════════════');

    return {
      exito: true,
      etiquetas: etiquetasMigradas,
      estados: estadosMigrados,
      duracion: duracion
    };

  } catch (error) {
    console.error('═══════════════════════════════════════════');
    console.error('❌ ERROR EN LA MIGRACIÓN');
    console.error('═══════════════════════════════════════════');
    console.error(error);

    return {
      exito: false,
      error: error.message
    };
  }
}

/**
 * Obtiene estadísticas de la migración
 */
async function obtenerEstadisticasMigracion() {
  try {
    const etiquetasSnap = await getDocs(collection(db, 'etiquetas'));
    const estadosSnap = await getDocs(collection(db, 'estadosPlatos'));

    const stats = {
      totalEtiquetas: etiquetasSnap.size,
      totalEstados: estadosSnap.size,
      etiquetasPorTipo: {},
      platosConEtiquetas: {}
    };

    // Contar etiquetas por tipo
    etiquetasSnap.forEach(doc => {
      const data = doc.data();
      const tipo = data.tipo || 'otro';
      stats.etiquetasPorTipo[tipo] = (stats.etiquetasPorTipo[tipo] || 0) + 1;
    });

    // Contar platos por número de etiquetas
    estadosSnap.forEach(doc => {
      const data = doc.data();
      const numEtiquetas = data.etiquetas?.length || 0;
      stats.platosConEtiquetas[numEtiquetas] = (stats.platosConEtiquetas[numEtiquetas] || 0) + 1;
    });

    console.log('📊 Estadísticas de migración:');
    console.log('  Total etiquetas:', stats.totalEtiquetas);
    console.log('  Total estados:', stats.totalEstados);
    console.log('  Por tipo:', stats.etiquetasPorTipo);
    console.log('  Platos por # etiquetas:', stats.platosConEtiquetas);

    return stats;

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return null;
  }
}

// ==========================================================
// EXPORTAR FUNCIONES GLOBALES
// ==========================================================

// Hacer disponibles en consola del navegador
window.ejecutarMigracionEtiquetas = ejecutarMigracionEtiquetas;
window.obtenerEstadisticasMigracion = obtenerEstadisticasMigracion;
window.verificarMigracionExistente = verificarMigracionExistente;

// Exportar para uso en módulos
export {
  ejecutarMigracionEtiquetas,
  obtenerEstadisticasMigracion,
  verificarMigracionExistente,
  ETIQUETAS_BASE,
  ESTADOS_PLATOS
};
