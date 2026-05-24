// Toggle do painel ao clicar no ícone da extensão
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' });
  } catch (err) {
    // Content script ainda não injetado — recarregar a aba resolve.
    console.warn('[Autotec] content script ausente nesta aba:', err);
  }
});
