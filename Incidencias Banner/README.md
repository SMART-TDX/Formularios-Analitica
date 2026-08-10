# 📋 Formulario de Incidencias Smartgo — Banner

Sistema de mesa de ayuda para el reporte de incidencias de usuarios en **Ellucian Banner**, desarrollado para **Smart Academia de Idiomas** por el equipo de **TDX Analítica**.

---

## 📌 Descripción general

Aplicación web construida sobre **Google Apps Script** que permite a los usuarios de Banner reportar incidencias de forma estructurada. Los reportes se almacenan automáticamente en **Google Sheets** y los archivos adjuntos (capturas, PDFs, etc.) se suben a una carpeta de **Google Drive**.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────┐
│   banner-soporte-usuarios.html  │  ← Interfaz de usuario (servida por Apps Script)
│   · Formulario de 5 secciones   │
│   · google.script.run (no CORS) │
└────────────────┬────────────────┘
                 │ google.script.run.procesarFormulario()
                 ▼
┌─────────────────────────────────┐
│         Codigo.gs               │  ← Backend Google Apps Script
│   · procesarFormulario()        │
│   · doGet() → sirve el HTML     │
│   · doPost() → fallback API     │
│   · Validación de campos        │
│   · Subida a Google Drive       │
│   · Escritura en Google Sheets  │
└────────┬────────────┬───────────┘
         │            │
         ▼            ▼
  Google Sheets   Google Drive
  "Incidencias"   Carpeta por ticket
  (18 columnas)   BNR-YYYYMMDD-XXXX/
```

---

## 📁 Estructura del repositorio

```
formulario-incidencias-banner/
│
├── banner-soporte-usuarios.html   # Interfaz del formulario (subir a Apps Script)
├── Codigo.gs                      # Backend Apps Script (subir a Apps Script)
└── README.md                      # Este archivo
```

---

## 🚀 Despliegue paso a paso

### Prerrequisitos

- Cuenta de Google Workspace (dominio `@smartidiomas.edu.co`)
- Acceso a Google Drive con permisos de editor en la carpeta de evidencias
- Acceso al Google Sheet de registro de incidencias

### 1. Crear el proyecto en Apps Script

1. Ve a [https://script.google.com](https://script.google.com)
2. Crea un **nuevo proyecto**
3. Nómbralo, por ejemplo: `Formulario Incidencias Banner`

### 2. Agregar los archivos

En el editor de Apps Script:

**Archivo `Codigo.gs`:**
- Reemplaza el contenido del archivo `Codigo.gs` predeterminado con el contenido de `Codigo.gs` de este repositorio

**Archivo HTML:**
- Haz clic en **+** → **HTML**
- Nómbralo exactamente `banner-soporte-usuarios` (sin extensión, Apps Script la agrega automáticamente)
- Pega el contenido de `banner-soporte-usuarios.html`

### 3. Configurar los IDs

En `Codigo.gs`, actualiza las siguientes constantes con los valores de tu entorno:

```javascript
// ID del Google Sheet donde se guardan los registros
const SPREADSHEET_ID = "TU_SPREADSHEET_ID";

// ID de la carpeta de Drive donde se subirán los adjuntos
const DRIVE_FOLDER_ID = "TU_FOLDER_ID";

// Nombre exacto de la hoja dentro del Spreadsheet
const SHEET_NAME = "Incidencias";
```

> **¿Cómo obtener los IDs?**
> - **Spreadsheet ID:** es el texto largo en la URL del Sheet entre `/d/` y `/edit`
>   `https://docs.google.com/spreadsheets/d/`**`1XzJASL...`**`/edit`
> - **Folder ID:** es el texto al final de la URL de la carpeta de Drive
>   `https://drive.google.com/drive/folders/`**`1Q0MBlg...`**

### 4. Implementar como Web App

1. Clic en **Implementar** → **Nueva implementación**
2. Tipo: **Aplicación web**
3. Configuración:
   - **Ejecutar como:** Yo (tu cuenta)
   - **Quién tiene acceso:** Cualquier persona de Smart Academia de Idiomas
4. Clic en **Implementar**
5. Autoriza los permisos que solicite Google (Drive + Sheets)
6. Copia la **URL `/exec`** generada — esa es la URL del formulario

> ⚠️ **Importante:** cada vez que modifiques el código debes crear una **nueva implementación**, no actualizar la existente, para evitar problemas de caché.

---

## 📝 Campos del formulario

### Sección 1 — Datos de contacto
| Campo | Tipo | Requerido |
|-------|------|-----------|
| Nombre completo | Texto | ✅ |
| Correo institucional | Email | ✅ |
| Área | Selección | ✅ |
| Módulo Banner afectado | Texto libre | ✅ |

**Áreas disponibles:** Facturación y Cartera · Contabilidad · COFAE · Comercial · SAC · Exámenes Internacionales · Instituto · Smart Online · Smart Flex · Corporativo y personalizado

### Sección 2 — Tipo de incidencia
| Valor | Descripción |
|-------|-------------|
| `credenciales` | Contraseña / usuario no válido |
| `visualizacion` | Visualización no carga correctamente |
| `datos_contrato` | Error / inconsistencias en datos de contrato |
| `datos_admision` | Error / inconsistencias en datos de admisión |
| `formulario_fdi` | Registro e inconsistencias en formulario FDI |
| `detalle_cuenta` | Inconsistencias en detalle de cuenta |
| `codigos_detalle` | Configuración de códigos de detalle |
| `reporte_pagos` | Novedades con reportes de pagos |
| `reporte_matriculas` | Novedades con reportes de matrículas |
| `otro` | Otro (campo de texto abierto) |

### Sección 3 — Impacto y urgencia
| Campo | Opciones |
|-------|----------|
| ¿El problema bloquea tu trabajo? | `si_total` · `si_parcial` · `no` |

