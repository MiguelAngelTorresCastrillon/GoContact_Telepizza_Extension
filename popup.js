// ============================================================
//  Copyright © 2025 Miguel Ángel Torres Castrillon
//  Todos los derechos reservados.
// ============================================================

const KEYS = ["crm_phone", "crm_store", "crm_store_address", "crm_order_no",
              "crm_phone_ts", "crm_store_ts", "crm_store_address_ts", "crm_order_no_ts"];

function timeAgo(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5)  return "ahora";
  if (diff < 60) return `hace ${diff}s`;
  return `hace ${Math.floor(diff / 60)}m`;
}

function isExpired(ts) {
  return !ts || (Date.now() - ts) > 30000;
}

function render(data) {
  const fields = [
    { id: "valPhone",   key: "crm_phone",         ts: "crm_phone_ts" },
    { id: "valStore",   key: "crm_store",          ts: "crm_store_ts" },
    { id: "valAddress", key: "crm_store_address",  ts: "crm_store_address_ts" },
    { id: "valOrder",   key: "crm_order_no",       ts: "crm_order_no_ts" }
  ];

  for (const f of fields) {
    const el  = document.getElementById(f.id);
    const val = data[f.key];
    const ts  = data[f.ts];
    if (val) {
      el.textContent = val;
      el.className = isExpired(ts)
        ? "data-value"
        : "data-value active";
    } else {
      el.textContent = "—";
      el.className = "data-value empty";
    }
  }
}

function loadData() {
  chrome.storage.local.get(KEYS, render);
}

document.getElementById("btnRefresh").addEventListener("click", loadData);

document.getElementById("btnAdmin").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("admin.html") });
});


document.getElementById("btnClear").addEventListener("click", () => {
  chrome.storage.local.remove(KEYS, () => {
    loadData();
  });
});

loadData();
