const toggle = document.getElementById('toggle');
const stateEl = document.getElementById('state');
const hintEl = document.getElementById('hint');

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.round(m / 60);
  if (h < 24) return 'hace ' + h + ' h';
  return new Date(ts).toLocaleDateString('es-ES');
}

function render(data) {
  const on = data.enabled !== false;
  toggle.setAttribute('aria-checked', String(on));
  stateEl.textContent = on ? 'Automatización activada' : 'Automatización en pausa';
  hintEl.textContent = on ? 'Pulsa para pausarla' : 'Pulsa para activarla';

  document.querySelectorAll('.row').forEach((row) => {
    const item = data[row.dataset.key];
    const has = item && item.value;
    row.classList.toggle('empty', !has);
    row.querySelector('b').textContent = has ? item.value : 'Sin datos';
    row.querySelector('time').textContent = has && item.ts ? ago(item.ts) : '';
  });
}

async function refresh() {
  render(await chrome.storage.local.get(null));
}

toggle.addEventListener('click', async () => {
  const { enabled } = await chrome.storage.local.get('enabled');
  await chrome.storage.local.set({ enabled: enabled === false });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') refresh();
});

refresh();
setInterval(refresh, 15000);
