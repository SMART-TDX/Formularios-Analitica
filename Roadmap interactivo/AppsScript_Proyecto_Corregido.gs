const CONFIG = {
  HOJA_EMBAJADORES: 'Embajadores',
  HOJA_HISTORIAL: 'Historial_Avances',
  TOTAL_ETAPAS: 10,
  COLUMNAS: {
    ID: 1,
    NOMBRE: 2,
    ETAPA: 3,
    PROYECTO: 4,
    ESTADO: 5,
    ACTUALIZACION: 6,
    OBSERVACIONES: 7
  }
};

/**
 * Ejecuta esta función una sola vez después de pegar el código.
 * Verifica la estructura sin borrar los avances existentes.
 */
function configurarProyecto() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(CONFIG.HOJA_EMBAJADORES);

  if (!hoja) hoja = libro.insertSheet(CONFIG.HOJA_EMBAJADORES);

  const encabezados = [
    'embajador_id',
    'nombre',
    'etapa_actual',
    'proyecto',
    'estado',
    'ultima_actualizacion',
    'observaciones'
  ];

  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  hoja.setFrozenRows(1);

  const filas = Math.max(hoja.getLastRow() - 1, 1);

  const reglaEstado = SpreadsheetApp.newDataValidation()
    .requireValueInList(['No iniciado', 'En curso', 'Bloqueado', 'Completado'], true)
    .setAllowInvalid(false)
    .build();

  hoja.getRange(2, CONFIG.COLUMNAS.ESTADO, Math.max(filas, 100), 1)
    .setDataValidation(reglaEstado);

  hoja.autoResizeColumns(1, encabezados.length);
  hoja.setColumnWidth(CONFIG.COLUMNAS.PROYECTO, 280);
  hoja.setColumnWidth(CONFIG.COLUMNAS.OBSERVACIONES, 360);
}

function doGet(e) {
  try {
    return salidaJsonp_({
      ok: true,
      total_etapas: CONFIG.TOTAL_ETAPAS,
      embajadores: obtenerEmbajadores_()
    }, e && e.parameter ? e.parameter.callback : null);
  } catch (error) {
    return salidaJsonp_({ ok: false, error: error.message },
      e && e.parameter ? e.parameter.callback : null);
  }
}

function obtenerEmbajadores_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.HOJA_EMBAJADORES);

  if (!hoja || hoja.getLastRow() < 2) return [];

  const valores = hoja.getRange(2, 1, hoja.getLastRow() - 1, 7).getValues();

  return valores
    .filter(fila => fila[0] && fila[1])
    .map(fila => ({
      embajador_id: String(fila[0]),
      nombre: String(fila[1]),
      etapa_actual: Number(fila[2]) || 0,
      proyecto: String(fila[3] || ''),
      estado: String(fila[4] || 'No iniciado'),
      ultima_actualizacion: fila[5] || '',
      observaciones: String(fila[6] || '')
    }));
}

function salidaJsonp_(datos, callback) {
  const nombreCallback = String(callback || 'recibirEmbajadores')
    .replace(/[^a-zA-Z0-9_.$]/g, '');

  return ContentService
    .createTextOutput(nombreCallback + '(' + JSON.stringify(datos) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
