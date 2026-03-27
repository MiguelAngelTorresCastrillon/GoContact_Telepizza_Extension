// ============================================================
//  Copyright © 2025 Miguel Ángel Torres Castrillon
//  Todos los derechos reservados.
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbyqoE6diOYu7FyHDrcQeO96cA1P3_Haw_S8OnsPH8fiLsdJjOP8K0iUc5zxC8k1YnDTWQ/exec";

const TOGGLE_KEYS = [
  "gocontact_pedido",
  "gocontact_telefono",
  "gocontact_tienda",
  "looker_tienda",
  "telepizza_crm",
  "telepizza_web"
];

// ── SHA-256 en el navegador ──────────────────────────────────
async function sha256(text) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Sesión ───────────────────────────────────────────────────
let sessionToken  = null;
let sessionUser   = null;
let sessionExpiry = null;
let timerInterval = null;

function saveSession(token, user) {
  sessionToken  = token;
  sessionUser   = user;
  sessionExpiry = Date.now() + 3600000; // 1 hora
  chrome.storage.session.set({ adminToken: token, adminUser: user, adminExpiry: sessionExpiry });
}

function clearSession() {
  sessionToken  = null;
  sessionUser   = null;
  sessionExpiry = null;
  if (timerInterval) clearInterval(timerInterval);
  chrome.storage.session.remove(["adminToken", "adminUser", "adminExpiry"]);
}

async function restoreSession() {
  return new Promise(resolve => {
    chrome.storage.session.get(["adminToken", "adminUser", "adminExpiry"], data => {
      if (data.adminToken && data.adminExpiry > Date.now()) {
        sessionToken  = data.adminToken;
        sessionUser   = data.adminUser;
        sessionExpiry = data.adminExpiry;
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

// ── Timer de sesión ──────────────────────────────────────────
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const remaining = Math.max(0, sessionExpiry - Date.now());
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    document.getElementById("sessionTimer").textContent =
      `Sesión: ${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    if (remaining <= 0) {
      clearSession();
      showScreen("login");
      showError("loginError", "Sesión expirada. Inicia sesión de nuevo.");
    }
  }, 1000);
}

// ── Pantallas ────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById("screenLogin").classList.remove("active");
  document.getElementById("screenAdmin").classList.remove("active");
  if (name === "login") document.getElementById("screenLogin").classList.add("active");
  if (name === "admin") document.getElementById("screenAdmin").classList.add("active");
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "alert error show";
  setTimeout(() => el.classList.remove("show"), 4000);
}

function showSuccess(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "alert success show";
  setTimeout(() => el.classList.remove("show"), 3000);
}

function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="spinner"></span> Cargando...`
    : label;
}

// ── API calls — usa URLSearchParams para evitar preflight CORS ──
async function apiCall(body) {
  // Google Apps Script no acepta preflight OPTIONS desde extensiones.
  // Solución: enviar como application/x-www-form-urlencoded con el
  // payload JSON dentro de un campo, lo que evita el preflight.
  const params = new URLSearchParams();
  params.append("payload", JSON.stringify(body));

  const res = await fetch(API_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString()
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Respuesta inválida del servidor: " + text.slice(0, 100));
  }
}

// ── Login ────────────────────────────────────────────────────
async function doLogin() {
  const user = document.getElementById("inputUser").value.trim();
  const pass = document.getElementById("inputPass").value;

  if (!user || !pass) {
    showError("loginError", "Por favor completa todos los campos.");
    return;
  }

  setLoading("btnLogin", true);

  try {
    const hash = await sha256(pass);
    const data = await apiCall({
      action:         "login",
      usuario:        user,
      hashContrasena: hash
    });

    if (data.ok) {
      saveSession(data.token, user);
      document.getElementById("sessionUser").textContent = "●  " + user;
      startTimer();
      await loadConfig();
      showScreen("admin");
    } else {
      showError("loginError", data.error || "Credenciales incorrectas.");
    }
  } catch (err) {
    showError("loginError", "Error de conexión. Verifica tu internet.");
  }

  setLoading("btnLogin", false, "Iniciar sesión");
}

// ── Cargar config ────────────────────────────────────────────
async function loadConfig() {
  try {
    const data = await apiCall({ action: "getConfig", token: sessionToken });
    if (!data.ok) {
      if (data.error === "Sesión inválida o expirada") {
        clearSession();
        showScreen("login");
        showError("loginError", "Sesión expirada. Inicia sesión de nuevo.");
      }
      return;
    }
    // Aplica valores a los toggles
    for (const key of TOGGLE_KEYS) {
      const el = document.getElementById("tog_" + key);
      if (el) el.checked = data.config[key] !== false;
    }
    // También guarda en storage local para que los content scripts lo lean
    chrome.storage.local.set({ ext_config: data.config });
  } catch (err) {
    showError("adminError", "Error al cargar la configuración.");
  }
}

// ── Guardar config ───────────────────────────────────────────
async function saveConfig() {
  setLoading("btnSave", true);

  const config = {};
  for (const key of TOGGLE_KEYS) {
    const el = document.getElementById("tog_" + key);
    config[key] = el ? el.checked : true;
  }

  try {
    const data = await apiCall({ action: "setConfig", token: sessionToken, config });
    if (data.ok) {
      chrome.storage.local.set({ ext_config: config });
      showSuccess("adminSuccess", "✓ Configuración guardada correctamente.");
    } else {
      if (data.error === "Sesión inválida o expirada") {
        clearSession();
        showScreen("login");
        showError("loginError", "Sesión expirada. Inicia sesión de nuevo.");
      } else {
        showError("adminError", data.error || "Error al guardar.");
      }
    }
  } catch (err) {
    showError("adminError", "Error de conexión al guardar.");
  }

  setLoading("btnSave", false, "Guardar cambios");
}

// ── Logout ───────────────────────────────────────────────────
function doLogout() {
  clearSession();
  document.getElementById("inputPass").value = "";
  showScreen("login");
}

// ── Enter en login ───────────────────────────────────────────
document.getElementById("inputPass").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});
document.getElementById("inputUser").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("inputPass").focus();
});

// ── Botones ──────────────────────────────────────────────────
document.getElementById("btnLogin").addEventListener("click",  doLogin);
document.getElementById("btnSave").addEventListener("click",   saveConfig);
document.getElementById("btnLogout").addEventListener("click", doLogout);

// ── Init ─────────────────────────────────────────────────────
(async () => {
  const restored = await restoreSession();
  if (restored) {
    document.getElementById("sessionUser").textContent = "●  " + sessionUser;
    startTimer();
    await loadConfig();
    showScreen("admin");
  } else {
    showScreen("login");
  }
})();
