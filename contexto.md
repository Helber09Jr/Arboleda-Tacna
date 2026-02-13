# Contexto del Proyecto - Sistema de Gestion para Restaurantes

## Descripcion General

Sistema web completo de gestion para restaurantes. Aplicacion web progresiva (PWA) que integra:
- Pagina publica con informacion del restaurante
- Menu digital interactivo con carrito de pedidos
- Panel de administracion con roles (admin, mozo, cajero)
- Sistema de comandas en tiempo real
- Generacion de boletas y control de caja
- Integracion con Firebase (Firestore + Authentication)

---

## Estructura de Archivos

```
proyecto-restaurante/
├── index.html                (Pagina principal / Home)
├── carta.html                (Menu digital con carrito y pedidos)
├── admin.html                (Panel de administracion y gestion)
├── manifest.json             (PWA Manifest)
├── sw.js                     (Service Worker)
├── css/
│   ├── estilos-inicio.css    (Estilos del Home)
│   ├── estilos-carta.css     (Estilos del Menu y pedidos)
│   └── admin.css             (Estilos del Panel admin)
├── js/
│   ├── firebase-config.js    (Configuracion Firebase centralizada)
│   ├── inicio.js             (Logica del Home)
│   ├── carta.js              (Logica del Menu digital)
│   ├── carrito.js            (Logica del Carrito de pedidos)
│   ├── admin.js              (Logica del Panel admin)
│   └── roles-permisos.js     (Control de acceso RBAC)
├── data/
│   └── carta.json            (Menu con categorias y platos)
└── imagenes/
    ├── logo.png
    ├── hero/
    ├── menu/
    └── iconos/
```

Cada pagina tiene su propio HTML, CSS y JS separado para mantener el codigo modular y facil de mantener.

---

## Logica Modular del Codigo

### Principio: Un archivo por responsabilidad

| Archivo | Responsabilidad |
|---------|-----------------|
| `firebase-config.js` | Configuracion unica de Firebase, exporta db y auth |
| `inicio.js` | Solo logica del home: galeria, animaciones, menu movil |
| `carta.js` | Solo logica del menu: carga platos, filtros, modales |
| `carrito.js` | Solo logica del carrito: agregar, quitar, calcular, enviar |
| `admin.js` | Solo logica admin: CRUD, comandas, boletas, usuarios |
| `roles-permisos.js` | Solo control de acceso: roles, permisos, auditoria |

### Convenciones de nombres

- Variables: camelCase, nombres cortos y descriptivos en espanol
  - `datosMenu`, `platoActual`, `totalPagar`, `listaItems`
- Funciones: camelCase, verbo + sustantivo
  - `cargarMenu()`, `filtrarPlatos()`, `agregarItem()`, `calcularTotal()`
- IDs HTML: kebab-case con prefijo funcional
  - `btn-enviar`, `modal-plato`, `lista-carrito`, `filtro-categoria`
- Clases CSS: kebab-case descriptivo
  - `tarjeta-plato`, `boton-primario`, `panel-lateral`, `campo-busqueda`
- Sin comentarios en el codigo
- Sin emojis en el codigo
- Todo en espanol

### Como se conectan los archivos

```
index.html
  └── css/estilos-inicio.css
  └── js/firebase-config.js
  └── js/inicio.js

carta.html
  └── css/estilos-carta.css
  └── js/firebase-config.js
  └── js/carta.js
  └── js/carrito.js

admin.html
  └── css/admin.css
  └── js/firebase-config.js
  └── js/roles-permisos.js
  └── js/admin.js
```

---

## Pagina 1: index.html (Home)

### Proposito
Pagina publica del restaurante. Presenta la marca, el ambiente, la historia y la informacion de contacto.

### Estructura HTML

