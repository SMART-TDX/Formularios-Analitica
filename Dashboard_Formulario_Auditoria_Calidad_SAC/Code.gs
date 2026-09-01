// ============================================================
//  AUDITORÍA SAC — Backend (Code.gs) v9.2
// ============================================================

const CFG = {
  sheets: {
    evaluaciones : 'EVALUACIONES',
    casos        : 'CASOS_SF',
    config       : 'CONFIG',
    log          : 'LOG_ERRORES'
  },
  sf: {
    instanceUrl  : 'https://customization-computing-5922.my.salesforce.com',
    clientId     : 'TU_KEY_DE_SALESFORCE_AQUI',
    clientSecret : 'TU_SECRET_DE_SALESFORCE_AQUI',
    apiVersion   : 'v59.0',
    statusClosed : 'Resuelto',
    emailField   : 'TextBody'
  },
  meta: {
    metaDiaria    : 150,
    zonaHoraria   : 'America/Bogota',
    maxFilasSheet : 50000
  }
};

const CRITERIOS = [
  { id:1,  label:'Resolución en el primer contacto',  desc:'El caso se cerró sin reasignación ni escalamiento'  },
  { id:2,  label:'Claridad y fondo de la respuesta',  desc:'La respuesta aborda completamente la solicitud'      },
  { id:3,  label:'Saludo y cordialidad',              desc:'Saludo apropiado y tono respetuoso'                  },
  { id:4,  label:'Personalización del mensaje',       desc:'Respuesta específica al estudiante, no genérica'     },
  { id:5,  label:'Tiempo de respuesta adecuado',      desc:'Resuelto dentro del SLA establecido'                 },
  { id:6,  label:'Registro correcto de campos',       desc:'Tipificación completa en Salesforce'                 },
  { id:7,  label:'Cumplimiento del proceso',          desc:'Protocolo definido para este tipo de caso'           },
  { id:8,  label:'Experiencia del estudiante',        desc:'Interacción genera valor y experiencia positiva'     },
  { id:9,  label:'Ortografía y redacción',            desc:'Sin errores de escritura ni redacción'               },
  { id:10, label:'Despedida y cierre apropiado',      desc:'Cierre profesional y adecuado de la interacción'    }
];

function _ss()     { return SpreadsheetApp.getActiveSpreadsheet(); }
function _sheet(n) { return _ss().getSheetByName(n); }
function _hoy()    { return Utilities.formatDate(new Date(), CFG.meta.zonaHoraria, 'yyyy-MM-dd'); }
function _ts()     { return Utilities.formatDate(new Date(), CFG.meta.zonaHoraria, 'yyyy-MM-dd HH:mm:ss'); }

function _logError(fn, err) {
  try { const s = _sheet(CFG.sheets.log); if (s) s.appendRow([_ts(), fn, err.toString()]); } catch(e) {}
}

function _resultado(pct) {
  if (pct >= 90) return 'Excelente';
  if (pct >= 80) return 'Cumple';
  if (pct >= 70) return 'Mejora';
  return 'No cumple';
}

function _colorFila(r) {
  return { Excelente:'#dcfce7', Cumple:'#dbeafe', Mejora:'#fef3c7', 'No cumple':'#fee2e2' }[r] || '#ffffff';
}

function _toDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, CFG.meta.zonaHoraria, 'yyyy-MM-dd');
  const s = val.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  try { const d = new Date(s); if (!isNaN(d.getTime())) return Utilities.formatDate(d, CFG.meta.zonaHoraria, 'yyyy-MM-dd'); } catch(e) {}
  return s.substring(0, 10);
}

function _toPct(val) {
  if (!val && val !== 0) return 0;
  if (typeof val === 'number') return Math.round(val);
  return parseInt(val.toString().replace('%', '').trim()) || 0;
}

function _normCaso(num) {
  return num ? num.toString().trim().replace(/\D/g,'').padStart(8, '0') : '';
}

function _appendCasoEnSheet(sheet, numNorm, propietario, estado, fechaReal, descripcion, respuesta) {
  const lastRow = sheet.getLastRow() + 1;
  sheet.getRange(lastRow, 1, 1, 7).setValues([[numNorm, propietario, estado, fechaReal, descripcion, respuesta, _ts()]]);
  sheet.getRange(lastRow, 1).setNumberFormat('@STRING@');
}

