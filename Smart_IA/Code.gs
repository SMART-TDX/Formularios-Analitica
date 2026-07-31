const SPREADSHEET_ID = "1R8oqnxwTNUa8Q3JVTxlK4cjPfVDtyPhPF4xtKRzM-EA";
const SHEET_NAME = "Respuestas";

const HEADERS = [
  "Fecha del servidor", "ID del envío", "Fecha del navegador",
  "Nombre", "Correo", "Área", "Cargo", "Proceso", "Gerente o líder",
  "Actividades principales", "Actividad repetitiva", "Frecuencia", "Tiempo dedicado",
  "Dificultades", "Indicador de mejora", "Frecuencia de uso de IA", "Herramientas de IA",
  "Usos de IA", "Caso práctico", "Meta inicial", "Detalle de la meta",
  "Tiempo semanal", "Formación inicial", "Sesiones quincenales", "Ejecutar pruebas",
  "Presentar resultados", "Apoyar usuarios", "Políticas de seguridad",
  "Puntaje", "Clasificación", "Recomendación"
];

const FIELDS = [
  "submission_id", "submitted_at", "name", "email", "area", "role", "process", "manager",
  "q6_process", "q7_activity", "q8_frequency", "q9_duration", "q10_difficulties",
  "q11_improvement", "q12_ai_frequency", "q13_ai_tools", "q14_ai_uses",
  "q16_practical_case", "q17_initial_goal", "q17_goal_detail", "q18_weekly_time",
  "q19_training", "q19_sessions", "q19_tests", "q19_results", "q19_support", "q19_adjust",
  "score", "category", "recommendation"
];

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const payload = JSON.parse(event.postData.contents || "{}");
    validatePayload_(payload);

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    ensureHeaders_(sheet);

    const row = [new Date()].concat(FIELDS.map(field => sanitize_(payload[field])));
    sheet.appendRow(row);

    return json_({ ok: true, submissionId: payload.submission_id });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function validatePayload_(payload) {
  const required = ["submission_id", "name", "email", "area", "role", "process", "manager"];
  required.forEach(field => {
    if (!payload[field]) throw new Error(`Falta el campo obligatorio: ${field}`);
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new Error("El correo electrónico no es válido.");
  }
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
}

function sanitize_(value) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function json_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
