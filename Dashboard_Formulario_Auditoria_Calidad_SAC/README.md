# 🔍 Sistema de Auditoría de Calidad SAC
### Smart Academia de Idiomas · TDX Analítica

> Aplicación web construida sobre **Google Apps Script** para la auditoría diaria de calidad en el equipo de Servicio al Cliente (SAC), con integración directa a **Salesforce** y dashboards de desempeño individual para cada agente.

---

## 📋 Tabla de contenidos

- [Descripción general](#descripción-general)
- [Arquitectura](#arquitectura)
- [Archivos del proyecto](#archivos-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Configuración inicial](#configuración-inicial)
- [Estructura de Google Sheets](#estructura-de-google-sheets)
- [Control de acceso y roles](#control-de-acceso-y-roles)
- [Criterios de evaluación y pesos](#criterios-de-evaluación-y-pesos)
- [Sincronización con Salesforce](#sincronización-con-salesforce)
- [Funciones disponibles en Apps Script](#funciones-disponibles-en-apps-script)
- [Triggers automáticos](#triggers-automáticos)
- [URLs del sistema](#urls-del-sistema)
- [Mantenimiento](#mantenimiento)

---

## Descripción general

El sistema permite a los evaluadores del área de calidad auditar diariamente los casos resueltos por los agentes SAC en Salesforce. Cada evaluación califica 10 criterios con pesos ponderados, genera un puntaje automático y queda registrada en Google Sheets.

Los agentes evaluados pueden acceder a un **dashboard personal** donde visualizan sus propias métricas, tendencia de calidad, cumplimiento por criterio y comparativo anónimo vs el equipo.

**Flujo general:**
```
Salesforce (casos resueltos)
        ↓  sync nocturna 11pm
   Google Sheets (CASOS_SF)
        ↓  auditor busca caso
   Formulario de auditoría
        ↓  guarda evaluación
   Google Sheets (EVALUACIONES)
        ↓  agente consulta
   Dashboard personal
```

---

## Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                  Google Apps Script                  │
│                                                      │
│  Code.gs          page.html         dashboard.html   │
│  (Backend)        (Auditores)       (Agentes)        │
│                                                      │
│  ┌─────────┐    ┌────────────┐    ┌──────────────┐  │
│  │Salesforce│    │Formulario  │    │Dashboard     │  │
│  │REST API  │◄──►│auditoría   │    │personal      │  │
│  │OAuth 2.0 │    │+ métricas  │    │+ modo admin  │  │
│  └─────────┘    └────────────┘    └──────────────┘  │
│                          │                │          │
│                   ┌──────▼────────────────▼──────┐  │
│                   │      Google Sheets            │  │
│                   │  EVALUACIONES · CASOS_SF      │  │
│                   │  CONFIG · LOG_ERRORES         │  │
│                   └───────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Tecnologías:**
- Google Apps Script (backend + hosting)
- Google Sheets (base de datos)
- Salesforce REST API v59.0 con Client Credentials Flow (OAuth 2.0)
- Chart.js 4.4.0 (visualizaciones)
- HTML / CSS / JavaScript vanilla

---

## Archivos del proyecto

| Archivo | Descripción |
|---------|-------------|
| `Code.gs` | Backend completo: conexión SF, lógica de negocio, funciones de sincronización, control de acceso por rol |
| `page.html` | Interfaz de auditores: formulario de evaluación, historial con filtros, métricas del equipo, gráfica de criterios con mayor incumplimiento |
| `dashboard.html` | Dashboard de agentes: métricas personales, tendencia, criterios, historial con detalle, comparativo vs equipo, modo admin para evaluadores |

---

## Requisitos previos

1. **Cuenta de Google Workspace** con dominio `@smartidiomas.edu.co`
2. **Google Sheets** con las 4 hojas del sistema (ver [Estructura de Google Sheets](#estructura-de-google-sheets))
3. **Salesforce Connected App** configurada con Client Credentials Flow
4. Acceso a **Google Apps Script** vinculado al Spreadsheet

---

## Configuración inicial

### 1. Crear el proyecto en Apps Script

1. Abrir el Google Sheets del sistema
2. **Extensiones → Apps Script**
3. Crear tres archivos: `Code.gs`, `page.html`, `dashboard.html`
4. Pegar el contenido de cada archivo del repositorio

### 2. Configurar credenciales de Salesforce

En `Code.gs`, actualizar el objeto `CFG.sf`:

```javascript
const CFG = {
  sf: {
    instanceUrl  : 'https://TU_ORG.my.salesforce.com',
    clientId     : 'TU_CLIENT_ID',
    clientSecret : 'TU_CLIENT_SECRET',
    apiVersion   : 'v59.0',
    statusClosed : 'Resuelto',   // estado de caso cerrado en tu org
    emailField   : 'TextBody'    // campo de texto en EmailMessages
  }
};
```

### 3. Configurar la Connected App en Salesforce

1. **Setup → Gestor de aplicaciones → Nueva aplicación conectada**
2. Habilitar **OAuth Settings**
3. Scopes: `api`, `full`
4. Habilitar **Activar flujo de credenciales de cliente**
5. En **Gestionar → Editar políticas**: activar "Activar para flujo de credenciales de cliente"
6. Configurar **Ejecutar como** con el usuario de integración

### 4. Inicializar las hojas

Ejecutar en Apps Script:
```javascript
inicializarHojas()
```

Esto crea las 4 hojas con sus encabezados y formatos.

### 5. Crear los triggers automáticos

```javascript
crearTriggerSyncNocturno()
```

Crea dos triggers:
- `syncManualHoy` → todos los días a las 11:00pm
- `sincronizarAgentesManual` → todos los días a las 11:30pm

### 6. Desplegar la webapp

**Implementar → Nueva implementación → Aplicación web**
- Ejecutar como: **Yo**
- Quién tiene acceso: **Cualquier persona con cuenta de Google** (o dominio específico)

---

## Estructura de Google Sheets

### Hoja `EVALUACIONES`

Registro de todas las auditorías realizadas.

| Columna | Campo | Descripción |
|---------|-------|-------------|
| A | Timestamp | Fecha y hora del guardado (automático) |
| B | Fecha eval | Fecha de la evaluación |
| C | N° Caso | Número con ceros `00324626` — formato texto |
| D | Agente evaluado | Nombre del propietario del caso en SF |
| E | Evaluador | Nombre del auditor |
| F-O | C1 a C10 | Resultado por criterio: `Sí` / `No` |
| P | Puntaje | % ponderado calculado automáticamente |
| Q | Resultado | `Excelente` / `Cumple` / `Mejora` / `No cumple` |
| R | Observaciones | Retroalimentación del evaluador |

### Hoja `CASOS_SF`

Caché de casos sincronizados desde Salesforce cada noche.

| Columna | Campo |
|---------|-------|
| A | N° Caso (texto) |
| B | Propietario del caso |
| C | Estado |
| D | Fecha de cierre |
| E | Descripción del estudiante |
| F | Última respuesta del agente |
| G | Fecha de sincronización |

### Hoja `CONFIG` ⚠️ La más importante

Controla quién puede acceder al sistema y en qué rol.

| Col A | Col B | Col C | Col D |
|-------|-------|-------|-------|
| Nombre evaluador | **Correo evaluador** | Nombre agente | **Correo agente** |

> **Para dar acceso:** simplemente agregar el correo en la columna correspondiente. No requiere redespliegue ni cambios de código.

### Hoja `LOG_ERRORES`

Registro automático de errores y eventos del sistema.

---

## Control de acceso y roles

El sistema detecta el rol automáticamente según el correo de Google con el que el usuario inicia sesión:

```
Correo en CONFIG Col B → rol: evaluador  → acceso al formulario de auditoría
Correo en CONFIG Col D → rol: agente     → acceso al dashboard personal
Sin registro           → rol: denegado   → pantalla de acceso restringido
```

| Rol | `/exec` (formulario) | `/exec?page=dashboard` |
|-----|---------------------|------------------------|
| **Evaluador** | ✅ Acceso completo | 👁 Modo admin con selector de agentes |
| **Agente** | 🔒 Acceso restringido | ✅ Solo sus propios datos |
| **Sin registro** | 🔒 Acceso restringido | 🔒 Acceso restringido |

**Modo admin:** cuando un evaluador abre el dashboard, ve un banner amarillo con un selector que le permite elegir cualquier agente y previsualizar exactamente lo que ese agente vería al entrar.

---

## Criterios de evaluación y pesos

El puntaje se calcula de forma ponderada — no todos los criterios valen igual:

| # | Criterio | Peso |
|---|----------|------|
| 1 | Resolución en el primer contacto | **10%** |
| 2 | Claridad y fondo de la respuesta | **50%** |
| 3 | Saludo y cordialidad | 5% |
| 4 | Personalización del mensaje | 5% |
| 5 | Tiempo de respuesta adecuado | 5% |
| 6 | Registro correcto de campos | 5% |
| 7 | Cumplimiento del proceso | 5% |
| 8 | Experiencia del estudiante | 5% |
| 9 | Ortografía y redacción | 5% |
| 10 | Despedida y cierre apropiado | 5% |
| | **Total** | **100%** |

**Escala de resultados:**

| Puntaje | Resultado |
|---------|-----------|
| ≥ 90% | ⭐ Excelente |
| 80–89% | ✓ Cumple |
| 70–79% | ⚠ Mejora |
| < 70% | ✗ No cumple |

Para modificar los pesos, actualizar el array `PESOS` en `guardarEvaluacion()` dentro de `Code.gs`.

---

## Sincronización con Salesforce

### Sincronización nocturna automática

Cada noche a las 11pm el trigger ejecuta `syncManualHoy()` que:

1. Consulta `CaseHistory` en SF buscando casos cuyo estado cambió a `"Resuelto"` durante el día
2. Trae los datos en lotes de 20 IDs (límite de URL en Apps Script)
3. Guarda los casos nuevos en `CASOS_SF` sin duplicar
4. Registra automáticamente agentes nuevos en `CONFIG`

### Campos traídos de Salesforce al buscar un caso

Al buscar un caso en el formulario, el sistema consulta SF en tiempo real con estos campos:

```
CaseNumber, Subject, Owner.Name, Status, ClosedDate, CreatedDate,
Description, toLabel(Origin), Account.Name, Contact.Name,
toLabel(Tipo_de_Caso__c), toLabel(Motivo__c),
toLabel(Causa__c), toLabel(cc_Sede__c), D_as__c,
EmailMessages (última respuesta del agente),
Histories (fecha real de resolución)
```

> `toLabel()` convierte los valores internos de los campos picklist (ej: `0023`) al nombre visible (ej: `PALATINO`).

---

## Funciones disponibles en Apps Script

### Sincronización de casos

| Función | Descripción |
|---------|-------------|
| `syncManualHoy()` | Trae casos resueltos **hoy** — la función principal |
| `syncManualAyer()` | Trae casos resueltos **ayer** — para recuperar si falló el trigger |
| `syncRangoFechas()` | Recupera un rango específico — cambiar `DESDE` y `HASTA` antes de ejecutar |
| `syncCasosDesdeSD()` | Alias de `syncManualHoy()` — por compatibilidad |

### Configuración y mantenimiento

| Función | Descripción |
|---------|-------------|
| `setupCompleto()` | Setup inicial: corrige ceros + sincroniza agentes + crea triggers |
| `crearTriggerSyncNocturno()` | Recrea los triggers automáticos de 11pm y 11:30pm |
| `inicializarHojas()` | Crea las 4 hojas con encabezados si no existen |
| `fixFormatoColumnaA()` | Corrige los ceros iniciales en números de caso |
| `sincronizarAgentesManual()` | Actualiza agentes en CONFIG desde CASOS_SF |
| `actualizarCorreosConfig()` | Carga el listado completo de evaluadores y agentes en CONFIG |
| `limpiarCacheToken()` | Borra el token de SF cacheado (útil si hay error de autenticación) |
| `testConexionFinal()` | Verifica que la conexión con Salesforce funciona |
| `getUrlDashboard()` | Muestra en los Registros las URLs del formulario y del dashboard |

### Control de acceso

| Función | Descripción |
|---------|-------------|
| `getInfoUsuario()` | Detecta el rol del usuario por su correo en CONFIG |
| `getMisEvaluaciones(nombre)` | Devuelve evaluaciones del agente + promedio del equipo |
| `getConfig()` | Configuración general + validación de evaluador |

### Historial y métricas

| Función | Descripción |
|---------|-------------|
| `getHistorial(filtros)` | Evaluaciones con filtros de fecha, agente y resultado |
| `getMetricas(filtros)` | Ranking, tendencia, distribución y criterios con mayor incumplimiento |
| `getContadorHoy()` | Número de evaluaciones guardadas hoy |

---

## Triggers automáticos

| Función | Horario | Propósito |
|---------|---------|-----------|
| `syncManualHoy` | Todos los días 11:00pm | Descarga casos resueltos del día desde Salesforce |
| `sincronizarAgentesManual` | Todos los días 11:30pm | Sincroniza agentes nuevos en CONFIG |

Para verificar que están activos: **Apps Script → ⏰ Disparadores** (menú izquierdo).

Para recrearlos si desaparecen:
```javascript
crearTriggerSyncNocturno()
```

---

## URLs del sistema

Una vez desplegado, el sistema genera **una sola URL base** que sirve los dos módulos:

```
# Formulario de auditoría — para evaluadores
https://script.google.com/a/macros/DOMINIO/s/ID_DESPLIEGUE/exec

# Dashboard de agentes — para agentes evaluados
https://script.google.com/a/macros/DOMINIO/s/ID_DESPLIEGUE/exec?page=dashboard
```

Para obtener las URLs exactas después de desplegar:
```javascript
getUrlDashboard()
```

> ⚠️ Cada nueva implementación genera un ID diferente. Cuando se redespliegue, ejecutar `getUrlDashboard()` y compartir los nuevos enlaces con el equipo.

---

## Mantenimiento

### Revisión semanal recomendada

| Qué revisar | Dónde | Cuándo |
|-------------|-------|--------|
| Errores de sync | Hoja `LOG_ERRORES` | Lunes al llegar |
| Triggers activos | Apps Script → ⏰ | Lunes al llegar |
| Filas nuevas en CASOS_SF | Hoja `CASOS_SF` | Lunes al llegar |
| Correos pendientes de agregar | Hoja `CONFIG` col D | Al recibir correos nuevos |

### Agregar un nuevo evaluador

1. Abrir CONFIG en Sheets
2. Nueva fila: **Col A** = nombre, **Col B** = correo
3. Listo — sin redesplegar

### Agregar un nuevo agente al dashboard

1. Buscar su nombre en **Col C** de CONFIG (ya está si ha atendido casos en SF)
2. Agregar su correo en **Col D** de la misma fila
3. Compartirle la URL `?page=dashboard`
4. Listo — sin redesplegar

### Límites del sistema

| Límite | Valor | Comportamiento |
|--------|-------|----------------|
| Filas en EVALUACIONES | 50.000 | Se archiva y crea hoja nueva automáticamente |
| Casos por sync | 2.000/día | Ajustar `LIMIT` en `_getCasosResueltosPorHistorial()` si se supera |
| Token Salesforce | 90 min cacheado | Se renueva automáticamente |
| Lotes de IDs a SF | 20 por consulta | No modificar — evita límite de URL de Apps Script |
| Tiempo de ejecución | 6 min máximo | Si hay más de ~200 casos usar `syncRangoFechas()` |

### Si la webapp deja de funcionar

1. Ejecutar `getContadorHoy()` en Apps Script — si pide autorización, aceptarla
2. Verificar en **Implementar → Administrar**: Ejecutar como = `Yo`, Acceso = `Cualquier persona`
3. Redesplegar con nueva versión si es necesario
4. La URL cambia con cada nueva implementación — actualizar el enlace compartido

---

## Estructura del repositorio

```
/
├── Code.gs           # Backend: lógica, SF, Sheets, roles, sync
├── page.html         # Frontend auditores: formulario + historial + métricas
├── dashboard.html    # Frontend agentes: dashboard personal + modo admin
└── README.md         # Esta documentación
```

---

## Créditos

Desarrollado por **TDX Analítica** para **Smart Academia de Idiomas**  
Analista BI: Nicolás González · `analistabi@smartidiomas.edu.co`  
Supervisión de calidad: Luz Adriana Aristizábal Duarte · Coordinadora SAC  

---

*Sistema de Auditoría de Calidad SAC · Agosto 2026*