function _getSheetEvaluaciones() {
  const ss = _ss();
  let sheet = ss.getSheetByName(CFG.sheets.evaluaciones);
  if (!sheet) return sheet;
  if (sheet.getLastRow() > CFG.meta.maxFilasSheet) {
    const archivo = CFG.sheets.evaluaciones + '_' + _hoy();
    sheet.setName(archivo);
    sheet = ss.insertSheet(CFG.sheets.evaluaciones);
    const enc = ['Timestamp','Fecha eval','N° Caso','Agente evaluado','Evaluador','C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','Puntaje','Resultado','Observaciones'];
    sheet.appendRow(enc);
    sheet.getRange(1,1,1,enc.length).setBackground('#C1272D').setFontColor('#fff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// doGet detecta si abren el formulario de auditoría o el dashboard de agente
// URL auditores:  [url base]
// URL agentes:    [url base]?page=dashboard
function doGet(e) {
  const page = e && e.parameter && e.parameter.page ? e.parameter.page : 'auditoria';
  if (page === 'dashboard') {
    return HtmlService
      .createHtmlOutputFromFile('dashboard.html')
      .setTitle('Mi Desempeño — SAC Smart Academia')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService
    .createHtmlOutputFromFile('page.html')
    .setTitle('Auditoría de Calidad SAC')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getConfig() {
  try {
    const data = _sheet(CFG.sheets.config).getDataRange().getValues();
    const evaluadores = [], agentes = [];
    let emailUsuario = '';
    try { emailUsuario = Session.getActiveUser().getEmail() || ''; } catch(e) {}

    data.forEach((r, i) => {
      if (i === 0) return;
      if (r[0] && r[0].toString().trim()) evaluadores.push(r[0].toString().trim());
      if (r[2] && r[2].toString().trim()) agentes.push(r[2].toString().trim());
    });

    // Verificar si el correo está en columna B (evaluadores)
    const correosEvaluadores = data.slice(1)
      .map(r => r[1] ? r[1].toString().trim().toLowerCase() : '')
      .filter(v => v);
    const esEvaluador = correosEvaluadores.includes(emailUsuario.toLowerCase());

    return { evaluadores, agentes, criterios: CRITERIOS, metaDiaria: CFG.meta.metaDiaria, emailUsuario, esEvaluador };
  } catch(e) {
    _logError('getConfig', e);
    return { evaluadores:[], agentes:[], criterios:CRITERIOS, metaDiaria:150, emailUsuario:'', esEvaluador:false };
  }
}

function _getSfToken() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('sf_token_cc');
  if (cached) return JSON.parse(cached);
  const resp = UrlFetchApp.fetch(CFG.sf.instanceUrl + '/services/oauth2/token', {
    method:'post', payload:{ grant_type:'client_credentials', client_id:CFG.sf.clientId, client_secret:CFG.sf.clientSecret }, muteHttpExceptions:true
  });
  if (resp.getResponseCode() !== 200) throw new Error('Auth SF falló: ' + resp.getContentText());
  const token = JSON.parse(resp.getContentText());
  cache.put('sf_token_cc', JSON.stringify(token), 5400);
  return token;
}

function _getCasosResueltosPorHistorial(fechaDesdeStr, fechaHastaStr) {
  const token = _getSfToken();
  const soql = `SELECT CaseId, Field, OldValue, NewValue, CreatedDate FROM CaseHistory WHERE Field = 'Status' AND CreatedDate >= ${fechaDesdeStr}T00:00:00Z AND CreatedDate < ${fechaHastaStr}T00:00:00Z ORDER BY CreatedDate DESC LIMIT 2000`;
  const resp = UrlFetchApp.fetch(token.instance_url + '/services/data/' + CFG.sf.apiVersion + '/query?q=' + encodeURIComponent(soql), { headers:{ Authorization:'Bearer ' + token.access_token }, muteHttpExceptions:true });
  if (resp.getResponseCode() !== 200) throw new Error('CaseHistory error: ' + resp.getContentText());
  const resueltos = {};
  (JSON.parse(resp.getContentText()).records || []).forEach(r => {
    if (r.NewValue && r.NewValue.toString() === CFG.sf.statusClosed && !resueltos[r.CaseId]) resueltos[r.CaseId] = r.CreatedDate;
  });
  return resueltos;
}

function _getCasosByIds(caseIds, token) {
  if (!caseIds.length) return [];
  const ef = CFG.sf.emailField || 'TextBody';
  const chunks = [];
  for (let i = 0; i < caseIds.length; i += 20) chunks.push(caseIds.slice(i, i + 20));
  let todos = [];
  chunks.forEach((chunk, idx) => {
    const soql = `SELECT Id, CaseNumber, Owner.Name, Status, Description, (SELECT ${ef} FROM EmailMessages WHERE Incoming = false ORDER BY CreatedDate DESC LIMIT 1) FROM Case WHERE Id IN (${chunk.map(id => "'" + id + "'").join(',')})`;
    try {
      const resp = UrlFetchApp.fetch(token.instance_url + '/services/data/' + CFG.sf.apiVersion + '/query?q=' + encodeURIComponent(soql), { headers:{ Authorization:'Bearer ' + token.access_token }, muteHttpExceptions:true });
      if (resp.getResponseCode() === 200) { todos = todos.concat(JSON.parse(resp.getContentText()).records || []); Logger.log('Lote '+(idx+1)+' OK'); }
    } catch(e) { Logger.log('Error lote '+(idx+1)+': '+e.message); }
  });
  return todos;
}

function _sincronizarAgentesEnConfig() {
  try {
    const ssCasos = _sheet(CFG.sheets.casos), ssConfig = _sheet(CFG.sheets.config);
    if (!ssCasos || !ssConfig) return;
    const propietarios = new Set(ssCasos.getDataRange().getValues().slice(1).map(r => r[1]?r[1].toString().trim():'').filter(v=>v));
    const rowsConfig = ssConfig.getDataRange().getValues();
    const existentes = new Set(rowsConfig.slice(1).map(r => r[2]?r[2].toString().trim():'').filter(v=>v));
    const nuevos = [...propietarios].filter(p => !existentes.has(p));
    if (!nuevos.length) { Logger.log('Sin agentes nuevos.'); return; }
    let rows = ssConfig.getDataRange().getValues();
    nuevos.forEach(nombre => {
      let ok = false;
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][2] || !rows[i][2].toString().trim()) { ssConfig.getRange(i+1,3).setValue(nombre); rows[i][2]=nombre; ok=true; break; }
      }
      if (!ok) { const lr = ssConfig.getLastRow()+1; ssConfig.getRange(lr,3).setValue(nombre); rows.push(['','',nombre]); }
    });
    Logger.log('✅ Agentes nuevos: ' + nuevos.join(', '));
  } catch(e) { _logError('_sincronizarAgentesEnConfig', e); }
}

function sincronizarAgentesManual() {
  _sincronizarAgentesEnConfig();
  const agentes = _sheet(CFG.sheets.config).getDataRange().getValues().slice(1).map(r=>r[2]?r[2].toString().trim():'').filter(v=>v);
  Logger.log('Agentes en CONFIG ('+agentes.length+'): '+agentes.join(', '));
}

function _ejecutarSync(fechaDesdeStr, fechaHastaStr, etiqueta) {
  const resueltos = _getCasosResueltosPorHistorial(fechaDesdeStr, fechaHastaStr);
  const caseIds = Object.keys(resueltos);
  Logger.log(etiqueta + ': ' + caseIds.length + ' casos');
  if (!caseIds.length) return { ok:true, insertados:0, omitidos:0, total:0 };
  const token = _getSfToken();
  const casos = _getCasosByIds(caseIds, token);
  const sheet = _sheet(CFG.sheets.casos);
  const existentes = new Set(sheet.getDataRange().getValues().slice(1).map(r=>r[0].toString().trim()).filter(v=>v));
  let insertados = 0, omitidos = 0;
  casos.forEach(c => {
    const numNorm = _normCaso(c.CaseNumber);
    if (existentes.has(numNorm)) { omitidos++; return; }
    const ef = CFG.sf.emailField || 'TextBody';
    const emails = c.EmailMessages ? c.EmailMessages.records : [];
    const respuesta = emails.length ? (emails[0][ef]||'') : '';
    const fechaReal = resueltos[c.Id] ? resueltos[c.Id].substring(0,10) : fechaDesdeStr;
    _appendCasoEnSheet(sheet, numNorm, c.Owner?c.Owner.Name:'', c.Status, fechaReal, c.Description||'', respuesta);
    insertados++;
  });
  if (insertados > 0) _sincronizarAgentesEnConfig();
  return { ok:true, insertados, omitidos, total:caseIds.length };
}

// ── syncManualHoy: trae casos resueltos HOY (00:00 hasta ahora)
// Es la función principal de sync — más confiable que syncCasosDesdeSD
function syncManualHoy() {
  try {
    const zona = CFG.meta.zonaHoraria;
    const hoy    = new Date();
    const manana = new Date(hoy); manana.setDate(hoy.getDate()+1);
    const r = _ejecutarSync(
      Utilities.formatDate(hoy,    zona, 'yyyy-MM-dd'),
      Utilities.formatDate(manana, zona, 'yyyy-MM-dd'),
      'HOY'
    );
    Logger.log(r.ok
      ? '✅ Sync HOY — Insertados: '+r.insertados+' | Omitidos: '+r.omitidos+' | Total: '+r.total
      : '❌ '+r.error);
  } catch(e) { Logger.log('❌ '+e.message); _logError('syncManualHoy',e); }
}

// ── syncManual: alias de syncManualHoy para compatibilidad
function syncManual() {
  syncManualHoy();
}

// ── syncCasosDesdeSD: se mantiene pero ya no se usa en trigger
// El trigger nocturno ahora llama a syncManualHoy directamente
function syncCasosDesdeSD() {
  syncManualHoy();
}

function buscarCaso(numeroCaso) {
  try {
    const raw = numeroCaso.toString().trim();
    const numConCeros = _normCaso(raw);
    const variantes = raw === numConCeros ? [raw] : [raw, numConCeros];
    for (const num of variantes) { const local = _buscarEnCache(num); if (local.encontrado) return local; }
    const sf = _buscarEnSalesforce(numConCeros);
    if (sf.encontrado) { _guardarEnCache(sf); return sf; }
    return { encontrado:false, mensaje:sf.mensaje||'Caso no encontrado. Verifique el número y que el estado sea "'+CFG.sf.statusClosed+'".' };
  } catch(e) { _logError('buscarCaso',e); return { encontrado:false, mensaje:'Error: '+e.message }; }
}

function _buscarEnCache(num) {
  const sheet = _sheet(CFG.sheets.casos);
  if (!sheet) return { encontrado: false };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().trim() === num) {
      const sf = _buscarEnSalesforce(num);
      if (sf.encontrado) return sf;
      return {
        encontrado:true, fuente:'cache',
        caso:rows[i][0].toString(), propietario:rows[i][1].toString(),
        estado:rows[i][2].toString(), fechaCierre:_toDateStr(rows[i][3]),
        descripcion:rows[i][4].toString(), respuesta:rows[i][5].toString(),
        fechaApertura:'', diasGestion:'—', asunto:'', estudiante:'',
        tipo:'', proceso:'', causa:'', sede:'', origen:''
      };
    }
  }
  return { encontrado: false };
}

function _guardarEnCache(data) {
  try {
    const sheet = _sheet(CFG.sheets.casos);
    if (!sheet) return;
    _appendCasoEnSheet(sheet, _normCaso(data.caso), data.propietario, data.estado, data.fechaCierre, data.descripcion, data.respuesta);
  } catch(e) { _logError('_guardarEnCache',e); }
}