### Sección 4 — Descripción del problema
| Campo | Tipo | Requerido |
|-------|------|-----------|
| Descripción detallada | Textarea (mín. 30 chars) | ✅ |
| Fecha de ocurrencia | Date (dd/mm/yyyy) | ✅ |
| Mensaje de error | Texto | — |
| Navegador | Selección | — |
| ID Banner | Número | ✅ |

### Sección 5 — Archivos adjuntos
- Tipos aceptados: imágenes, PDF, Excel, Word, CSV, ZIP, LOG
- Tamaño máximo: **10 MB por archivo**
- Se suben a Google Drive en una subcarpeta con el nombre del ticket

---

## 🗂️ Estructura del Google Sheet

La hoja `Incidencias` tiene las siguientes columnas:

| Col | Campo | Descripción |
|-----|-------|-------------|
| A | Fecha registro | Timestamp del servidor al recibir el envío |
| B | Ticket ID | Formato `BNR-YYYYMMDD-XXXX` |
| C | Fecha formulario | ISO timestamp del navegador del usuario |
| D | Nombre | Nombre completo del reportante |
| E | Correo | Correo institucional |
| F | Área | Área o dependencia |
| G | Módulo Banner | Módulo afectado (texto libre) |
| H | Tipo incidencia | Categoría seleccionada |
| I | Descripción | Descripción detallada del problema |
| J | Fecha ocurrencia | Fecha en que ocurrió el problema |
| K | Mensaje de error | Código o texto del error (si aplica) |
| L | Navegador | Navegador usado |
| M | ID Banner | ID numérico del registro afectado |
| N | Bloquea trabajo | Nivel de bloqueo declarado |
| O | Archivos (nombres) | Nombres de archivos adjuntos separados por coma |
| P | Núm. archivos | Cantidad de archivos adjuntos |
| Q | Links Drive | URLs de los archivos en Drive (uno por línea) |
| R | Estado | Estado del ticket — inicia en `Abierto` |

**Código de colores por fila:**
- 🔴 Fondo rojo claro → bloqueo total (`si_total`)
- 🟡 Fondo amarillo → bloqueo parcial (`si_parcial`)
- 🟢 Fondo verde claro → no bloquea (`no`)

---

## 📂 Organización en Google Drive

Por cada ticket enviado con adjuntos se crea una subcarpeta:

```
📁 Evidencias_incidencias/
   └── 📁 BNR-20260806-X4K2/
          ├── 🖼️ captura_error.png
          ├── 📄 reporte.pdf
          └── 📊 datos_exportados.xlsx
```

Los archivos se comparten con acceso de **lectura para cualquiera con el link** y sus URLs quedan registradas en la columna Q del Sheet.

---

## 🔧 Funciones del backend (`Codigo.gs`)

| Función | Descripción |
|---------|-------------|
| `doGet()` | Sirve el formulario HTML cuando se accede a la URL `/exec` |
| `doPost(event)` | Endpoint REST alternativo (fallback) |
| `procesarFormulario(payload)` | Función principal llamada por `google.script.run` desde el HTML. Valida, sube adjuntos a Drive y guarda la fila en Sheets |
| `getOrCreateSheet_()` | Abre o crea la hoja de trabajo |
| `ensureHeaders_(sheet)` | Escribe los encabezados la primera vez |
| `colorByBloqueo_(sheet, row, val)` | Colorea la fila según nivel de bloqueo |
| `validatePayload_(p)` | Valida campos requeridos, email y ID numérico |
| `sanitize_(value)` | Previene inyección de fórmulas en Sheets |

---

## 🆔 Formato del Ticket ID

```
BNR - 20260806 - X4K2
 │       │         │
 │       │         └── 4 caracteres aleatorios (base36 mayúsculas)
 │       └──────────── Fecha de envío (YYYYMMDD)
 └──────────────────── Prefijo del sistema
```

---

## 🛠️ Mantenimiento

### Agregar una nueva área
En `banner-soporte-usuarios.html`, busca el `<select name="area">` y agrega un `<option>`:
```html
<option>Nueva Área</option>
```

### Agregar un nuevo tipo de incidencia
1. En el HTML, agrega una nueva `.tipo-card` con su radio button
2. No es necesario modificar el backend — el valor llega como texto

### Cambiar el nombre de la hoja
Modifica la constante en `Codigo.gs`:
```javascript
const SHEET_NAME = "NombreNuevo";
```
Luego crea una **nueva implementación**.

### Cambiar la carpeta de Drive
```javascript
const DRIVE_FOLDER_ID = "nuevo_id_de_carpeta";
```

---

## ⚠️ Consideraciones importantes

- Cada modificación al código requiere **nueva implementación** (no actualización)
- Los permisos de la carpeta de Drive deben permitir que la cuenta que ejecuta el script pueda escribir
- El formulario usa `google.script.run` para comunicarse con el backend — esto solo funciona cuando el HTML está alojado dentro del mismo proyecto de Apps Script
- Los archivos adjuntos se convierten a **base64 en el navegador** antes de enviarse, por lo que archivos muy grandes (>10 MB) pueden tardar o fallar

---

## 👥 Equipo

| Rol | Responsable |
|-----|------------|
| Desarrollo y arquitectura | TDX Analítica |
| Cliente | Smart Academia de Idiomas |

---

## 📅 Historial de versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0.0 | Ago 2026 | Versión inicial — formulario con 5 secciones, integración Sheets + Drive |
| 1.1.0 | Ago 2026 | Migración de `fetch` a `google.script.run` para eliminar problemas de CORS |
| 1.2.0 | Ago 2026 | Rediseño visual — branding Smartgo, imagen hero responsive, logo embebido en base64 |
