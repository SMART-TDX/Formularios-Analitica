// ══════════════════════════════════════════════════════════════════
//  Banner Soporte Usuarios · Code.gs
//  Google Apps Script — Web App (doPost)
//
//  Configuración:
//  1. Reemplaza SPREADSHEET_ID con el ID de tu Google Sheet.
//  2. Despliega como Web App: Implementar > Nueva implementación
//     - Ejecutar como: yo (tu cuenta)
//     - Acceso: Cualquier persona
//  3. Copia la URL generada y pégala en index.html → SHEETS_URL
// ══════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = "PEGAR_ID_SPREADSHEET_AQUI";
const SHEET_NAME     = "Incidencias Banner";

const HEADERS = [
  "Fecha servidor",
  "Ticket ID",
  "Fecha navegador",
  "Nombre",
  "Correo",
  "Área",
  "Cargo",
  "Teléfono",
  "Módulo Banner",
  "Tipo incidencia",
  "Severidad",
  "Usuarios afectados",
  "Bloquea trabajo",
  "Descripción",
  "Fecha ocurrencia",
  "Frecuencia",
  "Pasos reproducir",
  "Mensaje de error",
  "Navegador / dispositivo",
  "Intentos de solución",
  "ID registro afectado",
  "Comentario adjuntos",
  "Archivos adjuntos",
  "Núm. archivos",
  "Estado"
];

const FIELDS = [
  "ticket_id",
  "submitted_at",
  "nombre",
  "correo",
  "area",
  "cargo",
  "telefono",
  "modulo",
  "tipo_incidencia",
  "severidad",
  "usuarios_afectados",
  "bloqueo",
  "descripcion",
  "fecha_ocurrencia",
  "frecuencia",
  "pasos",
  "mensaje_error",
  "navegador",
  "intentos",
  "id_afectado",
  "comentario_adjuntos",
  "archivos",
  "num_archivos"
];

// ── doPost ───────────────────────────────────────────────────────
function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const payload = JSON.parse(event.postData.contents || "{}");
    validatePayload_(payload);

    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    ensureHeaders_(sheet);

    const row = [new Date()]
      .concat(FIELDS.map(f => sanitize_(payload[f])))
      .concat(["Abierto"]);            // columna Estado

    sheet.appendRow(row);

    // Formato condicional rápido para la celda de severidad (col 10)
    colorSeverityRow_(sheet, sheet.getLastRow(), payload.severidad);

    return jsonResponse_({ ok: true, ticketId: payload.ticket_id });

  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ── doGet (health-check) ─────────────────────────────────────────
function doGet() {
  return jsonResponse_({ ok: true, status: "Banner Soporte API activa" });
}

// ── Helpers ──────────────────────────────────────────────────────
function validatePayload_(p) {
  const required = ["ticket_id", "nombre", "correo", "area", "cargo",
                    "modulo", "tipo_incidencia", "severidad",
                    "usuarios_afectados", "bloqueo", "descripcion", "fecha_ocurrencia"];
  required.forEach(f => {
    if (!p[f] || String(p[f]).trim() === "") {
      throw new Error("Campo requerido faltante: " + f);
    }
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo)) {
    throw new Error("Correo electrónico no válido: " + p.correo);
  }
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setFontWeight("bold")
         .setBackground("#5b1115")
         .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(13, 400);  // Descripción
  }
}

function colorSeverityRow_(sheet, rowNum, severidad) {
  const colors = { critica: "#fde8e8", alta: "#fff8e1", media: "#e8f4fd", baja: "#e8f8ee" };
  const bg = colors[String(severidad).toLowerCase()] || null;
  if (bg) {
    sheet.getRange(rowNum, 1, 1, HEADERS.length).setBackground(bg);
  }
}

function sanitize_(value) {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