function _buscarEnSalesforce(numeroCaso) {
  try {
    const token = _getSfToken();
    const ef = CFG.sf.emailField || 'TextBody';
    const soql = `SELECT Id, CaseNumber, Subject, Owner.Name, Status,
                  ClosedDate, CreatedDate, Description,
                  toLabel(Origin), Account.Name, Contact.Name,
                  toLabel(Tipo_de_Caso__c), toLabel(Motivo__c),
                  toLabel(Causa__c), toLabel(cc_Sede__c), D_as__c,
                  (SELECT ${ef} FROM EmailMessages WHERE Incoming = false ORDER BY CreatedDate DESC LIMIT 1),
                  (SELECT OldValue, NewValue, CreatedDate FROM Histories WHERE Field = 'Status' ORDER BY CreatedDate DESC LIMIT 5)
                  FROM Case WHERE CaseNumber = '${numeroCaso}' LIMIT 1`;
    const resp = UrlFetchApp.fetch(
      token.instance_url + '/services/data/' + CFG.sf.apiVersion + '/query?q=' + encodeURIComponent(soql),
      { headers:{ Authorization:'Bearer '+token.access_token }, muteHttpExceptions:true }
    );
    if (resp.getResponseCode() !== 200) {
      _logError('_buscarEnSalesforce', new Error('HTTP '+resp.getResponseCode()+': '+resp.getContentText()));
      return { encontrado:false };
    }
    const data = JSON.parse(resp.getContentText());
    if (!data.records || !data.records.length) return { encontrado:false };
    const r = data.records[0];
    const emails    = r.EmailMessages ? r.EmailMessages.records : [];
    const historias = r.Histories     ? r.Histories.records     : [];
    const respuesta = emails.length ? (emails[0][ef]||emails[0].TextBody||'(Sin respuesta registrada)') : '(Sin respuesta registrada)';
    const entradaResuelto = historias.find(h => h.NewValue && h.NewValue.toString() === CFG.sf.statusClosed);
    const fechaReal = entradaResuelto ? entradaResuelto.CreatedDate.substring(0,10) : (r.ClosedDate ? r.ClosedDate.substring(0,10) : '');
    if (r.Status !== CFG.sf.statusClosed) {
      return { encontrado:false, mensaje:'El caso '+numeroCaso+' existe pero su estado es "'+r.Status+'", no "'+CFG.sf.statusClosed+'".' };
    }
    let diasGestion = '—';
    if (r['D_as__c'] !== null && r['D_as__c'] !== undefined) {
      diasGestion = r['D_as__c'];
    } else {
      try {
        const diff = Math.round((new Date(fechaReal||new Date()) - new Date(r.CreatedDate)) / 86400000);
        if (diff >= 0) diasGestion = diff;
      } catch(e) {}
    }
    return {
      encontrado:true, fuente:'salesforce',
      caso:_normCaso(r.CaseNumber), asunto:r.Subject||'',
      propietario:r.Owner ? r.Owner.Name : '',
      estudiante:r.Contact ? r.Contact.Name : (r.Account ? r.Account.Name : ''),
      estado:r.Status, fechaApertura:r.CreatedDate ? r.CreatedDate.substring(0,10) : '',
      fechaCierre:fechaReal, diasGestion,
      tipo:r['Tipo_de_Caso__c']||'', proceso:r['Motivo__c']||'',
      causa:r['Causa__c']||'', sede:r['cc_Sede__c']||'',
      origen:r['Origin']||'', descripcion:r.Description||'', respuesta
    };
  } catch(e) { _logError('_buscarEnSalesforce',e); return { encontrado:false, mensaje:'Error: '+e.message }; }
}

function guardarEvaluacion(data) {
  try {
    const sheet = _getSheetEvaluaciones();
    const PESOS = [10, 50, 5, 5, 5, 5, 5, 5, 5, 5]; // C1 a C10 — suma 100
    const pct = Math.round(
    data.criterios.reduce(function(suma, cumple, i) {
    return suma + (cumple ? (PESOS[i] || 0) : 0);
      }, 0)
    );
    const cumplidos = data.criterios.filter(v => v === true).length;
    const resultado = _resultado(pct);
    let emailEval = data.evaluador || '';
    if (!emailEval) { try { emailEval = Session.getActiveUser().getEmail()||''; } catch(e) {} }
    const fila = [_ts(), data.fechaEval?data.fechaEval.toString():_hoy(), _normCaso(data.caso), data.agente, emailEval, ...data.criterios.map(v=>v?'Sí':'No'), pct, resultado, data.observaciones||''];
    const lastRow = sheet.getLastRow() + 1;
    sheet.getRange(lastRow,1,1,fila.length).setValues([fila]);
    sheet.getRange(lastRow,3).setNumberFormat('@STRING@');
    sheet.getRange(lastRow,1,1,fila.length).setBackground(_colorFila(resultado));
    sheet.getRange(lastRow,16).setFontWeight('bold');
    return { ok:true, pct, resultado, cumplidos, timestamp:_ts() };
  } catch(e) { _logError('guardarEvaluacion',e); return { ok:false, error:e.message }; }
}

function getHistorial(filtros) {
  try {
    const sheet = _sheet(CFG.sheets.evaluaciones);
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { registros:[], totales:{total:0,promedio:0,excelentes:0,noCumplen:0} };
    const headers = rows[0].map(h=>h.toString().trim().toLowerCase());
    const col = { fechaEval:headers.indexOf('fecha eval'), caso:headers.indexOf('n° caso'), agente:headers.indexOf('agente evaluado'), evaluador:headers.indexOf('evaluador'), puntaje:headers.indexOf('puntaje'), resultado:headers.indexOf('resultado'), obs:headers.indexOf('observaciones') };
    if (col.fechaEval<0) col.fechaEval=1; if (col.caso<0) col.caso=2; if (col.agente<0) col.agente=3;
    if (col.evaluador<0) col.evaluador=4; if (col.puntaje<0) col.puntaje=15; if (col.resultado<0) col.resultado=16; if (col.obs<0) col.obs=17;
    let registros = [];
    for (let i=1; i<rows.length; i++) {
      const r=rows[i]; if (!r[col.caso]&&!r[col.agente]) continue;
      const fechaEval=_toDateStr(r[col.fechaEval]), agente=r[col.agente]?r[col.agente].toString().trim():'', resultado=r[col.resultado]?r[col.resultado].toString().trim():'', caso=r[col.caso]?r[col.caso].toString().trim():'', pct=_toPct(r[col.puntaje]);
      if (filtros.desde&&fechaEval&&fechaEval<filtros.desde) continue;
      if (filtros.hasta&&fechaEval&&fechaEval>filtros.hasta) continue;
      if (filtros.agente&&agente&&agente!==filtros.agente) continue;
      if (filtros.resultado&&resultado&&resultado!==filtros.resultado) continue;
      if (filtros.caso&&!caso.toLowerCase().includes(filtros.caso.toLowerCase().replace(/\D/g,''))) continue;
      registros.push({ fechaEval, caso, agente, evaluador:r[col.evaluador]?r[col.evaluador].toString():'', pct, resultado, observaciones:r[col.obs]?r[col.obs].toString():'' });
    }
    const sortCol=filtros.sortCol||'pct', sortAsc=filtros.sortAsc===true;
    registros.sort((a,b)=>{ let va=a[sortCol],vb=b[sortCol]; if(sortCol==='pct'){va=Number(va);vb=Number(vb);} if(va<vb)return sortAsc?-1:1; if(va>vb)return sortAsc?1:-1; return 0; });
    const totalPct = registros.reduce((s,r)=>s+r.pct,0);
    return { registros, totales:{ total:registros.length, promedio:registros.length?Math.round(totalPct/registros.length):0, excelentes:registros.filter(r=>r.resultado==='Excelente').length, noCumplen:registros.filter(r=>r.resultado==='No cumple').length } };
  } catch(e) { _logError('getHistorial',e); return { registros:[], totales:{total:0,promedio:0,excelentes:0,noCumplen:0} }; }
}

