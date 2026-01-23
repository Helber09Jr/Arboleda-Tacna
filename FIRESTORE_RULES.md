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

    // Permitir lectura a todos (anónimo)
    match /reservas/{document=**} {
      allow read: if true;
      allow create: if request.auth != null || true;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }

    // Colección de auditoría (admin)
    match /auditoria/{document=**} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }
  }
}
```

## Explicación de Reglas

- **read**: Permite a cualquiera leer reservas (necesario para calendario)
- **create**: Permite crear reservas sin necesidad de autenticación
- **update/delete**: Solo administradores autenticados pueden actualizar/eliminar

## Pasos para Aplicar

1. Abre [Firebase Console](https://console.firebase.google.com/)
2. Selecciona el proyecto `proyecto-arboleda2025`
3. Ve a **Firestore Database**
4. Click en la pestaña **Rules**
5. Reemplaza el contenido con las reglas anteriores
6. Click en **Publish**

## Verificación

Después de aplicar las reglas:
- Las reservas deberían guardarse correctamente
- Los usuarios pueden crear reservas sin iniciar sesión
- El calendario mostrará fechas reservadas en tiempo real