```
<header>
  Logo + Nombre del restaurante
  Menu navegacion: Inicio, Nosotros, Galeria, Carta, Contacto
  Boton admin (icono candado, lleva a admin.html)
  Menu hamburguesa para movil
</header>

<section id="inicio"> (Hero)
  Fondo imagen grande con overlay oscuro
  Titulo principal del restaurante
  Subtitulo descriptivo
  2 botones CTA:
    - "Ver Nuestra Carta" (enlace a carta.html)
    - "Reservar Mesa" (enlace a WhatsApp o formulario)
</section>

<section id="nosotros"> (Sobre Nosotros)
  Etiqueta "Nuestra Historia"
  Badge con anio de fundacion
  Titulo principal
  Descripcion del restaurante (2 parrafos)
  Botones: "Nuestro Equipo", "Reglamento"
  Tarjetas de Mision y Vision
</section>

<section id="galeria"> (Galeria / Instalaciones)
  Grid de tarjetas con imagenes
  Cada tarjeta: imagen, nombre, descripcion
  Click abre modal con galeria de fotos
</section>

<section id="contacto"> (Footer / Contacto)
  Ubicacion, telefono, email
  Redes sociales
  Mapa embebido Google Maps
  Boton flotante WhatsApp
</section>
```

### Logica JS (inicio.js)

```
Clase ModalGaleria
  constructor: captura elementos del DOM (modal, botones, indicadores)
  abrir(seccion): abre modal con galeria de imagenes
  cerrar(): cierra modal
  navegar(direccion): avanza o retrocede imagen
  actualizarGaleria(): actualiza imagen visible con transicion fade

Datos de secciones (objeto con imagenes y descripciones)

Funciones de inicializacion:
  inicializarMenuMovil() - toggle menu hamburguesa
  inicializarScrollSuave() - smooth scroll para links internos
  inicializarAnimaciones() - Intersection Observer para animaciones de entrada
  inicializarParallax() - efecto parallax en hero

Eventos:
  ESC cierra modal
  Flechas navegan galeria
  Click overlay cierra modal
```

### Variables CSS (estilos-inicio.css)

```css
:root {
  --azul-principal: #0052B4;
  --azul-oscuro: #003d8a;
  --azul-suave: #4A90E2;
  --dorado: #c8a95e;
  --dorado-claro: #d9b86c;
  --verde-acento: #2d8659;
  --gris-claro: #f8f7f5;
  --gris-medio: #e8e5e0;
  --blanco: #fff;
  --fuente-principal: 'Poppins', sans-serif;
  --fuente-titulos: 'Montserrat', sans-serif;
  --transicion-rapida: 0.3s ease;
  --transicion-media: 0.4s ease;
}
```

---

## Pagina 2: carta.html (Menu Digital + Carrito + Pedidos)

### Proposito
Menu digital interactivo. El cliente o mozo selecciona platos, personaliza opciones, agrega al carrito y envia el pedido como comanda.

### Estructura HTML

```
<header> (igual al home, con "Carta" activo en nav)

<section id="hero-carta">
  Fondo con overlay
  Titulo del menu
  Descripcion de calidad
</section>

<section id="menu-principal">
  Campo de busqueda con boton limpiar
  Filtros de categorias (tabs dinamicos desde carta.json)
  Filtros por estado: Todos, Disponibles, Promociones, Agotados
  Toggle vista: Detallada (imagenes) / Simple (lista compacta)
  Contador de resultados

  Grid de platos (renderizado dinamico)
    Vista detallada: tarjeta con imagen, nombre, precio, descripcion, etiquetas
    Vista simple: fila con nombre, precio, boton agregar
</section>

<button id="btn-carrito"> (Flotante)
  Icono carrito + contador de items

<aside id="panel-carrito"> (Sidebar lateral)
  Encabezado: "TU PEDIDO" + numero de orden
  Lista de items del carrito:
    Nombre, cantidad (+/-), precio, boton eliminar
  Estado vacio cuando no hay items
  Total a pagar
  Campos:
    Nombre del cliente o numero de mesa
    Selector de mozo (dropdown)
    Observacion general (textarea)
  Boton "Enviar Pedido" (genera comanda)
  Boton "Vaciar carrito"
</aside>

<div id="modal-plato"> (Modal personalizacion)
  Imagen del plato
  Nombre + Precio
  Descripcion
  Opciones dinamicas (radio buttons por grupo)
  Guarniciones (checkboxes, maximo 2)
  Campo observaciones (200 caracteres)
  Selector cantidad (- / +)
  Subtotal en tiempo real
  Boton "Agregar al Pedido"
</div>

<div id="toast"> (Notificacion flotante)
```

### Logica JS (carta.js)