function getMetricas(filtros) {
  try {
    const res = getHistorial(filtros || {});
    const registros = res.registros;
    if (!registros.length) return { rankingAgentes:[], tendencia:[], distribucion:[], totales:res.totales, criteriosIncumplimiento:[] };
 
    // Ranking agentes
    const porAgente = {};
    registros.forEach(r => {
      if (!porAgente[r.agente]) porAgente[r.agente] = { total:0, suma:0 };
      porAgente[r.agente].total++; porAgente[r.agente].suma += r.pct;
    });
    const rankingAgentes = Object.entries(porAgente)
      .map(([agente,d]) => ({ agente, promedio:Math.round(d.suma/d.total), evaluaciones:d.total }))
      .sort((a,b) => b.promedio - a.promedio);
 
    // Tendencia
    const porFecha = {};
    registros.forEach(r => {
      if (!porFecha[r.fechaEval]) porFecha[r.fechaEval] = { total:0, suma:0 };
      porFecha[r.fechaEval].total++; porFecha[r.fechaEval].suma += r.pct;
    });
    const tendencia = Object.entries(porFecha)
      .map(([fecha,d]) => ({ fecha, promedio:Math.round(d.suma/d.total), evaluaciones:d.total }))
      .sort((a,b) => a.fecha.localeCompare(b.fecha));
 
    // Distribución
    const dist = { Excelente:0, Cumple:0, Mejora:0, 'No cumple':0 };
    registros.forEach(r => { if (dist[r.resultado] !== undefined) dist[r.resultado]++; });
    const distribucion = Object.entries(dist).map(([label,count]) => ({ label, count }));
 
    // ── NUEVO: Criterios con mayor incumplimiento ──────────────
    // Leer directamente de EVALUACIONES para tener C1-C10 por fila
    const criteriosNombres = CRITERIOS.map(c => c.label);
    const sheet  = _sheet(CFG.sheets.evaluaciones);
    const rows   = sheet.getDataRange().getValues();
    const headers= rows[0].map(h => h.toString().trim().toLowerCase());
 
    const colAgente  = headers.indexOf('agente evaluado');
    const colFecha   = headers.indexOf('fecha eval');
    const colResult  = headers.indexOf('resultado');
    // Columnas C1-C10
    const colsC = [];
    for (let i = 0; i < 10; i++) {
      const idx = headers.indexOf('c' + (i+1));
      colsC.push(idx >= 0 ? idx : 6+i);
    }
 
    const critStats = Array.from({length:10}, (_, i) => ({ label:criteriosNombres[i]||'C'+(i+1), cumple:0, noCumple:0, total:0 }));
 
    for (let i = 1; i < rows.length; i++) {
      const r       = rows[i];
      const agente  = r[colAgente >= 0 ? colAgente : 3] ? r[colAgente >= 0 ? colAgente : 3].toString().trim() : '';
      const fecha   = _toDateStr(r[colFecha >= 0 ? colFecha : 1]);
 
      // Aplicar mismos filtros que getHistorial
      if (filtros.desde     && fecha   && fecha   < filtros.desde) continue;
      if (filtros.hasta     && fecha   && fecha   > filtros.hasta) continue;
      if (filtros.agente    && agente  && agente !== filtros.agente) continue;
      if (filtros.resultado && r[colResult >= 0 ? colResult : 16] && r[colResult >= 0 ? colResult : 16].toString().trim() !== filtros.resultado) continue;
 
      colsC.forEach((col, idx) => {
        const val = r[col] ? r[col].toString().trim().toLowerCase() : '';
        if (!val) return;
        critStats[idx].total++;
        if (val === 'sí' || val === 'si') critStats[idx].cumple++;
        else critStats[idx].noCumple++;
      });
    }
 
    // Solo incluir criterios con al menos 1 evaluación
    const criteriosIncumplimiento = critStats
      .filter(c => c.total > 0)
      .sort((a,b) => b.noCumple - a.noCumple);
 
    return { rankingAgentes, tendencia, distribucion, totales:res.totales, criteriosIncumplimiento };
  } catch(e) {
    _logError('getMetricas', e);
    return { rankingAgentes:[], tendencia:[], distribucion:[], criteriosIncumplimiento:[] };
  }
}

function getContadorHoy() {
  try { const rows=_sheet(CFG.sheets.evaluaciones).getDataRange().getValues(), hoy=_hoy(); return rows.slice(1).filter(r=>r[1]&&_toDateStr(r[1])===hoy).length; } catch(e) { return 0; }
}

function testConexionFinal() {
  try {
    const token=_getSfToken(); Logger.log('✅ Token OK — '+token.instance_url);
    const resp=UrlFetchApp.fetch(token.instance_url+'/services/data/'+CFG.sf.apiVersion+'/query?q='+encodeURIComponent('SELECT Id, CaseNumber, Status FROM Case LIMIT 5'),{headers:{Authorization:'Bearer '+token.access_token},muteHttpExceptions:true});
    const data=JSON.parse(resp.getContentText());
    if(resp.getResponseCode()===200&&data.records){Logger.log('✅ Query OK — Total: '+data.totalSize+' | '+data.records.map(r=>r.CaseNumber+' ('+r.Status+')').join(' | '));}
  } catch(e){Logger.log('❌ '+e.message);}
}

function limpiarCacheToken() { CacheService.getScriptCache().remove('sf_token_cc'); Logger.log('✅ Caché limpiado.'); }

function inicializarHojas() {
  const ss=_ss();
  function crearHoja(nombre,enc,color){let s=ss.getSheetByName(nombre);if(!s)s=ss.insertSheet(nombre);if(s.getLastRow()===0){s.appendRow(enc);s.getRange(1,1,1,enc.length).setBackground(color).setFontColor('#fff').setFontWeight('bold');s.setFrozenRows(1);}return s;}
  crearHoja(CFG.sheets.evaluaciones,['Timestamp','Fecha eval','N° Caso','Agente evaluado','Evaluador','C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','Puntaje','Resultado','Observaciones'],'#C1272D');
  crearHoja(CFG.sheets.casos,['N° Caso','Propietario','Estado','Fecha cierre','Descripción','Última respuesta agente','Fecha sync'],'#374151');
  crearHoja(CFG.sheets.log,['Timestamp','Función','Detalle'],'#7f1d1d');
  let cfg=ss.getSheetByName(CFG.sheets.config);
  if(!cfg){cfg=ss.insertSheet(CFG.sheets.config);cfg.appendRow(['Evaluadores','','Agentes evaluados']);cfg.getRange(1,1,1,3).setBackground('#374151').setFontColor('#fff').setFontWeight('bold');[['Luz Adriana Aristizábal','','Agente 1'],['Coordinador SAC 1','','Agente 2'],['Coordinador SAC 2','','Agente 3']].forEach(r=>cfg.appendRow(r));cfg.setFrozenRows(1);}
  Logger.log('✅ Hojas inicializadas.');
}

function fixFormatoColumnaA() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const casosSF=ss.getSheetByName(CFG.sheets.casos);
  if(casosSF){casosSF.getRange('A:A').setNumberFormat('@STRING@');const rows=casosSF.getDataRange().getValues();let n=0;rows.forEach((row,i)=>{if(i===0||!row[0])return;casosSF.getRange(i+1,1).setValue("'"+row[0].toString().trim().replace(/\D/g,'').padStart(8,'0'));n++;});Logger.log('✅ CASOS_SF col A — '+n+' filas');}
  const evalSheet=ss.getSheetByName(CFG.sheets.evaluaciones);
  if(evalSheet){evalSheet.getRange('C:C').setNumberFormat('@STRING@');const rows=evalSheet.getDataRange().getValues();let n=0;rows.forEach((row,i)=>{if(i===0||!row[2])return;evalSheet.getRange(i+1,3).setValue("'"+row[2].toString().trim().replace(/\D/g,'').padStart(8,'0'));n++;});Logger.log('✅ EVALUACIONES col C — '+n+' filas');}
}

// ── TRIGGER: ahora usa syncManualHoy (la que sí funciona) ──
function crearTriggerSyncNocturno() {
  // Eliminar TODOS los triggers anteriores para no duplicar
  ScriptApp.getProjectTriggers()
    .filter(t => ['syncCasosDesdeSD','syncManualHoy','sincronizarAgentesManual']
      .includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));

  // TRIGGER 1: syncManualHoy a las 11pm — es la que SÍ funciona
  ScriptApp.newTrigger('syncManualHoy')
    .timeBased().atHour(23).everyDays(1)
    .inTimezone(CFG.meta.zonaHoraria).create();

  // TRIGGER 2: sincronizarAgentesManual a las 11:30pm
  ScriptApp.newTrigger('sincronizarAgentesManual')
    .timeBased().atHour(23).nearMinute(30).everyDays(1)
    .inTimezone(CFG.meta.zonaHoraria).create();

  Logger.log('✅ Triggers recreados:');
  Logger.log('   11:00pm → syncManualHoy          (descarga casos del día ✓)');
  Logger.log('   11:30pm → sincronizarAgentesManual (sincroniza agentes en CONFIG)');
  Logger.log('');
  Logger.log('⚠️  syncCasosDesdeSD ya NO está en el trigger — no funcionaba bien.');
}


