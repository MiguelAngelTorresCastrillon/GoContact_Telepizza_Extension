// ============================================================
//  Copyright © 2025 Miguel Ángel Torres Castrillon
//  Todos los derechos reservados.
//  Queda estrictamente prohibida su copia, distribución,
//  modificación o uso sin autorización expresa y por escrito.
// ============================================================

async function getConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get("ext_config", data => {
      resolve(data.ext_config || {});
    });
  });
}

// ── Rellena el campo de número de pedido desde Telepizza ──
let lastOrderFilled = "";
setInterval(async () => {
  const config = await getConfig();
  if (config.gocontact_pedido === false) return;

  const data    = await chrome.storage.local.get(["crm_order_no", "crm_order_no_ts"]);
  const orderNo = data.crm_order_no || "";
  const ts      = data.crm_order_no_ts || 0;
  if (!orderNo || orderNo === lastOrderFilled) return;
  if (Date.now() - ts > 30000) return;
  const input = document.querySelector('input[name="8"]');
  if (!input) return;
  lastOrderFilled = orderNo;
  input.focus();
  input.value = "";
  for (let i = 0; i < orderNo.length; i++) {
    input.value += orderNo[i];
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
  console.log("[Telepizza→GoContact] Número de pedido rellenado:", orderNo);
}, 800);

// ── Vigila el campo de teléfono ──
let lastPhone = "";
setInterval(async () => {
  const config = await getConfig();
  if (config.gocontact_telefono === false) return;

  const field = document.querySelector('input#voice-field-first_phone');
  if (!field) return;
  const phone = field.value.trim();
  if (phone.length >= 6 && phone !== lastPhone) {
    lastPhone = phone;
    chrome.storage.local.set({ crm_phone: phone, crm_phone_ts: Date.now() });
    console.log("[GoContact→CRM] Teléfono detectado:", phone);
  }
}, 1500);

// ── Detecta tienda y dirección ──
let lastStore   = "";
let lastAddress = "";
setInterval(async () => {
  const config = await getConfig();
  if (config.gocontact_tienda === false) return;

  const fonts = document.querySelectorAll('font[color="#0000ff"]');
  if (!fonts.length) return;
  let storeCode    = "";
  let storeAddress = "";
  for (const font of fonts) {
    const clone = font.cloneNode(true);
    clone.querySelectorAll("span").forEach(s => s.remove());
    const text            = clone.textContent.replace(/\u00a0/g, "").trim();
    const dentroDeNegrita = !!font.closest("b");
    if (/^\d+$/.test(text) && dentroDeNegrita && text.length <= 4) {
      storeCode = text;
    } else if (
      text.length > 3 &&
      /\(.*\)/.test(text) &&
      /[A-ZÁÉÍÓÚÑ]{3,}/.test(text) &&
      !/teléfono|transferencia|información|copia|pega|llamada|espera|cliente/i.test(text)
    ) {
      storeAddress = text.trim();
    }
  }
  if (storeCode && storeCode !== lastStore) {
    lastStore = storeCode;
    chrome.storage.local.set({ crm_store: storeCode, crm_store_ts: Date.now() });
    console.log("[GoContact→CRM] Tienda detectada:", storeCode);
  }
  if (storeAddress && storeAddress !== lastAddress) {
    lastAddress = storeAddress;
    chrome.storage.local.set({ crm_store_address: storeAddress, crm_store_address_ts: Date.now() });
    console.log("[GoContact→CRM] Dirección detectada:", storeAddress);
  }
}, 1500);