```
Variables globales:
  datosMenu = null           (datos de carta.json)
  platosFiltrados = []       (resultado de filtros)
  categoriaActual = 'todos'  (filtro activo)
  vistaActual = 'detallada'  (modo de vista)
  platoActual = null         (para modal)
  cantidadActual = 1         (cantidad en modal)

Funciones principales:

  cargarMenu()
    fetch('data/carta.json')
    parsear datos
    renderizarCategorias()
    filtrarYRenderizar()

  filtrarYRenderizar()
    aplicar filtros: busqueda + categoria + estado
    actualizar contador
    renderizarPlatos()

  renderizarPlatos()
    si vista detallada: tarjetas con imagen
    si vista simple: lista compacta
    cada plato tiene onclick para abrir modal

  abrirModalPlato(platoId)
    buscar plato en datosMenu
    renderizar opciones dinamicamente
    renderizar guarniciones si aplica
    mostrar modal

  agregarAlCarrito()
    construir objeto item con: id, nombre, precio, cantidad, opciones, guarniciones, observaciones
    llamar agregarItem() de carrito.js
    mostrar toast de exito
    cerrar modal
```

### Logica JS (carrito.js)

```
Variables globales:
  carrito = []                (array de items)
  CLAVE_STORAGE = 'restaurante_carrito'

Funciones principales:

  cargarDesdeStorage()
    leer localStorage
    parsear JSON a carrito[]

  guardarEnStorage()
    convertir carrito[] a JSON
    guardar en localStorage

  agregarItem(item)
    push al array carrito
    guardar en storage
    actualizar interfaz

  eliminarItem(indice)
    splice del array
    guardar en storage
    actualizar interfaz

  actualizarCantidad(indice, cantidad)
    si cantidad > 0: actualizar
    si cantidad = 0: eliminar
    guardar y actualizar interfaz

  calcularTotal()
    reduce sobre carrito: precio * cantidad
    retornar total

  renderizarLista()
    si carrito vacio: mostrar mensaje vacio
    si tiene items: renderizar cada uno con nombre, opciones, cantidad, precio, botones

  abrirPanel() / cerrarPanel()
    toggle clase activo en sidebar
    bloquear/desbloquear scroll del body

  enviarPedido()
    validar nombre/mesa requerido
    generar mensaje formateado con todos los items
    enviar por WhatsApp o registrar como comanda en Firebase
    vaciar carrito
    mostrar confirmacion
```

### Estructura de datos (carta.json)

```json
{
  "categorias": [
    { "id": "entradas", "nombre": "Entradas" },
    { "id": "carnes", "nombre": "Carnes" },
    { "id": "pescados", "nombre": "Pescados" },
    { "id": "bebidas", "nombre": "Bebidas" },
    { "id": "postres", "nombre": "Postres" }
  ],

  "guarniciones": ["Papas fritas", "Arroz", "Ensalada", "Zarza criolla"],

  "mozos": [
    { "nombre": "Mozo 1", "telefono": "910000001" },
    { "nombre": "Mozo 2", "telefono": "910000002" }
  ],

  "platos": [
    {
      "id": "ceviche-clasico",
      "nombre": "Ceviche Clasico",
      "categoria": "pescados",
      "precio": 45.00,
      "descripcion": "Ceviche fresco con limon y leche de tigre",
      "imagen": "imagenes/menu/ceviche-clasico.jpg",
      "opciones": [
        {
          "id": "tamano",
          "nombre": "Tamano",
          "valores": ["Regular (400g)", "Especial (600g)"]
        }
      ],
      "guarniciones": true,
      "tieneObservaciones": true
    }
  ]
}
```

---

## Pagina 3: admin.html (Panel de Administracion)

### Proposito
Panel completo de gestion del restaurante. Maneja comandas, caja, carta, usuarios y auditoria. Cada rol ve solo lo que le corresponde.

### Estructura HTML

