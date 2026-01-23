# Reglas de Seguridad de Firestore - La Arboleda Club

## ⚠️ IMPORTANTE
Las reglas de Firestore deben configurarse en la Consola de Firebase para permitir que se guarden las reservas.

## Configuración Actual Necesaria

En la consola de Firebase (https://console.firebase.google.com/), ve a:
**Firestore Database → Rules** y reemplaza el contenido con:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Permitir lectura a todos
    match /{document=**} {
      allow read: if true;
    }

    // Colección de reservas - crear sin restricción
    match /reservas/{reservaId} {
      allow read: if true;
      allow create: if true;
      allow update: if request.auth != null || request.auth == null;
      allow delete: if request.auth != null;
    }

    // Colección de auditoría
    match /auditoria/{auditId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Otras colecciones
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Explicación de Reglas

- **read**: Permite a cualquiera leer (necesario para calendario)
- **create**: Permite crear reservas SIN restricción de autenticación
- **update**: Permite actualizar si hay autenticación
- **delete**: Solo usuarios autenticados pueden eliminar

## Pasos para Aplicar

1. Abre [Firebase Console](https://console.firebase.google.com/)
2. Selecciona el proyecto `proyecto-arboleda2025`
3. Ve a **Firestore Database**
4. Click en la pestaña **Rules**
5. Selecciona TODO el contenido actual y elimínalo
6. Pega las nuevas reglas (arriba)
7. Click en **Publish** (botón azul)
8. Espera a que aparezca el checkmark verde

## Verificación

Después de aplicar las reglas:
- Las reservas deberían guardarse correctamente
- Los usuarios pueden crear reservas sin iniciar sesión
- El calendario mostrará fechas reservadas en tiempo real
- Si ves "Permiso denegado", las reglas aún no se publicaron correctamente

## Ayuda si No Funciona

1. En la consola de Firefox/Chrome (F12), verás logs que dicen:
   - ✅ "Reserva guardada con ID: ..."
   - ❌ "Error al guardar reserva: ..." (si hay problema)

2. Si el error persiste:
   - Verifica que hayas hecho click en **Publish**
   - Intenta recargar la página después de 30 segundos
   - Abre navegador en incógnito/privado para limpiar caché
