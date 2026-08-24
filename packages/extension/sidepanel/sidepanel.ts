import {
  burstinessSignal,
  type Evidence,
  explain,
  fuse,
  mattrSignal,
  ngramRepetitionSignal,
  stubPerplexitySignal,
} from '@eas/core';

const scoreEl = document.querySelector<HTMLElement>('#score');
const confidenceEl = document.querySelector<HTMLElement>('#confidence');
const summaryEl = document.querySelector<HTMLElement>('#summary');
const evidenceListEl = document.querySelector<HTMLUListElement>('#evidence-list');
const statusEl = document.querySelector<HTMLElement>('#status');

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function requestExtraction(tabId: number): Promise<string | undefined> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'EAS_EXTRACT_REQUEST' });
    return response?.text;
  } catch {
    // El content script puede no estar inyectado todavía (p. ej. página
    // interna del navegador) — se trata como "sin texto disponible".
    return undefined;
  }
}

async function collectEvidence(text: string): Promise<Evidence[]> {
  const syncEvidence = [burstinessSignal, mattrSignal, ngramRepetitionSignal].map((signal) =>
    signal.compute({ text })
  );
  const perplexityEvidence = await stubPerplexitySignal.compute({ text });
  return [...syncEvidence, perplexityEvidence];
}

function renderLoading(): void {
  if (statusEl) statusEl.textContent = 'Analizando contenido visible…';
}

function renderEmpty(): void {
  if (statusEl) statusEl.textContent = 'No se ha encontrado suficiente texto visible en esta pestaña.';
  if (scoreEl) scoreEl.textContent = '—';
  if (confidenceEl) confidenceEl.textContent = 'Confianza del análisis: —';
  if (summaryEl) summaryEl.textContent = '';
  evidenceListEl?.replaceChildren();
}

function renderResult(text: string, evidence: Evidence[]): void {
  const fusion = fuse(evidence);
  const { summary, ranked } = explain(evidence);

  if (statusEl) statusEl.textContent = `${text.length.toLocaleString('es-ES')} caracteres analizados.`;
  if (scoreEl) scoreEl.textContent = `${Math.round(fusion.score * 100)}%`;
  if (confidenceEl) {
    confidenceEl.textContent = `Confianza del análisis: ${fusion.confidenceLevel}`;
    confidenceEl.dataset.level = fusion.confidenceLevel;
  }
  if (summaryEl) {
    summaryEl.textContent = summary || 'No hay evidencia suficiente para explicar el resultado.';
  }

  evidenceListEl?.replaceChildren(
    ...ranked.map((item) => {
      const li = document.createElement('li');
      li.className = 'evidence-item';
      li.dataset.direction = item.contribution >= 0 ? 'ai' : 'human';
      li.textContent = item.humanReadable;
      return li;
    })
  );
}

async function runAnalysis(): Promise<void> {
  renderLoading();

  const tabId = await getActiveTabId();
  if (tabId === undefined) {
    renderEmpty();
    return;
  }

  const text = await requestExtraction(tabId);
  if (!text || text.trim().length === 0) {
    renderEmpty();
    return;
  }

  const evidence = await collectEvidence(text);
  renderResult(text, evidence);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'EAS_CONTENT_UPDATED') {
    void runAnalysis();
  }
});

// El side panel analiza "la pestaña activa": debe reanalizar al cambiar de
// pestaña o al terminar de cargar una navegación en la misma pestaña.
chrome.tabs.onActivated.addListener(() => void runAnalysis());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === 'complete') void runAnalysis();
});

void runAnalysis();