```
<div id="pantalla-login">
  Fondo animado con gradiente
  Card con glassmorphism
  Logo del restaurante
  Titulo "Panel de Administracion"
  Campo email con icono
  Campo password con toggle mostrar/ocultar
  Checkbox "Recordar sesion"
  Boton "Acceder" con spinner de carga
  Mensaje de error
</div>

<div id="panel-admin" style="display:none">

  <header>
    Logo + "Panel de Administracion"
    Info usuario: nombre + rol actual
    Boton "Salir"
    Menu hamburguesa movil
  </header>

  <nav> (Pestanas principales)
    Tab: Comandas (icono documento) - Vista principal para mozos y cocina
    Tab: Caja (icono dinero) - Para cajeros
    Tab: Gestion de Carta (icono menu) - Para admins
    Tab: Usuarios (icono personas) - Solo super admin
    Tab: Auditoria (icono log) - Solo super admin
  </nav>
```

### Tab 1: Comandas (Sistema de pedidos en tiempo real)

```
  <section id="tab-comandas">

    Estadisticas rapidas (4 tarjetas):
      - Pendientes: cantidad
      - En preparacion: cantidad
      - Listos para servir: cantidad
      - Entregados hoy: cantidad

    Filtros:
      - Por estado: Todos, Pendientes, En preparacion, Listos, Entregados
      - Por mesa: Selector de mesas
      - Por mozo: Selector de mozos
      - Busqueda por numero de comanda

    Grid de comandas (tarjetas en tiempo real):
      Cada comanda muestra:
        - Numero de comanda (#001, #002...)
        - Mesa o nombre del cliente
        - Mozo asignado
        - Lista de platos con cantidad y opciones
        - Observaciones
        - Hora del pedido
        - Estado actual (badge de color)
        - Botones de accion segun estado:
          Pendiente -> "Preparar" (pasa a en preparacion)
          En preparacion -> "Listo" (pasa a listo para servir)
          Listo -> "Entregar" (pasa a entregado)
          Entregado -> "Cobrar" (abre caja)
        - Boton "Imprimir comanda" (formato ticket)

    Boton "Nueva Comanda Manual"
      Abre modal para crear comanda desde admin
      Selector de mesa
      Selector de mozo
      Buscador de platos para agregar
      Cantidad por plato
      Observaciones

  </section>
```

### Tab 2: Caja (Facturacion y boletas)

```
  <section id="tab-caja">

    Resumen del dia:
      - Ventas totales del dia
      - Cantidad de boletas emitidas
      - Ticket promedio
      - Mesas atendidas

    Comandas listas para cobrar:
      Lista de comandas con estado "entregado" pendientes de cobro
      Cada una muestra:
        - Numero comanda
        - Mesa / Cliente
        - Detalle de platos
        - Total a cobrar
        - Boton "Generar Boleta"

    Modal Generar Boleta:
      Datos del restaurante (razon social, RUC, direccion)
      Numero de boleta (correlativo automatico)
      Fecha y hora
      Detalle de items: cantidad, descripcion, precio unitario, subtotal
      Subtotal
      IGV (18%)
      Total
      Metodo de pago: Efectivo, Tarjeta, Yape/Plin, Mixto
      Si efectivo: campo "Pago con" y calculo de vuelto
      Boton "Emitir Boleta"
      Boton "Imprimir" (formato ticket 80mm)

    Historial de boletas del dia:
      Tabla con: Numero, Hora, Mesa, Total, Metodo pago, Acciones
      Boton "Reimprimir"
      Boton "Anular" (con confirmacion y motivo)

    Cierre de caja:
      Resumen: efectivo, tarjeta, digital
      Total esperado vs total real
      Campo para observaciones
      Boton "Cerrar Caja del Dia"
      Exportar reporte a Excel

  </section>
```

### Tab 3: Gestion de Carta

```
  <section id="tab-carta">

    Estadisticas:
      - Disponibles: cantidad
      - Agotados: cantidad
      - Promociones: cantidad
      - Total platos: cantidad

    Filtros:
      - Categoria (select dinamico)
      - Busqueda por nombre
      - Filtro por etiqueta: agotado, nuevo, popular

    Lista de platos:
      Tarjeta por plato: imagen, nombre, precio, etiquetas
      Boton "Editar etiquetas" por plato

    Modal Editar Etiquetas:
      Radio: Disponible, Agotado, Proximamente
      Checkboxes: Nuevo, Popular, 2x1, Descuento, Recomendado
      Checkboxes: Solo Fin de Semana, Solo Almuerzo, De Temporada
      Botones: Cancelar, Guardar

  </section>
```