// Sync manual de casos resueltos AYER
function syncManualAyer() {
  try {
    const zona  = CFG.meta.zonaHoraria;
    const ayer  = new Date(); ayer.setDate(ayer.getDate() - 1);
    const hoy   = new Date();
    const r = _ejecutarSync(
      Utilities.formatDate(ayer, zona, 'yyyy-MM-dd'),
      Utilities.formatDate(hoy,  zona, 'yyyy-MM-dd'),
      'AYER'
    );
    Logger.log(r.ok
      ? '✅ Sync AYER — Insertados: ' + r.insertados + ' | Omitidos: ' + r.omitidos + ' | Total SF: ' + r.total
      : '❌ ' + r.error);
  } catch(e) {
    Logger.log('❌ syncManualAyer: ' + e.message);
    _logError('syncManualAyer', e);
  }
}

// Sync de un rango de fechas específico (para recuperar días perdidos)
// Uso: cambiar las fechas y ejecutar manualmente
function syncRangoFechas() {
  try {
    const zona   = CFG.meta.zonaHoraria;
    // ── CAMBIAR ESTAS FECHAS SEGÚN LO QUE SE NECESITE RECUPERAR ──
    const DESDE  = '2026-07-02';  // día que falta (inclusive)
    const HASTA  = '2026-07-09';  // día hasta (exclusive, no incluye este)
    // ─────────────────────────────────────────────────────────────

    Logger.log('Sincronizando rango: ' + DESDE + ' → ' + HASTA);
    const r = _ejecutarSync(DESDE, HASTA, 'rango ' + DESDE + ' al ' + HASTA);
    Logger.log(r.ok
      ? '✅ Sync rango — Insertados: ' + r.insertados + ' | Omitidos: ' + r.omitidos + ' | Total SF: ' + r.total
      : '❌ ' + r.error);
  } catch(e) {
    Logger.log('❌ syncRangoFechas: ' + e.message);
    _logError('syncRangoFechas', e);
  }
}
function setupCompleto() {
  Logger.log('═══════════════════════════════════');
  Logger.log('  SETUP COMPLETO — Auditoría SAC v9.2');
  Logger.log('═══════════════════════════════════');
  Logger.log('[1/3] Corrigiendo ceros...'); fixFormatoColumnaA();
  Logger.log('[2/3] Sincronizando agentes...'); _sincronizarAgentesEnConfig();
  const agentes=_sheet(CFG.sheets.config).getDataRange().getValues().slice(1).map(r=>r[2]?r[2].toString().trim():'').filter(v=>v);
  Logger.log('✅ Agentes ('+agentes.length+'): '+agentes.join(', '));
  Logger.log('[3/3] Creando triggers...'); crearTriggerSyncNocturno();
  Logger.log('✅ SETUP COMPLETADO.');
}

// ============================================================
//  DASHBOARD AGENTES — Funciones backend
//  Agregar al Código.gs existente
// ============================================================

// ── CONFIG HOW-TO ────────────────────────────────────────────
// La hoja CONFIG debe tener esta estructura:
//
// Col A: Nombre evaluador    Col B: Correo evaluador
// Col C: Nombre agente       Col D: Correo agente
//
// Ejemplo:
// Luz Adriana Aristizábal | luz@smartidiomas.edu.co | Monica Diaz Cardozo | monica@smartidiomas.edu.co
// Viviana Sanchez         | viviana@smartidiomas.edu.co | LuzDary Lopez   | luzdary@smartidiomas.edu.co
//
// Cuando no tienen correo aún, dejar Col B y Col D vacías.
// El sistema funciona igualmente por nombre hasta que se agreguen correos.
// ─────────────────────────────────────────────────────────────

// Detecta el rol del usuario actual según su correo en CONFIG
// ══════════════════════════════════════════════════════════════
//  REEMPLAZAR getInfoUsuario() en el Código.gs
//  Agrega soporte para modo preview de auditores
// ══════════════════════════════════════════════════════════════

function getInfoUsuario() {
  try {
    let email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch(e) {}

    const configSheet = _sheet(CFG.sheets.config);
    if (!configSheet) return { rol:'denegado', email, nombre:'', agentes:[] };

    const rows = configSheet.getDataRange().getValues();

    // Lista completa de agentes (col C) para el selector del modo preview
    const todosLosAgentes = rows.slice(1)
      .map(r => r[2] ? r[2].toString().trim() : '')
      .filter(v => v)
      .sort();

    // Buscar en evaluadores (Col A = nombre, Col B = correo)
    for (let i = 1; i < rows.length; i++) {
      const correoEv = rows[i][1] ? rows[i][1].toString().trim().toLowerCase() : '';
      if (correoEv && correoEv === email.toLowerCase()) {
        return {
          rol    : 'auditor',
          email,
          nombre : rows[i][0] ? rows[i][0].toString().trim() : email,
          agentes: todosLosAgentes  // ← todos los agentes para el selector
        };
      }
    }

    // Buscar en agentes (Col C = nombre, Col D = correo)
    for (let i = 1; i < rows.length; i++) {
      const correoAg = rows[i][3] ? rows[i][3].toString().trim().toLowerCase() : '';
      if (correoAg && correoAg === email.toLowerCase()) {
        return {
          rol    : 'agente',
          email,
          nombre : rows[i][2] ? rows[i][2].toString().trim() : email,
          agentes: []
        };
      }
    }

    return { rol:'denegado', email, nombre:'', agentes:[] };
  } catch(e) {
    _logError('getInfoUsuario', e);
    return { rol:'denegado', email:'', nombre:'', agentes:[] };
  }
}

// Devuelve las evaluaciones del agente + promedio del equipo
function getMisEvaluaciones(nombreAgente) {
  try {
    const sheet = _sheet(CFG.sheets.evaluaciones);
    if (!sheet) return { evals:[], criterios:[], promEquipo:0 };
    const rows    = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { evals:[], criterios:[], promEquipo:0 };
 
    const headers   = rows[0].map(h => h.toString().trim().toLowerCase());
    const colFecha  = headers.indexOf('fecha eval');
    const colCaso   = headers.indexOf('n° caso');
    const colAgente = headers.indexOf('agente evaluado');
    const colEval   = headers.indexOf('evaluador');
    const colPuntaje= headers.indexOf('puntaje');
    const colResult = headers.indexOf('resultado');
    const colObs    = headers.indexOf('observaciones');
    // C1-C10
    const colsC = [];
    for (let i = 0; i < 10; i++) {
      const idx = headers.indexOf('c' + (i+1));
      colsC.push(idx >= 0 ? idx : 6+i);
    }
 
    const misEvals    = [];
    let   sumaEquipo  = 0;
    let   countEquipo = 0;
    const critSi      = new Array(10).fill(0);
    const critTot     = new Array(10).fill(0);
 
    for (let i = 1; i < rows.length; i++) {
      const r      = rows[i];
      const agente = r[colAgente >= 0 ? colAgente : 3] ? r[colAgente >= 0 ? colAgente : 3].toString().trim() : '';
      const pct    = parseFloat(r[colPuntaje >= 0 ? colPuntaje : 15]) || 0;
      if (pct > 0) { sumaEquipo += pct; countEquipo++; }
 
      if (agente.toLowerCase() === nombreAgente.toLowerCase()) {
        // Extraer detalle de criterios para esta evaluación
        const criteriosDetalle = colsC.map(col => {
          const val = r[col] ? r[col].toString().trim().toLowerCase() : '';
          return (val === 'sí' || val === 'si');
        });
 
        misEvals.push({
          fechaEval    : _toDateStr(r[colFecha >= 0 ? colFecha : 1]),
          caso         : r[colCaso >= 0 ? colCaso : 2] ? r[colCaso >= 0 ? colCaso : 2].toString() : '',
          evaluador    : r[colEval >= 0 ? colEval : 4] ? r[colEval >= 0 ? colEval : 4].toString() : '',
          pct,
          resultado    : r[colResult >= 0 ? colResult : 16] ? r[colResult >= 0 ? colResult : 16].toString() : '',
          observaciones: r[colObs >= 0 ? colObs : 17] ? r[colObs >= 0 ? colObs : 17].toString() : '',
          criterios    : criteriosDetalle  // ← NUEVO: true/false por cada criterio
        });
 
        colsC.forEach((col, idx) => {
          const val = r[col] ? r[col].toString().trim().toLowerCase() : '';
          critTot[idx]++;
          if (val === 'sí' || val === 'si') critSi[idx]++;
        });
      }
    }
 
    misEvals.sort((a,b) => b.fechaEval.localeCompare(a.fechaEval));
 
    const criterios = critTot.map((tot, idx) => ({
      label : CRITERIOS[idx] ? CRITERIOS[idx].label : 'Criterio '+(idx+1),
      pct   : tot > 0 ? Math.round((critSi[idx]/tot)*100) : 0
    }));
 
    const promEquipo = countEquipo > 0 ? Math.round(sumaEquipo/countEquipo) : 0;
    return { evals: misEvals, criterios, promEquipo };
  } catch(e) {
    _logError('getMisEvaluaciones', e);
    return { evals:[], criterios:[], promEquipo:0 };
  }
}



