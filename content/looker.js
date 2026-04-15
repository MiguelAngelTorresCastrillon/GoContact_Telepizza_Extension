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

// ── Busca el código de tienda automáticamente ──
let lastSearched = "";

function abrirMenuTienda() {
  const holders = document.querySelectorAll("div.content-holder");
  for (const holder of holders) {
    if (holder.innerText && holder.innerText.includes("TIENDA")) {
      holder.click();
      console.log("[GoContact→Looker] Menú Nº TIENDA abierto ✅");
      return true;
    }
  }
  return false;
}

function esperarInput(store, intentos = 0) {
  if (intentos > 15) return;
  const input = document.querySelector('input[placeholder="Escriba el término de búsqueda"]');
  if (!input) {
    setTimeout(() => esperarInput(store, intentos + 1), 100);
    return;
  }
  input.focus();
  input.value = store;
  input.dispatchEvent(new Event("input",  { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  console.log("[GoContact→Looker] Código escrito:", store);

  function clickResultado(intentosClick = 0) {
    if (intentosClick > 15) return;
    const items = document.querySelectorAll("div.item.item-single");
    for (const item of items) {
      const spanValor = item.querySelector("span.dimension-value");
      if (!spanValor) continue;
      const texto = spanValor.textContent.trim();
      if (texto === store) {
        item.click();
        console.log("[GoContact→Looker] Tienda seleccionada:", store, "✅");
        return;
      }
    }
    setTimeout(() => clickResultado(intentosClick + 1), 100);
  }
  setTimeout(() => clickResultado(), 300);
}

setInterval(async () => {
  const config = await getConfig();
  if (config.looker_tienda === false) return;

  const data  = await chrome.storage.local.get(["crm_store", "crm_store_ts"]);
  const store = data.crm_store || "";
  const ts    = data.crm_store_ts || 0;
  if (!store || store === lastSearched) return;
  if (Date.now() - ts > 30000) return;
  lastSearched = store;
  const inputYaVisible = document.querySelector('input[placeholder="Escriba el término de búsqueda"]');
  if (inputYaVisible) {
    esperarInput(store);
  } else {
    const abierto = abrirMenuTienda();
    if (abierto) setTimeout(() => esperarInput(store), 300);
  }
  console.log("[GoContact→Looker] Buscando tienda:", store);
}, 2000);