### Tab 4: Usuarios

```
  <section id="tab-usuarios">

    Tabla de usuarios:
      Columnas: Email, Nombre, Rol, Estado, Ultimo Acceso, Acciones
      Boton "Agregar Usuario"

    Modal Agregar Usuario:
      UID de Firebase
      Email
      Nombre completo
      Rol (select): Super Admin, Administrador, Mozo, Cajero, Cocina
      Botones: Cancelar, Crear

  </section>
```

### Tab 5: Auditoria

```
  <section id="tab-auditoria">

    Filtros:
      - Usuario (email)
      - Fecha desde / hasta
      - Tipo de accion: Comandas, Boletas, Usuarios, Acceso

    Tabla de logs:
      Columnas: Fecha/Hora, Usuario, Accion, Recurso, Detalles
      Boton "Exportar" a Excel

  </section>
```

### Logica JS (admin.js)

```
Variables globales:
  usuarioActual = null
  usuarioAdmin = null
  permisos = []
  comandasData = []
  comandasFiltradas = []
  boletasData = []
  platosData = []
  usuariosData = []
  vistaActual = 'comandas'

Flujo de autenticacion:
  DOMContentLoaded
    -> verificarAuth()
    -> onAuthStateChanged(auth, callback)
    -> si hay usuario:
        obtener datos de Firestore (usuarios_admin)
        si no existe y es el primero: crear como super_admin (bootstrap)
        obtener rol y permisos
        registrar acceso en auditoria
        mostrar panel
        proteger pestanas segun rol
        inicializar listeners en tiempo real
    -> si no hay usuario:
        mostrar login

CRUD Comandas:

  inicializarListenerComandas()
    onSnapshot en coleccion 'comandas' ordenado por fecha
    cada cambio actualiza comandasData[] y re-renderiza

  crearComanda(datos)
    addDoc a 'comandas' con:
      mesa, mozo, items[], observaciones, estado: 'pendiente'
      fechaCreacion: serverTimestamp()
      creadoPor: uid
    registrar en auditoria

  cambiarEstadoComanda(comandaId, nuevoEstado)
    updateDoc con nuevo estado + timestamp
    si estado = 'entregado': habilitar cobro en caja
    registrar en auditoria

  cancelarComanda(comandaId)
    updateDoc estado: 'cancelado'
    registrar en auditoria

Logica de Caja:

  obtenerComandasParaCobrar()
    filtrar comandas con estado 'entregado' y sin boleta

  generarBoleta(comandaId)
    obtener datos de la comanda
    calcular subtotal, IGV, total
    generar numero correlativo
    addDoc a 'boletas' con:
      numBoleta, comanda, items, subtotal, igv, total
      metodoPago, montoPago, vuelto
      fecha: serverTimestamp()
      cajero: uid
    actualizar comanda con: estado 'cobrado', boletaId
    registrar en auditoria

  imprimirBoleta(boletaId)
    generar HTML formato ticket 80mm
    window.print() con estilos especificos

  cierreCaja()
    sumar boletas del dia por metodo de pago
    generar resumen
    addDoc a 'cierres_caja' con totales y observaciones
    exportar a Excel opcional

Gestion de Carta:
  Mismo flujo que proyecto actual
  Listener en tiempo real en 'platos_etiquetas'
  CRUD de disponibilidad y etiquetas
  Sincronizacion automatica con carta.html

Gestion de Usuarios:
  CRUD en coleccion 'usuarios_admin'
  Roles: super_admin, admin, mozo, cajero, cocina
  Permisos por rol

Auditoria:
  registrarAuditoria(datos)
    addDoc a 'auditoria' con usuario, accion, recurso, detalles, timestamp
  Todas las acciones importantes se registran
```

### Logica JS (roles-permisos.js)

