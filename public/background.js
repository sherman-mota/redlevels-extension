// Redlevels Extension — service worker.
// Clicking the toolbar icon opens the app in a tab (Kanban boards need room),
// or focuses the existing Redlevels tab if one is already open.

const APP_URL = chrome.runtime.getURL('index.html');

chrome.action.onClicked.addListener(async () => {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['TAB'],
      documentUrls: [APP_URL],
    });
    const existing = contexts.find((c) => c.tabId !== -1);
    if (existing) {
      await chrome.tabs.update(existing.tabId, { active: true });
      await chrome.windows.update(existing.windowId, { focused: true });
      return;
    }
  } catch (err) {
    console.warn('Redlevels: não foi possível localizar aba existente', err);
  }
  await chrome.tabs.create({ url: APP_URL });
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.tabs.create({ url: APP_URL });
  }
});