function getUrlDashboard() {
  const url = ScriptApp.getService().getUrl();
  Logger.log('URL auditores:  ' + url);
  Logger.log('URL agentes:    ' + url + '?page=dashboard');
}

// ── ACTUALIZAR CONFIG: agregar columnas B y D para correos ───
// Ejecutar UNA SOLA VEZ para agregar las cabeceras de correo en CONFIG
function actualizarCabecerasConfig() {
  const sheet = _sheet(CFG.sheets.config);
  if (!sheet) { Logger.log('❌ Hoja CONFIG no encontrada'); return; }

  const headers = sheet.getRange(1, 1, 1, 4).getValues()[0];

  // Agregar cabeceras si no existen
  if (!headers[1] || headers[1].toString().trim() === '') {
    sheet.getRange(1, 2).setValue('Correo evaluador');
    sheet.getRange(1, 2).setBackground('#374151').setFontColor('#fff').setFontWeight('bold');
  }
  if (!headers[3] || headers[3].toString().trim() === '') {
    sheet.getRange(1, 4).setValue('Correo agente');
    sheet.getRange(1, 4).setBackground('#374151').setFontColor('#fff').setFontWeight('bold');
  }

  // Ajustar ancho columnas
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(4, 220);

  Logger.log('✅ CONFIG actualizado. Estructura:');
  Logger.log('   Col A: Nombre evaluador');
  Logger.log('   Col B: Correo evaluador  ← agregar correos aquí');
  Logger.log('   Col C: Nombre agente');
  Logger.log('   Col D: Correo agente     ← agregar correos aquí');
  Logger.log('');
  Logger.log('Cuando tengas los correos, agrégarlos en las columnas B y D.');
  Logger.log('El dashboard de agentes detecta el rol automáticamente por correo.');
}

function syncRecuperarPerdidos() {
  try {
    const zona = CFG.meta.zonaHoraria;
    // Días específicos que faltan
    const dias = [
      ['2026-07-03', '2026-07-04'],
      ['2026-07-04', '2026-07-05'],
    ];
    let totalI = 0, totalO = 0, totalC = 0;
    dias.forEach(function(d) {
      const r = _ejecutarSync(d[0], d[1], 'día ' + d[0]);
      totalI += r.insertados || 0;
      totalO += r.omitidos  || 0;
      totalC += r.total     || 0;
      Logger.log('Día ' + d[0] + ': insertados=' + (r.insertados||0) + ' total_sf=' + (r.total||0));
    });
    Logger.log('✅ TOTAL — Insertados: ' + totalI + ' | Omitidos: ' + totalO + ' | Total SF: ' + totalC);
  } catch(e) {
    Logger.log('❌ ' + e.message);
    _logError('syncRecuperarPerdidos', e);
  }
}