```
Roles definidos:

  super_admin:
    Acceso total a todo el sistema

  admin:
    Comandas: crear, leer, modificar, cambiar estado
    Caja: ver, generar boletas, cierre
    Carta: todo
    Usuarios: leer
    Auditoria: leer

  mozo:
    Comandas: crear, leer las propias, cambiar estado (pendiente -> entregado)
    Carta: solo leer (ver disponibilidad)

  cajero:
    Comandas: leer (solo entregadas)
    Caja: generar boletas, cierre de caja
    Carta: solo leer

  cocina:
    Comandas: leer pendientes, cambiar estado (pendiente -> preparando -> listo)
    Carta: solo leer

Funciones:

  verificarPermiso(usuario, permiso)
    buscar rol del usuario
    verificar si el permiso esta en la lista del rol
    aplicar permisos custom si existen

  obtenerPermisos(usuario)
    retornar array de permisos combinados (rol + custom)

  protegerPestanas(permisos)
    ocultar/mostrar tabs segun permisos del usuario
```

---

## Estructura de Datos Firebase

### Coleccion: usuarios_admin

```javascript
{
  uid: "abc123",
  email: "admin@restaurante.com",
  nombre: "Juan Admin",
  rol: "super_admin",
  estado: "activo",
  permisosCustom: {},
  fechaCreacion: Timestamp,
  ultimoAcceso: Timestamp,
  creadoPor: "uid_creador"
}
```

### Coleccion: comandas

```javascript
{
  id: "autoId",
  numComanda: 1,
  mesa: "Mesa 5",
  mozo: "Carlos",
  items: [
    {
      platoId: "ceviche-clasico",
      nombre: "Ceviche Clasico",
      cantidad: 2,
      precio: 45.00,
      opciones: [{ nombre: "Tamano", valor: "Especial" }],
      guarniciones: ["Arroz"],
      observaciones: "Sin cebolla"
    }
  ],
  observaciones: "Cliente alergico a mariscos en mesa",
  estado: "pendiente",
  fechaCreacion: Timestamp,
  creadoPor: "uid_mozo",
  fechaPreparacion: Timestamp,
  fechaListo: Timestamp,
  fechaEntrega: Timestamp,
  boletaId: null
}
```

Estados de comanda:
- `pendiente` -> recien creada, esperando cocina
- `preparando` -> cocina confirmo y esta cocinando
- `listo` -> plato listo para servir
- `entregado` -> mozo llevo a la mesa
- `cobrado` -> cajero genero boleta
- `cancelado` -> comanda cancelada

### Coleccion: boletas

```javascript
{
  id: "autoId",
  numBoleta: "B001-000001",
  comandaId: "id_comanda",
  items: [
    {
      nombre: "Ceviche Clasico",
      cantidad: 2,
      precioUnit: 45.00,
      subtotal: 90.00
    }
  ],
  subtotal: 90.00,
  igv: 16.20,
  total: 106.20,
  metodoPago: "efectivo",
  montoPago: 120.00,
  vuelto: 13.80,
  fecha: Timestamp,
  cajero: "uid_cajero",
  anulada: false,
  motivoAnulacion: null
}
```

### Coleccion: platos_etiquetas

```javascript
{
  id: "plato_id",
  disponibilidad: "disponible",
  etiquetas: ["nuevo", "popular"],
  ultimaActualizacion: Timestamp,
  actualizadoPor: "uid_admin"
}
```

### Coleccion: cierres_caja

```javascript
{
  id: "autoId",
  fecha: Timestamp,
  cajero: "uid_cajero",
  totalEfectivo: 1500.00,
  totalTarjeta: 800.00,
  totalDigital: 350.00,
  totalGeneral: 2650.00,
  cantidadBoletas: 45,
  observaciones: "Sin novedades",
  boletasAnuladas: 1
}
```

### Coleccion: auditoria

```javascript
{
  id: "autoId",
  usuario: "admin@restaurante.com",
  accion: "COMANDA_CREADA",
  recurso: "comanda:abc123",
  detalles: "Mesa 5, 3 platos",
  timestamp: Timestamp,
  tipo: "EXITO"
}
```

Tipos de accion:
- COMANDA_CREADA, COMANDA_ACTUALIZADA, COMANDA_CANCELADA
- BOLETA_GENERADA, BOLETA_ANULADA
- CIERRE_CAJA
- PLATO_ACTUALIZADO
- USUARIO_CREADO, USUARIO_MODIFICADO
- ACCESO_SISTEMA, ACCESO_DENEGADO

---

## Flujos Principales

### Flujo 1: Cliente/Mozo hace pedido desde carta.html

