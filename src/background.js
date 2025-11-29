// SafeDM - background service worker (skeleton)
// Runs once when extension installed or updated.

chrome.runtime.onInstalled.addListener(() => {
  console.log("SafeDM installed.");

  // default settings
  chrome.storage.local.set({
    safedm_enabled: true,
    safedm_sensitivity: "medium"
  });
});

// Listener for future messages from content scripts (we'll use this later)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("SafeDM message from content:", msg);
});