function crearTriggerCasos() {
  // Eliminar cualquier trigger de sync de casos que exista
  ScriptApp.getProjectTriggers()
    .filter(t => ['syncCasosDesdeSD','syncManualHoy'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Crear trigger con syncManualHoy — la que SÍ funciona
  ScriptApp.newTrigger('syncManualHoy')
    .timeBased().atHour(23).everyDays(1)
    .inTimezone(CFG.meta.zonaHoraria).create();

  Logger.log('✅ Trigger creado: 11:00pm → syncManualHoy');
}

function getUrlDashboard() {
  const url = ScriptApp.getService().getUrl();
  Logger.log('URL auditores:  ' + url);
  Logger.log('URL agentes:    ' + url + '?page=dashboard');
}

// ══════════════════════════════════════════════════════════════
//  ACTUALIZAR CONFIG CON CORREOS COMPLETOS — ejecutar UNA VEZ
//  Fuente: reporte Salesforce Usuarios de SAC - 14/07/2026
// ══════════════════════════════════════════════════════════════

function actualizarCorreosConfig() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = ss.getSheetByName('CONFIG');
  if (!sheet) { Logger.log('❌ Hoja CONFIG no encontrada'); return; }

  // ── EVALUADORES (Col A = Nombre, Col B = Correo) ──────────
  // Estos 4 son los definidos por Luz Adriana como evaluadores
  const evaluadores = [
    ['Viviana Sanchez Hernandez',      'sac1@smartidiomas.edu.co'],
    ['Leidy Tatiana Rodriguez Bolivar','sac5@smartidiomas.edu.co'],
    ['Hilda Maria Sanchez Parada',     'supervisorsac1@smartidiomas.edu.co'],
    ['Luz Adriana Aristizabal Duarte', 'direccionsac@smartidiomas.edu.co'],
  ];

  // ── AGENTES EVALUADOS (Col C = Nombre, Col D = Correo) ────
  // Fuente: Perfil "Servicio al cliente" + Función "SAC" del reporte SF
  // ⚠️  Los marcados con PENDIENTE requieren confirmación de Luz Adriana
  const agentes = [
    // ── Confirmados — correos directos sac##@ ────────────────
    ['Monica Diaz Cardozo',           'sac13@smartidiomas.edu.co'],
    ['LuzDary Lopez Aponte',          'sac10@smartidiomas.edu.co'],
    ['Juliana Rodriguez Mendez',      'sac6@smartidiomas.edu.co'],
    ['Leidy Sierra Moreno',           'sac23@smartidiomas.edu.co'],
    ['Ilary Luna Culma',              'sac8@smartidiomas.edu.co'],
    ['Laura Sofia Campos Oyola',      'sac9@smartidiomas.edu.co'],
    ['Paula Buitrago Prieto',         'sac17@smartidiomas.edu.co'],
    ['LAURA PERDOMO ORTIZ',           'sac33@smartidiomas.edu.co'],
    ['Yuly Correa Macias',            'sac11@smartidiomas.edu.co'],
    ['Daniel Hidalgo Acuña',          'sac15@smartidiomas.edu.co'],
    ['Maikol Muñoz Arcos',            'sac16@smartidiomas.edu.co'],
    ['JUAN DIAZ OLAYA',               'sac28@smartidiomas.edu.co'],
    ['Ivonne Miranda Lombana',        'sac21@smartidiomas.edu.co'],
    ['Brillit Arevalo Jacobo',        'sac25@smartidiomas.edu.co'],
    ['Susana Castaño Molina',         'sac24@smartidiomas.edu.co'],
    ['Mariana Mejia Taborda',         'sac20@smartidiomas.edu.co'],
    ['ANGELICA PEREZ PONCE',          'sac18@smartidiomas.edu.co'],
    ['Jeisson Horta Castellanos',     'sac4@smartidiomas.edu.co'],
    // ── Agentes con correo no-sac (confirmar con Luz) ────────
    ['Anggie Delgado Guiza',          ''],  // no aparece en el reporte SF
    ['Jeffer Sanchez Bohorquez',      'auditorinterno@smartidiomas.edu.co'],  // PENDIENTE confirmación
    ['Deinis Cardenas Acevedo',       'mentor5@smartidiomas.edu.co'],
    ['Angie Valderrama - BXA',        'renovaciones1@smartidiomas.edu.co'],
    ['Jenifer Alarcón',               'analistacalidad@smartidiomas.edu.co'],
    ['Claribel Arenas Avirama',       'mentor3@smartidiomas.edu.co'],
    ['Directores Apoyo Sac',          'direccionacademica@smartidiomas.edu.co'],  // PENDIENTE
    ['Sebastián Benítez Martínez',    'judicantecorp@smartidiomas.edu.co'],
    ['Mabel Guzman Moreno',           'analistafacturasymatriculas3@smartidiomas.edu.co'],  // PENDIENTE
    ['Luisa Alvarez Gonzalez',        'mentor2@smartidiomas.edu.co'],
    ['Luisa Basto Gonzalez',          'mentor4@smartidiomas.edu.co'],
    ['Karen Rodriguez Carreño',       'mentor8@smartidiomas.edu.co'],
    ['FIDELIZACIÓN SMART',            'fidelizacion@smartidiomas.edu.co'],  // PENDIENTE
    ['Royer Sarcos Iguarán',          'renovaciones3@smartidiomas.edu.co'],
    ['Julian González Cardona - BXA', 'renovaciones2@smartidiomas.edu.co'],
    ['Emily Orozco Quiroga',          'mentor7@smartidiomas.edu.co'],
    ['Ana Mahecha Gomez',             'mentor6@smartidiomas.edu.co'],
    ['Maryori Alarcon Parra',         'mentor1@smartidiomas.edu.co'],
    ['Laura Benavides Gonzalez',      'communitymanager@smartidiomas.edu.co'],
  ];

  // ── REESCRIBIR CONFIG COMPLETO ────────────────────────────
  sheet.clearContents();

  // Encabezado
  sheet.getRange(1,1,1,4).setValues([['Evaluadores','Correo Evaluado','Agentes evaluados','Correo Agente']]);
  sheet.getRange(1,1,1,4).setBackground('#374151').setFontColor('#fff').setFontWeight('bold').setFontFamily('Calibri');

  // Construir filas — evaludores y agentes en paralelo
  const maxRows = Math.max(evaluadores.length, agentes.length);
  const data = [];
  for (let i = 0; i < maxRows; i++) {
    const ev = evaluadores[i] || ['',''];
    const ag = agentes[i]    || ['',''];
    data.push([ev[0], ev[1], ag[0], ag[1]]);
  }
  sheet.getRange(2, 1, data.length, 4).setValues(data);

  // Formato columnas
  sheet.setColumnWidth(1, 220); sheet.setColumnWidth(2, 240);
  sheet.setColumnWidth(3, 220); sheet.setColumnWidth(4, 240);
  sheet.setFrozenRows(1);

  // Resaltar correos vacíos en amarillo (pendientes de completar)
  for (let i = 0; i < data.length; i++) {
    if (!data[i][1]) sheet.getRange(i+2, 2).setBackground('#FEF9C3'); // eval sin correo
    if (!data[i][3]) sheet.getRange(i+2, 4).setBackground('#FEF9C3'); // agente sin correo
  }

  // Resaltar en naranja los PENDIENTES de confirmación con Luz
  const pendientes = [
    'auditorinterno@smartidiomas.edu.co',
    'direccionacademica@smartidiomas.edu.co',
    'analistafacturasymatriculas3@smartidiomas.edu.co',
    'fidelizacion@smartidiomas.edu.co',
  ];
  for (let i = 0; i < data.length; i++) {
    if (pendientes.includes(data[i][3])) {
      sheet.getRange(i+2, 3, 1, 2).setBackground('#FED7AA'); // naranja suave
    }
  }

  // Resumen en log
  const conCorreo    = agentes.filter(a => a[1] && !pendientes.includes(a[1])).length;
  const sinCorreo    = agentes.filter(a => !a[1]).length;
  const pendientesN  = agentes.filter(a => pendientes.includes(a[1])).length;

  Logger.log('✅ CONFIG actualizado:');
  Logger.log('   Evaluadores: ' + evaluadores.length + ' (todos con correo)');
  Logger.log('   Agentes total: ' + agentes.length);
  Logger.log('   ✓ Con correo confirmado: ' + conCorreo);
  Logger.log('   🟠 Pendientes de confirmar con Luz: ' + pendientesN);
  Logger.log('   🟡 Sin correo aún (Anggie Delgado): ' + sinCorreo);
  Logger.log('');
  Logger.log('Celdas AMARILLAS  = correo vacío (pendiente de conseguir)');
  Logger.log('Celdas NARANJAS   = confirmar con Luz Adriana si es agente evaluado');
}

// ══════════════════════════════════════════════════════════════
//  SINCRONIZACIÓN AUTOMÁTICA DE USUARIOS DESDE SALESFORCE
//  Consulta directamente los usuarios activos de SF con perfil
//  "Servicio al cliente" y los sincroniza en CONFIG
// ══════════════════════════════════════════════════════════════

// Correos de evaluadores — nunca se agregan como agentes
const EVALUADORES_FIJOS = [
  { nombre:'Viviana Sanchez Hernandez',       correo:'sac1@smartidiomas.edu.co'  },
  { nombre:'Leidy Tatiana Rodriguez Bolivar', correo:'sac5@smartidiomas.edu.co' },
  { nombre:'Hilda Maria Sanchez Parada',      correo:'supervisorsac1@smartidiomas.edu.co' },
  { nombre:'Luz Adriana Aristizabal Duarte',  correo:'direccionsac@smartidiomas.edu.co' },
];

// Palabras que identifican usuarios NO humanos (sedes, roles genéricos)
const EXCLUIR_PATRONES = [];

function esUsuarioValido(nombre) {
  if (!nombre || nombre.trim().length < 3) return false;
  return !EXCLUIR_PATRONES.some(function(p) { return p.test(nombre.trim()); });
}

// ── SINCRONIZAR AGENTES DESDE SALESFORCE ─────────────────────
// Consulta los usuarios activos en SF con perfil Servicio al cliente
// y los cruza con la lista en CONFIG para agregar nuevos y marcar inactivos
function sincronizarUsuariosDesdeSF() {
  try {
    const token = _getSfToken();

    // Traer usuarios activos de SF con los perfiles requeridos
    const soql = `SELECT Id, Name, Email, Profile.Name, IsActive
                  FROM User
                  WHERE IsActive = true
                  AND Profile.Name IN ('ADC SAC CYP', 'ADC SAC EXAM', 'ADC SAC INSTITUTO', 'ADC SAC SO', 'Comercial SAC', 'Tesorería', 'Contabilidad', 'Cartera', 'Adm sac', 'Admin SAC', 'Servicio al cliente', 'Académico', 'Auditor Interno')
                  AND Email != null
                  ORDER BY Name ASC
                  LIMIT 500`;

    const resp = UrlFetchApp.fetch(
      token.instance_url + '/services/data/' + CFG.sf.apiVersion
      + '/query?q=' + encodeURIComponent(soql),
      { headers: { Authorization: 'Bearer ' + token.access_token }, muteHttpExceptions: true }
    );

    if (resp.getResponseCode() !== 200) {
      Logger.log('❌ Error consultando usuarios SF: ' + resp.getContentText().substring(0, 300));
      return;
    }

    const data     = JSON.parse(resp.getContentText());
    const usuarios = (data.records || []);
    Logger.log('Usuarios activos encontrados en SF: ' + usuarios.length);

    // Filtrar: excluir evaluadores y usuarios no válidos
    const correosEvaluadores = new Set(EVALUADORES_FIJOS.map(function(e){ return e.correo.toLowerCase(); }));
    const agentesNuevos = usuarios.filter(function(u) {
      if (!u.Email) return false;
      if (correosEvaluadores.has(u.Email.toLowerCase())) return false;
      if (!esUsuarioValido(u.Name)) return false;
      return true;
    });

    Logger.log('Agentes válidos después de filtros: ' + agentesNuevos.length);

    // Leer CONFIG actual
    const sheet      = _sheet(CFG.sheets.config);
    const rowsConfig = sheet.getDataRange().getValues();

    // Mapa de correos ya en CONFIG (col D)
    const correosEnConfig = {};
    for (let i = 1; i < rowsConfig.length; i++) {
      const nombre = rowsConfig[i][2] ? rowsConfig[i][2].toString().trim() : '';
      const correo = rowsConfig[i][3] ? rowsConfig[i][3].toString().trim().toLowerCase() : '';
      if (correo) correosEnConfig[correo] = { fila: i+1, nombre };
    }

    // Mapa de nombres ya en CONFIG (col C) — para agentes sin correo aún
    const nombresEnConfig = new Set(
      rowsConfig.slice(1).map(function(r){ return r[2] ? r[2].toString().trim().toLowerCase() : ''; }).filter(Boolean)
    );

    let agregados = 0, yaExistian = 0, actualizados = 0;

    agentesNuevos.forEach(function(u) {
      const correoLow = u.Email.toLowerCase();
      const nombreSF  = u.Name.trim();

      if (correosEnConfig[correoLow]) {
        // Ya existe por correo — verificar que el nombre coincida
        yaExistian++;
        const filaExist = correosEnConfig[correoLow].fila;
        const nombreActual = rowsConfig[filaExist-1][2] ? rowsConfig[filaExist-1][2].toString().trim() : '';
        if (nombreActual.toLowerCase() !== nombreSF.toLowerCase()) {
          // Actualizar nombre si cambió en SF
          sheet.getRange(filaExist, 3).setValue(nombreSF);
          actualizados++;
          Logger.log('  ↻ Nombre actualizado: "'+nombreActual+'" → "'+nombreSF+'"');
        }
      } else if (nombresEnConfig.has(nombreSF.toLowerCase())) {
        // Ya existe por nombre pero sin correo — agregar el correo
        for (let i = 1; i < rowsConfig.length; i++) {
          const nConf = rowsConfig[i][2] ? rowsConfig[i][2].toString().trim().toLowerCase() : '';
          if (nConf === nombreSF.toLowerCase() && !rowsConfig[i][3]) {
            sheet.getRange(i+1, 4).setValue(u.Email);
            actualizados++;
            Logger.log('  + Correo agregado a "'+nombreSF+'": '+u.Email);
            break;
          }
        }
        yaExistian++;
      } else {
        // Nuevo — agregar al final
        const lastRow = sheet.getLastRow() + 1;
        sheet.getRange(lastRow, 3).setValue(nombreSF);
        sheet.getRange(lastRow, 4).setValue(u.Email);
        agregados++;
        Logger.log('  ✅ Nuevo agente agregado: '+nombreSF+' ('+u.Email+')');
      }
    });

    // Limpiar entradas sin correo Y sin evaluaciones en CASOS_SF
    const limpiadosCount = limpiarAgentesSinCorreoNiCasos(sheet);

    Logger.log('');
    Logger.log('✅ Sincronización completada:');
    Logger.log('   Ya existían: ' + yaExistian);
    Logger.log('   Nuevos agregados: ' + agregados);
    Logger.log('   Nombres/correos actualizados: ' + actualizados);
    Logger.log('   Entradas inválidas limpiadas: ' + limpiadosCount);

  } catch(e) {
    Logger.log('❌ Error sincronizarUsuariosDesdeSF: ' + e.message);
    _logError('sincronizarUsuariosDesdeSF', e);
  }
}

// ── LIMPIAR ENTRADAS INVÁLIDAS EN CONFIG ─────────────────────
// Elimina filas de agentes que:
// 1. No tienen correo
// 2. No tienen evaluaciones en CASOS_SF (son usuarios genéricos/sedes)
function limpiarAgentesSinCorreoNiCasos(sheet) {
  try {
    // Cargar propietarios reales de CASOS_SF
    const casosSF = _sheet(CFG.sheets.casos);
    const propietariosReales = new Set(
      casosSF ? casosSF.getDataRange().getValues().slice(1)
        .map(function(r){ return r[1] ? r[1].toString().trim().toLowerCase() : ''; })
        .filter(Boolean) : []
    );

    const rows   = sheet.getDataRange().getValues();
    let limpiados = 0;

    // Recorrer de abajo hacia arriba para no afectar índices al borrar
    for (let i = rows.length - 1; i >= 1; i--) {
      const nombre = rows[i][2] ? rows[i][2].toString().trim() : '';
      const correo = rows[i][3] ? rows[i][3].toString().trim() : '';

      // Si no tiene correo Y no aparece en CASOS_SF → es un usuario genérico
      if (!correo && nombre && !propietariosReales.has(nombre.toLowerCase())) {
        // También verificar si es un patrón de exclusión obvio
        if (!esUsuarioValido(nombre) || !propietariosReales.has(nombre.toLowerCase())) {
          sheet.getRange(i+1, 3, 1, 2).clearContent();
          limpiados++;
          Logger.log('  🗑 Entrada limpiada: "'+nombre+'" (sin correo y sin casos)');
        }
      }
    }
    return limpiados;
  } catch(e) {
    Logger.log('Error limpiarAgentesSinCorreoNiCasos: ' + e.message);
    return 0;
  }
}

// ── VISTA PREVIA — ver qué usuarios traería SF antes de aplicar ──
// ── VISTA PREVIA — ver qué usuarios traería SF antes de aplicar ──
function previsualizarUsuariosSF() {
  try {
    const token = _getSfToken();
    const soql  = `SELECT Id, Name, Email, Profile.Name, IsActive
                   FROM User WHERE IsActive = true
                   AND Profile.Name IN ('ADC SAC CYP', 'ADC SAC EXAM', 'ADC SAC INSTITUTO', 'ADC SAC SO', 'Comercial SAC', 'Tesorería', 'Contabilidad', 'Cartera', 'Adm sac', 'Admin SAC', 'Servicio al cliente', 'Académico', 'Auditor Interno')
                   AND Email != null ORDER BY Name ASC LIMIT 500`;

    const resp = UrlFetchApp.fetch(
      token.instance_url + '/services/data/' + CFG.sf.apiVersion
      + '/query?q=' + encodeURIComponent(soql),
      { headers: { Authorization: 'Bearer ' + token.access_token  }, muteHttpExceptions: true }
    );

    const data     = JSON.parse(resp.getContentText());
    const usuarios = data.records || [];
    const correosEv= new Set(EVALUADORES_FIJOS.map(function(e){ return e.correo.toLowerCase(); }));

    const validos   = usuarios.filter(function(u){ return u.Email && !correosEv.has(u.Email.toLowerCase()) && esUsuarioValido(u.Name); });
    const excluidos = usuarios.filter(function(u){ return !esUsuarioValido(u.Name); });

    Logger.log('══ PREVISUALIZACIÓN USUARIOS SF ══');
    Logger.log('Total usuarios activos encontrados: ' + usuarios.length);
    Logger.log('Válidos para CONFIG: ' + validos.length);
    Logger.log('');
    Logger.log('INCLUIR en CONFIG:');
    validos.forEach(function(u){ Logger.log('  ✓ ' + u.Name + ' | ' + u.Email); });
    Logger.log('');
    Logger.log('EXCLUIR (patrones genéricos):');
    excluidos.forEach(function(u){ Logger.log('  ✗ ' + u.Name + ' | ' + (u.Email||'sin correo')); });

  } catch(e) {
    Logger.log('❌ Error: ' + e.message);
  }
}

// ── TRIGGER: ejecutar sincronización una vez por semana ───────
// Los lunes a las 6am sincroniza usuarios desde SF automáticamente
function crearTriggerSyncUsuarios() {
  // Eliminar triggers anteriores de este tipo
  ScriptApp.getProjectTriggers()
    .filter(function(t){ return t.getHandlerFunction() === 'sincronizarUsuariosDesdeSF'; })
    .forEach(function(t){ ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('sincronizarUsuariosDesdeSF')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(6)
    .inTimezone(CFG.meta.zonaHoraria)
    .create();

  Logger.log('✅ Trigger creado: sincronizarUsuariosDesdeSF cada lunes a las 6am');
  Logger.log('   Esto mantiene CONFIG actualizado automáticamente con usuarios de SF');
}