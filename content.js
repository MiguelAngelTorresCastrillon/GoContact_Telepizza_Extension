// TeleGo - Telepizza: flujo automático (GoContact / Salesforce / Dataloop)
// Teléfono de GoContact -> búsqueda en Salesforce (y autocompletar Create Customer);
// código de tienda -> Dataloop; nº de pedido de Telepizza -> GoContact.

(async function () {
  'use strict';

  /* ================= ALMACENAMIENTO (sustituye a GM_*) ================= */
  // chrome.storage es asíncrono: se carga todo una vez en una caché y se mantiene
  // al día con onChanged, así GM_getValue sigue siendo síncrono como en el userscript.
  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };

  let cache = {};
  try {
    cache = await chrome.storage.local.get(null);
  } catch (e) {
    return; // contexto de la extensión no disponible
  }

  const listeners = {};
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, { newValue, oldValue }] of Object.entries(changes)) {
      if (newValue === undefined) delete cache[key];
      else cache[key] = newValue;
      (listeners[key] || []).forEach((fn) => fn(key, oldValue, newValue));
    }
  });

  const GM_getValue = (key, def) => (key in cache ? cache[key] : def);
  const GM_setValue = (key, value) => {
    cache[key] = value;
    if (!alive()) return;
    chrome.storage.local.set({ [key]: value }).catch(() => {});
  };
  const GM_addValueChangeListener = (key, fn) => {
    (listeners[key] = listeners[key] || []).push(fn);
  };

  /* ================= CONFIG ================= */
  const EMAIL_DOMAIN = 'telepizza.es';
  const STRIP_LEADING_ZEROS_STORE = true; // "053" -> "53"
  const MAX_AGE_MS = 10 * 60 * 1000;      // al cargar una pestaña, aplica el dato guardado si es más reciente que esto
  const POLL_MS = 400;

  const SEL = {
    goPhone: '#voice-field-first_phone',
    goStore: 'input[name="48"]',
    goOrder: 'input[name="8"]',
    sfSearchInput: 'input[placeholder="Customer Name, Number or Email"]',
    sfLogin: 'input[name="login"]',
    sfEmail: 'input[name="email"]',
    sfFirst: 'input[name="first_name"]',
    sfLast: 'input[name="last_name"]',
    sfPhone: 'input[name="phone_home"]',
    tpOrder: 'p[data-order-no]',
    dlSearch: '#searchCodigo',
  };

  /* ================= UTILIDADES ================= */
  const H = location.hostname;
  const isTop = window.top === window.self;
  const isGo = H.includes('go-contact.com');
  const isBM = H.includes('demandware.net');
  const isOrderPage = H === 'www.telepizza.es' && location.pathname.includes('Order-Confirm');
  const isDataloopCtx = H.includes('googleusercontent.com') || H === 'sites.google.com';

  const log = (...a) => console.log('[TeleGo]', ...a);
  const enabled = () => GM_getValue('enabled', true);

  function toast(msg) {
    if (!isTop || !document.body) return;
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#222;color:#fff;padding:8px 14px;border-radius:6px;font:13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4)';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2500);
  }

  // Equivalente al aviso del menú del userscript: se muestra en la pestaña visible
  GM_addValueChangeListener('enabled', (n, o, val) => {
    if (document.visibilityState === 'visible') {
      toast('Automatización ' + (val !== false ? 'ACTIVADA' : 'DESACTIVADA'));
    }
  });

  const digits = (s) => String(s || '').replace(/\D/g, '');
  function normPhone(s) {
    let d = digits(s);
    if (d.startsWith('0034')) d = d.slice(4);
    else if (d.length > 9 && d.startsWith('34')) d = d.slice(2);
    return d;
  }
  function normStore(s) {
    let v = String(s || '').trim();
    if (STRIP_LEADING_ZEROS_STORE && /^0+\d/.test(v)) v = v.replace(/^0+/, '');
    return v;
  }

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  function setValue(el, val) {
    el.focus();
    nativeSetter.call(el, val);
    ['input', 'keyup', 'change'].forEach((t) =>
      el.dispatchEvent(new Event(t, { bubbles: true }))
    );
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function waitFor(selector, timeout = 8000) {
    return new Promise((resolve) => {
      const found = document.querySelector(selector);
      if (found) return resolve(found);
      const t0 = Date.now();
      const iv = setInterval(() => {
        const el = document.querySelector(selector);
        if (el || Date.now() - t0 > timeout) {
          clearInterval(iv);
          resolve(el || null);
        }
      }, 200);
    });
  }

  const fresh = (obj) => obj && obj.value && Date.now() - obj.ts < MAX_AGE_MS;

  /* ================= GOCONTACT ================= */
  if (isGo) {
    let lastPhone = '';
    let lastStore = '';

    const poll = setInterval(() => {
      if (!alive()) return clearInterval(poll); // extensión recargada o desinstalada
      if (!enabled()) return;

      const ph = document.querySelector(SEL.goPhone);
      if (ph) {
        const v = normPhone(ph.value);
        if (!v) lastPhone = '';
        else if (v !== lastPhone) {
          lastPhone = v;
          GM_setValue('phone', { value: v, ts: Date.now() });
          log('Teléfono detectado:', v);
        }
      }

      const st = document.querySelector(SEL.goStore);
      if (st) {
        const v = normStore(st.value);
        if (!v) lastStore = '';
        else if (v !== lastStore) {
          lastStore = v;
          GM_setValue('store', { value: v, ts: Date.now() });
          log('Código de tienda detectado:', v);
        }
      }
    }, POLL_MS);

    // Nº de pedido que llega desde Telepizza
    const fillOrder = async (obj) => {
      if (!enabled() || !obj || !obj.value) return;
      const el = await waitFor(SEL.goOrder, 5000);
      if (!el) return;
      setValue(el, String(obj.value));
      log('Nº de pedido insertado:', obj.value);
      toast('Nº pedido ' + obj.value + ' insertado');
    };
    GM_addValueChangeListener('order', (n, o, val) => fillOrder(val));
  }

  /* ================= SALESFORCE (Demandware BM) ================= */
  if (isBM) {
    const findSearchButton = (input) => {
      let node = input;
      for (let i = 0; i < 6 && node; i++) {
        node = node.parentElement;
        if (!node) break;
        const icon = node.querySelector('button.dw-button .dw-glyph-search');
        if (icon) return icon.closest('button');
      }
      return null;
    };

    async function searchPhone(obj) {
      if (!enabled() || !obj || !obj.value) return;
      const input = await waitFor(SEL.sfSearchInput, 8000);
      if (!input) return log('No encuentro la caja de búsqueda (¿estás en la pantalla Customers?)');
      setValue(input, obj.value);
      let tries = 0;
      const iv = setInterval(() => {
        const btn = findSearchButton(input);
        tries++;
        if (btn && !btn.disabled) {
          clearInterval(iv);
          btn.click();
          log('Búsqueda lanzada:', obj.value);
        } else if (tries > 15) clearInterval(iv);
      }, 200);
    }

    GM_addValueChangeListener('phone', (n, o, val) => searchPhone(val));
    const initial = GM_getValue('phone');
    if (fresh(initial)) searchPhone(initial);

    // Autocompletar el modal "Create New Customer"
    // El número se toma de la caja de búsqueda AL PULSAR "Create Customer",
    // así respeta el número que escribas a mano y no el último que entró por GoContact.
    let createPhone = null;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('button.csc-newCustomer');
      if (!btn) return;
      const box = document.querySelector(SEL.sfSearchInput);
      const raw = box ? box.value.trim() : '';
      createPhone = /^[\d\s+()\-.]{6,}$/.test(raw) ? normPhone(raw) : null;
      log('Create Customer pulsado. Número de la búsqueda:', createPhone);
    }, true);

    let filledEl = null;
    const fillForm = () => {
      if (!enabled()) return;
      const login = document.querySelector(SEL.sfLogin);
      if (!login) { filledEl = null; return; }
      if (filledEl === login) return;   // ya rellenado: no pisa lo que edites a mano
      if (!createPhone) return;         // sin número válido en la búsqueda, no rellena nada

      filledEl = login;
      const phone = createPhone;
      createPhone = null;               // cada modal necesita un nuevo clic en Create Customer
      setTimeout(() => {
        const map = [
          [SEL.sfLogin, phone + '@' + EMAIL_DOMAIN],
          [SEL.sfEmail, phone + '@' + EMAIL_DOMAIN],
          [SEL.sfFirst, phone],
          [SEL.sfLast, phone],
          [SEL.sfPhone, phone],
        ];
        map.forEach(([sel, val]) => {
          const el = document.querySelector(sel);
          if (el) setValue(el, val);
        });
        log('Formulario Create Customer autocompletado con', phone);
      }, 150);
    };
    new MutationObserver(fillForm).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ================= TELEPIZZA (Order-Confirm) ================= */
  if (isOrderPage) {
    (async () => {
      const p = await waitFor(SEL.tpOrder, 15000);
      if (!p) return log('No encuentro el número de pedido');
      const num = p.textContent.trim();
      if (!num) return;
      GM_setValue('order', { value: num, ts: Date.now() });
      log('Nº de pedido enviado a GoContact:', num);
      toast('Pedido ' + num + ' enviado a GoContact');
    })();
  }

  /* ================= DATALOOP ================= */
  if (isDataloopCtx) {
    const searchStore = async (obj) => {
      if (!enabled() || !obj || !obj.value) return;
      const input = document.querySelector(SEL.dlSearch);
      if (!input) return;
      setValue(input, obj.value); // dispara oninput="filtrarPorCodigo()"
      log('Tienda buscada en Dataloop:', obj.value);
    };

    // Google Sites mete el buscador en un iframe: cada frame escucha y solo actúa si tiene #searchCodigo
    GM_addValueChangeListener('store', (n, o, val) => searchStore(val));
    waitFor(SEL.dlSearch, 10000).then((el) => {
      if (!el) return;
      const s = GM_getValue('store');
      if (fresh(s)) searchStore(s);
    });
  }
})();
