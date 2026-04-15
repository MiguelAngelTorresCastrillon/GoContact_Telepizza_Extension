// ============================================================
//  Copyright © 2025 Miguel Ángel Torres Castrillon
//  Todos los derechos reservados.
// ============================================================

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// ── CORS: necesario para peticiones desde extensiones Chrome ──
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, status: "online" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    // Acepta tanto JSON directo como payload dentro de form-urlencoded
    let body;
    if (e.postData.type === "application/x-www-form-urlencoded") {
      body = JSON.parse(e.parameter.payload);
    } else {
      body = JSON.parse(e.postData.contents);
    }

    const action = body.action;
    if (action === "login")     return handleLogin(body);
    if (action === "getConfig") return handleGetConfig(body);
    if (action === "setConfig") return handleSetConfig(body);

    return response({ ok: false, error: "Acción no reconocida" });
  } catch (err) {
    return response({ ok: false, error: "Error interno: " + err.message });
  }
}

// ── Login: compara hash SHA-256 ──────────────────────────────
function handleLogin(body) {
  const sheet        = getSheet("credenciales");
  const usuario      = sheet.getRange("B1").getValue().toString().trim();
  const hashGuardado = sheet.getRange("B2").getValue().toString().trim();
  const hashRecibido = (body.hashContrasena || "").toString().trim();

  if (body.usuario.trim() === usuario && hashRecibido === hashGuardado) {
    const token  = Utilities.getUuid();
    const expiry = (Date.now() + 3600000).toString();
    PropertiesService.getScriptProperties().setProperty("session_token",  token);
    PropertiesService.getScriptProperties().setProperty("session_expiry", expiry);
    return response({ ok: true, token });
  }

  return response({ ok: false, error: "Credenciales incorrectas" });
}

// ── Obtener configuración ────────────────────────────────────
function handleGetConfig(body) {
  if (!validarToken(body.token))
    return response({ ok: false, error: "Sesión inválida o expirada" });

  const sheet  = getSheet("config");
  const data   = sheet.getDataRange().getValues();
  const config = {};
  for (const row of data) {
    if (row[0]) config[row[0]] = row[1] === true || row[1] === "true";
  }
  return response({ ok: true, config });
}

// ── Guardar configuración ────────────────────────────────────
function handleSetConfig(body) {
  if (!validarToken(body.token))
    return response({ ok: false, error: "Sesión inválida o expirada" });

  const sheet = getSheet("config");
  const data  = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    const key = data[i][0];
    if (body.config.hasOwnProperty(key)) {
      sheet.getRange(i + 1, 2).setValue(String(body.config[key]));
    }
  }
  return response({ ok: true });
}

// ── Validar token con expiración ─────────────────────────────
function validarToken(token) {
  const props  = PropertiesService.getScriptProperties();
  const saved  = props.getProperty("session_token");
  const expiry = parseInt(props.getProperty("session_expiry") || "0");
  if (!token || token !== saved) return false;
  if (Date.now() > expiry) {
    props.deleteProperty("session_token");
    props.deleteProperty("session_expiry");
    return false;
  }
  return true;
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