```
carta.html -> plato renderizado
  -> click "Personalizar y Agregar"
  -> modal con opciones, guarniciones, cantidad
  -> click "Agregar al Pedido"
  -> item se agrega al carrito (localStorage)
  -> se actualiza contador flotante y panel lateral
  -> repite con mas platos
  -> abre panel carrito
  -> llena nombre/mesa y mozo
  -> click "Enviar Pedido"
  -> se crea documento en Firestore coleccion 'comandas'
  -> estado inicial: 'pendiente'
  -> se vacia el carrito
  -> toast de confirmacion
```

### Flujo 2: Cocina recibe y prepara comanda

```
admin.html -> Tab Comandas (rol: cocina)
  -> listener onSnapshot detecta nueva comanda
  -> tarjeta aparece en columna "Pendientes"
  -> cocinero click "Preparar"
  -> estado cambia a 'preparando'
  -> tarjeta se mueve a columna "En Preparacion"
  -> cuando termina, click "Listo"
  -> estado cambia a 'listo'
  -> tarjeta se mueve a columna "Listos"
```

### Flujo 3: Mozo entrega pedido

```
admin.html -> Tab Comandas (rol: mozo)
  -> ve comandas con estado 'listo'
  -> click "Entregar"
  -> estado cambia a 'entregado'
  -> comanda queda disponible para cobro
```

### Flujo 4: Cajero genera boleta

```
admin.html -> Tab Caja (rol: cajero)
  -> ve comandas con estado 'entregado'
  -> click "Generar Boleta"
  -> modal con detalle: items, subtotal, IGV, total
  -> selecciona metodo de pago
  -> si efectivo: ingresa monto y calcula vuelto
  -> click "Emitir Boleta"
  -> se crea documento en 'boletas'
  -> comanda cambia a estado 'cobrado'
  -> opcion de imprimir ticket
```

### Flujo 5: Cierre de caja

```
admin.html -> Tab Caja
  -> fin del dia, cajero click "Cerrar Caja"
  -> sistema suma todas las boletas del dia
  -> muestra resumen por metodo de pago
  -> cajero agrega observaciones
  -> click "Confirmar Cierre"
  -> se crea documento en 'cierres_caja'
  -> opcion exportar a Excel
```

### Flujo 6: Autenticacion admin

```
admin.html -> pantalla login
  -> ingresa email y password
  -> Firebase Auth valida credenciales
  -> onAuthStateChanged detecta usuario
  -> busca datos en 'usuarios_admin' por uid
  -> si no existe y es el primero: crea como super_admin (bootstrap)
  -> obtiene rol y permisos
  -> registra acceso en auditoria
  -> muestra panel con tabs segun permisos
  -> inicializa listeners en tiempo real
```

---

## Tecnologias

| Tecnologia | Uso |
|------------|-----|
| HTML5 | Estructura semantica con aria-labels |
| CSS3 | Variables, grid, flexbox, animaciones, gradientes |
| JavaScript Vanilla | ES6+, clases, async/await, modulos import/export |
| Firebase Auth | Autenticacion email/password |
| Firebase Firestore | Base de datos tiempo real, CRUD, listeners |
| LocalStorage | Persistencia del carrito |
| Flatpickr | Selectores de fecha |
| XLSX.js | Exportacion a Excel |
| Service Worker | PWA offline |
| Google Fonts | Poppins (cuerpo), Montserrat (titulos) |

---

## Diseno Responsive

Breakpoints principales:
- Desktop: > 768px (grid multi-columna)
- Tablet: 768px (grids se reducen, sidebar se oculta)
- Movil: 480px (todo en 1 columna, menu hamburguesa)

Patron CSS:
- Mobile-first con media queries max-width
- Grid con auto-fit y minmax para adaptacion automatica
- Panel carrito como sidebar en desktop, modal en movil
- Botones touch-friendly (minimo 44px)

---

## PWA

manifest.json:
- name: nombre del restaurante
- short_name: nombre corto
- start_url: "/"
- display: standalone
- theme_color: color principal
- iconos: 192x192 y 512x512

Service Worker:
- Cache de assets estaticos (HTML, CSS, JS, imagenes)
- Estrategia cache-first para recursos estaticos
- Network-first para datos de Firebase
