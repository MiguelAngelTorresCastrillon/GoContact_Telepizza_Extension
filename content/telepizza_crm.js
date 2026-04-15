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

// ── Busca el número de teléfono automáticamente ──
let lastSearched = "";
setInterval(async () => {
  const config = await getConfig();
  if (config.telepizza_crm === false) return;

  const data  = await chrome.storage.local.get(["crm_phone", "crm_phone_ts"]);
  const phone = data.crm_phone || "";
  const ts    = data.crm_phone_ts || 0;
  if (!phone || phone === lastSearched) return;
  if (Date.now() - ts > 30000) return;
  const input = document.querySelector(
    'input[placeholder="Customer Name, Number or Email"]'
  );
  if (!input) return;
  lastSearched = phone;
  input.focus();
  input.value = phone;
  input.dispatchEvent(new Event("input",  { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  setTimeout(() => {
    input.dispatchEvent(new KeyboardEvent("keydown",
      { key: "Enter", keyCode: 13, bubbles: true }));
  }, 300);
  setTimeout(() => {
    input.value = "";
    input.dispatchEvent(new Event("input",  { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    console.log("[GoContact→CRM] Campo limpiado ✅");
  }, 10000);
  console.log("[GoContact→CRM] Buscando en CRM:", phone);
}, 2000);

// ── Auto-rellenar formulario Create Customer ──
let ultimoValorBuscador = "";
document.addEventListener("input", function (e) {
  if (
    e.target.tagName === "INPUT" &&
    e.target.placeholder &&
    e.target.placeholder.includes("Customer Name, Number or Email")
  ) {
    ultimoValorBuscador = e.target.value.trim();
  }
});

document.addEventListener("click", function (e) {
  const btn = e.target.closest(".csc-newCustomer");
  if (!btn) return;
  const interval = setInterval(() => {
    const emailInput     = document.querySelector('input[name="email"]');
    const loginInput     = document.querySelector('input[name="login"]');
    const firstNameInput = document.querySelector('input[name="first_name"]');
    const lastNameInput  = document.querySelector('input[name="last_name"]');
    const phoneInput     = document.querySelector('input[name="phone_home"]');

    function escribir(el, valor) {
      if (!el || !valor) return;
      el.focus();
      el.value = "";
      for (let i = 0; i < valor.length; i++) {
        el.value += valor[i];
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
    }

    if (ultimoValorBuscador) {
      const numero = ultimoValorBuscador.replace(/\D/g, "");
      const email  = numero + "@telepizza.es";
      if (emailInput     && emailInput.value === "")     escribir(emailInput,     email);
      if (loginInput     && loginInput.value === "")     escribir(loginInput,     email);
      if (firstNameInput && firstNameInput.value === "") escribir(firstNameInput, numero);
      if (lastNameInput  && lastNameInput.value === "")  escribir(lastNameInput,  numero);
      if (phoneInput     && phoneInput.value === "")     escribir(phoneInput,     numero);
    }
    if (emailInput && loginInput && firstNameInput && lastNameInput && phoneInput)
      clearInterval(interval);
  }, 300);
});
