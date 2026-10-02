// TeleGo - service worker: atajo de teclado y distintivo "OFF" en el icono

async function isEnabled() {
  const { enabled } = await chrome.storage.local.get('enabled');
  return enabled !== false;
}

async function updateBadge() {
  const on = await isEnabled();
  await chrome.action.setBadgeBackgroundColor({ color: '#3A3A3A' });
  await chrome.action.setBadgeText({ text: on ? '' : 'OFF' });
  await chrome.action.setTitle({ title: 'TeleGo - automatización ' + (on ? 'activada' : 'desactivada') });
}

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'enabled' in changes) updateBadge();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-automation') return;
  const on = await isEnabled();
  await chrome.storage.local.set({ enabled: !on });
});
