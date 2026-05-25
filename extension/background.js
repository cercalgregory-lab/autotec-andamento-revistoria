// Toggle do painel ao clicar no ícone da extensão
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
  } catch (err) {
    console.warn('[Autotec] content script ausente nesta aba:', err);
  }
});

// Relay para Google Sheets — background tem origem da extensão, contorna CORS
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'SAVE_TO_SHEETS') return;
  fetch(msg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(msg.data),
    redirect: 'follow',
  })
    .then(r => r.text())
    .then(text => {
      try { sendResponse({ ok: true, data: JSON.parse(text) }); }
      catch { sendResponse({ ok: true }); }
    })
    .catch(err => sendResponse({ ok: false, error: err.message }));
  return true;
});
