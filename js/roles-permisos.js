/* ==========================================================
   ROLES Y PERMISOS - Sistema de control de acceso
   La Arboleda Club - Tacna, Perú
   ========================================================== */

import { db, collection, addDoc, Timestamp } from './firebase-config.js';

// ==========================================================
// DEFINICIÓN DE ROLES Y PERMISOS
// ==========================================================

export const ROLES_DEFINIDOS = {
  super_admin: {
    id: 'super_admin',
    nombre: 'Super Administrador',
    descripcion: 'Acceso total a todas las funcionalidades',
    color: '#FF6B6B',
    esRolBase: true,
    permisos: [
      // Reservas
      'reservas.crear',
      'reservas.leer',
      'reservas.modificar',
      'reservas.eliminar',
      'reservas.cambiar_estado',
      'reservas.enviar_notificaciones',
      'reservas.exportar',

      // Carta
      'carta.crear',
      'carta.leer',
      'carta.modificar',
      'carta.eliminar',
      'carta.gestionar_etiquetas',
      'carta.ver_estadisticas',
      'carta.exportar',

      // Usuarios
      'usuarios.crear',
      'usuarios.leer',
      'usuarios.modificar',
      'usuarios.eliminar',
      'usuarios.asignar_roles',
      'usuarios.ver_auditoria',

      // Reportes
      'reportes.ver_todos',
      'reportes.exportar',
      'reportes.ver_auditoria',

      // Configuración
      'config.ver',
      'config.modificar',
      'config.backup'
    ]
  },

  admin_reservas: {
    id: 'admin_reservas',
    nombre: 'Administrador de Reservas',
    descripcion: 'Gestiona reservas, confirmaciones y estado',
    color: '#4ECDC4',
    esRolBase: true,
    permisos: [
      // Reservas - acceso completo
      'reservas.crear',
      'reservas.leer',
      'reservas.modificar',
      'reservas.eliminar',
      'reservas.cambiar_estado',
      'reservas.enviar_notificaciones',
      'reservas.exportar',

      // Carta - solo lectura
      'carta.leer',
      'carta.ver_estadisticas',

      // Reportes
      'reportes.ver_todos',
      'reportes.exportar'
    ]
  },

  admin_carta: {
    id: 'admin_carta',
    nombre: 'Administrador de Carta',
    descripcion: 'Gestiona menú, platos y promociones',
    color: '#95E1D3',
    esRolBase: true,
    permisos: [
      // Reservas - solo lectura
      'reservas.leer',

      // Carta - acceso completo
      'carta.crear',
      'carta.leer',
      'carta.modificar',
      'carta.eliminar',
      'carta.gestionar_etiquetas',
      'carta.ver_estadisticas',
      'carta.exportar',

      // Reportes
      'reportes.ver_todos'
    ]
  },

  recepcionista: {
    id: 'recepcionista',
    nombre: 'Recepcionista',
    descripcion: 'Solo aceptar y rechazar reservas',
    color: '#FFE66D',
    esRolBase: true,
    permisos: [
      // Reservas - solo aceptar/rechazar
      'reservas.leer',
      'reservas.cambiar_estado',
      'reservas.enviar_notificaciones',

      // Carta - solo lectura
      'carta.leer'
    ]
  },

  gerente: {
    id: 'gerente',
    nombre: 'Administrador',
    descripcion: 'Gestiona reservas y menú (acceso completo a operaciones)',
    color: '#6C63FF',
    esRolBase: true,
    permisos: [
      // Reservas - acceso completo
      'reservas.crear',
      'reservas.leer',
      'reservas.modificar',
      'reservas.eliminar',
      'reservas.cambiar_estado',
      'reservas.enviar_notificaciones',
      'reservas.exportar',

      // Carta - acceso completo
      'carta.crear',
      'carta.leer',
      'carta.modificar',
      'carta.eliminar',
      'carta.gestionar_etiquetas',
      'carta.ver_estadisticas',
      'carta.exportar',

      // Reportes
      'reportes.ver_todos',
      'reportes.exportar'
    ]
  }
};

// ==========================================================
// FUNCIONES DE VERIFICACIÓN DE PERMISOS
// ==========================================================

/**
 * Obtiene el usuario actual del admin
 * @returns {Object} Datos del usuario admin actual
 */
