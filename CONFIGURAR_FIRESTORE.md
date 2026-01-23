# 🔧 Configuración de Firestore - Paso a Paso

## ❌ Problema Actual
```
"Permiso denegado. Error de permisos en la base de datos."
```

## ✅ Solución: Aplicar Reglas de Seguridad

### Paso 1: Acceder a Firebase Console

1. Abre tu navegador y ve a: **https://console.firebase.google.com/**
2. Inicia sesión con tu cuenta de Google

### Paso 2: Seleccionar el Proyecto

1. Busca y selecciona el proyecto: **proyecto-arboleda2025**

### Paso 3: Ir a Firestore Database

1. En el menú izquierdo, click en **Build** (o busca "Firestore")
2. Click en **Firestore Database**

### Paso 4: Abrir las Reglas

1. Haz click en la pestaña **Rules** (al lado de "Data")
2. Verás un editor de código con las reglas actuales

### Paso 5: Reemplazar las Reglas

**IMPORTANTE: Selecciona TODO el contenido actual y elimínalo primero**

Luego pega exactamente esto:

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

### Paso 6: Publicar las Reglas

1. Busca el botón **Publish** (azul) en la esquina superior derecha
2. Click en **Publish**
3. Espera a que aparezca un checkmark verde ✅ (tarda 20-30 segundos)

### Paso 7: Verificar que Funcionó

1. Recarga la página de reservas: **F5** (o Ctrl+R)
2. Intenta hacer una reserva nuevamente
3. Si funciona, verás el modal de éxito con el ID de la reserva

## 🧪 Cómo Verificar que las Reglas Están Bien

### En la Consola del Navegador

1. Abre tu página de reservas
2. Presiona **F12** para abrir Developer Tools
3. Ve a la pestaña **Console**
4. Intenta reservar

Deberías ver:
- ✅ `📝 Datos de reserva a guardar: {...}`
- ✅ `✅ Reserva guardada con ID: abc123def...`

O si hay error:
- ❌ `❌ Error al guardar reserva: ...`

## 🆘 Si Aún No Funciona

### Checklist:

- [ ] ¿Hiciste click en el botón **Publish** de Firestore Rules?
- [ ] ¿Esperaste a que aparezca el checkmark verde?
- [ ] ¿Recargaste la página (F5) después de publicar?
- [ ] ¿Estás usando la misma cuenta de Google que en Firebase Console?

### Si el Error Persiste:

1. Abre la consola (F12) y busca el mensaje de error exacto
2. Intenta en **navegador privado/incógnito** (limpia caché)
3. Si ves `permission-denied`, las reglas no se aplicaron correctamente

### Reglas de Emergencia (Máximo Permiso)

Si las reglas anteriores no funcionan, intenta esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **ADVERTENCIA**: Esta regla permite lectura y escritura a TODOS sin restricción. Úsala solo temporalmente para testing.

## 📞 ¿Necesitas Ayuda?

Si los pasos no funcionan:
1. Verifica que estés en el proyecto correcto: `proyecto-arboleda2025`
2. Revisa que no haya errores de sintaxis en las reglas (líneas rojas en el editor)
3. Intenta con las "Reglas de Emergencia" arriba

## ✨ Después de Configurar

Una vez que funcione, podrás:
- ✅ Reservar parrillas, tenis, frontón
- ✅ Ver fechas disponibles en el calendario
- ✅ Guardar reservas sin errores
- ✅ Recibir confirmación con ID
