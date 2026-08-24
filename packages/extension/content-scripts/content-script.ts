import { observeContentChanges } from './dom-observer';
import { extractVisibleText } from './extractor';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'EAS_EXTRACT_REQUEST') {
    sendResponse({ type: 'EAS_EXTRACT_RESPONSE', text: extractVisibleText(), url: window.location.href });
  }
  return true;
});

function notifyContentChanged(): void {
  // El side panel puede estar cerrado; sendMessage sin listeners activos
  // rechaza la promesa, y eso es un estado normal, no un error.
  chrome.runtime.sendMessage({ type: 'EAS_CONTENT_UPDATED' }).catch(() => {});
}

const stopObserving = observeContentChanges(notifyContentChanged);
window.addEventListener('pagehide', stopObserving, { once: true });