export async function obtenerUsuarioActual(usuarioUid) {
  try {
    const usuariosRef = collection(db, 'usuarios_admin');
    const q = query(usuariosRef, where('uid', '==', usuarioUid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.error('Usuario admin no encontrado');
      return null;
    }

    return snapshot.docs[0].data();
  } catch (error) {
    console.error('Error al obtener usuario actual:', error);
    return null;
  }
}

/**
 * Verifica si un usuario tiene un permiso específico
 * @param {Object} usuarioData - Datos del usuario
 * @param {string} permiso - Permiso a verificar (ej: 'reservas.crear')
 * @returns {boolean}
 */
export function verificarPermiso(usuarioData, permiso) {
  if (!usuarioData) return false;

  const rol = ROLES_DEFINIDOS[usuarioData.rol];
  if (!rol) return false;

  // Si tiene permisos custom para este permiso específico
  if (usuarioData.permisos_custom && usuarioData.permisos_custom[permiso] !== undefined) {
    return usuarioData.permisos_custom[permiso];
  }

  // Si no, verificar en los permisos del rol
  return rol.permisos.includes(permiso);
}

/**
 * Obtiene todos los permisos de un usuario (rol + custom)
 * @param {Object} usuarioData - Datos del usuario
 * @returns {Array} Array de permisos
 */
export function obtenerPermisosUsuario(usuarioData) {
  if (!usuarioData) return [];

  const rol = ROLES_DEFINIDOS[usuarioData.rol];
  if (!rol) return [];

  const permisos = new Set(rol.permisos);

  // Agregar overrides custom
  if (usuarioData.permisos_custom) {
    Object.keys(usuarioData.permisos_custom).forEach(permiso => {
      if (usuarioData.permisos_custom[permiso]) {
        permisos.add(permiso);
      } else {
        permisos.delete(permiso);
      }
    });
  }

  return Array.from(permisos);
}

/**
 * Obtiene la lista de permisos disponibles para asignar
 * @returns {Array} Array de permisos disponibles
 */
export function obtenerPermisosDisponibles() {
  const permisosSet = new Set();

  Object.values(ROLES_DEFINIDOS).forEach(rol => {
    rol.permisos.forEach(permiso => permisosSet.add(permiso));
  });

  return Array.from(permisosSet).sort();
}

/**
 * Obtiene los permisos de un rol específico
 * @param {string} rolId - ID del rol
 * @returns {Array} Array de permisos del rol
 */
export function obtenerPermisosRol(rolId) {
  const rol = ROLES_DEFINIDOS[rolId];
  return rol ? rol.permisos : [];
}

// ==========================================================
// FUNCIONES DE AUDITORÍA
// ==========================================================

/**
 * Registra una acción en la colección de auditoría
 * @param {Object} auditData - Datos de la acción
 */
export async function registrarAuditoria(auditData) {
  try {
    const auditRef = collection(db, 'auditoria');
    await addDoc(auditRef, {
      timestamp: Timestamp.now(),
      ...auditData
    });
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
  }
}

/**
 * Registra que alguien intentó acceder sin permiso
 * @param {string} usuarioEmail - Email del usuario
 * @param {string} accion - Acción intendada
 * @param {string} recurso - Recurso accesado
 */
export async function registrarAccesoDenegado(usuarioEmail, accion, recurso) {
  await registrarAuditoria({
    usuario: usuarioEmail,
    accion: `ACCESO_DENEGADO`,
    recurso: recurso,
    detalles: `Intento denegado: ${accion}`,
    tipo: 'SEGURIDAD'
  });
}

/**
 * Registra una acción exitosa (crear, modificar, eliminar)
 * @param {string} usuarioEmail - Email del usuario
 * @param {string} accion - Tipo de acción (crear, modificar, eliminar)
 * @param {string} recurso - Tipo de recurso (reserva, plato, usuario)
 * @param {string} recursoId - ID del recurso afectado
 * @param {Object} cambios - Objeto con antes/despues del cambio
 */
export async function registrarAccionExitosa(usuarioEmail, accion, recurso, recursoId, cambios = {}) {
  await registrarAuditoria({
    usuario: usuarioEmail,
    accion: `${recurso.toUpperCase()}_${accion.toUpperCase()}`,
    recurso: `${recurso}:${recursoId}`,
    cambios: cambios,
    tipo: 'ACCION',
    detalles: `${accion} en ${recurso}`
  });
}

// ==========================================================
// FUNCIONES DE GESTIÓN DE USUARIOS ADMIN
// ==========================================================

/**
 * Obtiene todos los usuarios administrativos
 * @returns {Array} Array de usuarios admin
 */
export async function obtenerUsuariosAdmin() {
  try {
    const usuariosRef = collection(db, 'usuarios_admin');
    const snapshot = await getDocs(usuariosRef);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error al obtener usuarios admin:', error);
    return [];
  }
}

/**
 * Obtiene un usuario admin por UID
 * @param {string} uid - UID del usuario
 * @returns {Object} Datos del usuario
 */
export async function obtenerUsuarioAdminPorUid(uid) {
  try {
    const usuariosRef = collection(db, 'usuarios_admin');
    const q = query(usuariosRef, where('uid', '==', uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };
  } catch (error) {
    console.error('Error al obtener usuario admin:', error);
    return null;
  }
}

/**
 * Crea un nuevo usuario administrativo
 * @param {Object} datosUsuario - Datos del nuevo usuario
 * @returns {string} ID del documento creado
 */
export async function crearUsuarioAdmin(datosUsuario) {
  try {
    const usuariosRef = collection(db, 'usuarios_admin');
    const docRef = await addDoc(usuariosRef, {
      ...datosUsuario,
      fechaCreacion: Timestamp.now(),
      estado: 'activo',
      permisos_custom: {},
      ultimoAcceso: null,
      historialAcceso: []
    });

    return docRef.id;
  } catch (error) {
    console.error('Error al crear usuario admin:', error);
    throw error;
  }
}

/**
 * Actualiza un usuario administrativo
 * @param {string} uid - UID del usuario
 * @param {Object} datosActualizados - Datos a actualizar
 */
export async function actualizarUsuarioAdmin(uid, datosActualizados) {
  try {
    const usuariosRef = collection(db, 'usuarios_admin');
    const q = query(usuariosRef, where('uid', '==', uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Usuario no encontrado');
    }

    const docId = snapshot.docs[0].id;
    const docRef = doc(db, 'usuarios_admin', docId);

    await updateDoc(docRef, {
      ...datosActualizados,
      ultimoAcceso: Timestamp.now()
    });
  } catch (error) {
    console.error('Error al actualizar usuario admin:', error);
    throw error;
  }
}

/**
 * Elimina un usuario administrativo
 * @param {string} uid - UID del usuario a eliminar
 */
export async function eliminarUsuarioAdmin(uid) {
  try {
    const usuariosRef = collection(db, 'usuarios_admin');
    const q = query(usuariosRef, where('uid', '==', uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Usuario no encontrado');
    }

    const docId = snapshot.docs[0].id;
    await deleteDoc(doc(db, 'usuarios_admin', docId));
  } catch (error) {
    console.error('Error al eliminar usuario admin:', error);
    throw error;
  }
}

/**
 * Registra un acceso/login del usuario
 * @param {string} uid - UID del usuario
 */
export async function registrarAcceso(uid) {
  try {
    const usuarioData = await obtenerUsuarioAdminPorUid(uid);
    if (!usuarioData) return;

    const historialAcceso = usuarioData.historialAcceso || [];
    historialAcceso.push({
      fecha: Timestamp.now(),
      tipo: 'LOGIN'
    });

    // Mantener solo los últimos 50 accesos
    if (historialAcceso.length > 50) {
      historialAcceso.shift();
    }

    await actualizarUsuarioAdmin(uid, {
      historialAcceso: historialAcceso
    });
  } catch (error) {
    console.error('Error al registrar acceso:', error);
  }
}

// ==========================================================
// FUNCIÓN GENERAL PARA EJECUTAR CON AUDITORÍA
// ==========================================================

/**
 * Ejecuta una acción verificando permisos y registrando en auditoría
 * @param {Object} usuarioData - Datos del usuario
 * @param {string} permiso - Permiso necesario
 * @param {Function} funcion - Función a ejecutar
 * @param {Object} auditData - Datos para auditoría
 * @returns {Promise}
 */
export async function ejecutarConAuditoria(usuarioData, permiso, funcion, auditData) {
  // 1. Verificar permiso
  if (!verificarPermiso(usuarioData, permiso)) {
    await registrarAccesoDenegado(
      usuarioData.email,
      permiso,
      auditData.recurso || 'desconocido'
    );
    throw new Error(`Permiso denegado: ${permiso}`);
  }

  // 2. Ejecutar acción
  let resultado;
  try {
    resultado = await funcion();
  } catch (error) {
    // Registrar error
    await registrarAuditoria({
      usuario: usuarioData.email,
      accion: `${auditData.recurso}_ERROR`,
      detalles: error.message,
      tipo: 'ERROR'
    });
    throw error;
  }

  // 3. Registrar acción exitosa
  await registrarAccionExitosa(
    usuarioData.email,
    auditData.accion || 'modificar',
    auditData.recurso || 'desconocido',
    auditData.recursoId || '',
    auditData.cambios || {}
  );

  return resultado;
}

// ==========================================================
// IMPORTAR FUNCIONES QUE FALTAN
// ==========================================================

// Importar funciones necesarias de firebase-config
import { getDocs, query, where, updateDoc, deleteDoc } from './firebase-config.js';
