// ============================================================
//  Copyright © 2025 Miguel Ángel Torres Castrillon
//  Todos los derechos reservados.
//  Queda estrictamente prohibida su copia, distribución,
//  modificación o uso sin autorización expresa y por escrito.
// ============================================================

async function getConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get("ext_config", data => resolve(data.ext_config || {}));
  });
}

// ── Captura el número de pedido y lo guarda ──
let lastOrderNo = "";
setInterval(async () => {
  const config = await getConfig();
  if (config.telepizza_web === false) return;

  const orderEl = document.querySelector('p[data-order-no]');
  if (!orderEl) return;
  const orderNo = orderEl.textContent.trim();
  if (!orderNo || orderNo === lastOrderNo) return;
  lastOrderNo = orderNo;
  chrome.storage.local.set({ crm_order_no: orderNo, crm_order_no_ts: Date.now() });
  console.log("[Telepizza.es→GoContact] Pedido detectado:", orderNo);
}, 500);
