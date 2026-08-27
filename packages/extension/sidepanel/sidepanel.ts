import {
  burstinessSignal,
  type Evidence,
  explain,
  fuse,
  mattrSignal,
  ngramRepetitionSignal,
  type RankedEvidence,
  type SignalName,
  stubPerplexitySignal,
} from '@eas/core';
import { getExtension, readFileAsText, SUPPORTED_FILE_EXTENSIONS } from './file-readers';
import { analyzeImage } from './image-analyzer';

const SIGNAL_LABELS: Record<SignalName, string> = {
  burstiness: 'Variación de longitud de frase (burstiness)',
  'lexical-diversity-mattr': 'Riqueza léxica (MATTR)',
  'ngram-repetition': 'Repetición de n-gramas',
  perplexity: 'Perplexity',
  'c2pa-provenance': 'Procedencia C2PA',
  'exif-metadata': 'Metadatos EXIF',
};

interface PanelElements {
  status: HTMLElement | null;
  score: HTMLElement | null;
  confidence: HTMLElement | null;
  summary: HTMLElement | null;
  evidenceList: HTMLUListElement | null;
}

function getPanelElements(prefix: 'dom' | 'file'): PanelElements {
  return {
    status: document.querySelector<HTMLElement>(`#${prefix}-status`),
    score: document.querySelector<HTMLElement>(`#${prefix}-score`),
    confidence: document.querySelector<HTMLElement>(`#${prefix}-confidence`),
    summary: document.querySelector<HTMLElement>(`#${prefix}-summary`),
    evidenceList: document.querySelector<HTMLUListElement>(`#${prefix}-evidence-list`),
  };
}

const domPanel = getPanelElements('dom');
const filePanel = getPanelElements('file');

async function collectEvidence(text: string): Promise<Evidence[]> {
  const syncEvidence = [burstinessSignal, mattrSignal, ngramRepetitionSignal].map((signal) =>
    signal.compute({ text })
  );
  const perplexityEvidence = await stubPerplexitySignal.compute({ text });
  return [...syncEvidence, perplexityEvidence];
}

function renderLoading(panel: PanelElements, message: string): void {
  if (panel.status) panel.status.textContent = message;
}

function renderEmpty(panel: PanelElements, message: string): void {
  if (panel.status) panel.status.textContent = message;
  if (panel.score) panel.score.textContent = '—';
  if (panel.confidence) panel.confidence.textContent = 'Confianza del análisis: —';
  if (panel.summary) panel.summary.textContent = '';
  panel.evidenceList?.replaceChildren();
}

/** contribution ∈ [-1, 1] → posición/anchura de la barra centrada en el 50%. */
function contributionBarStyle(contribution: number): string {
  const half = Math.abs(contribution) * 50;
  const left = contribution >= 0 ? 50 : 50 - half;
  return `left: ${left}%; width: ${half}%;`;
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function buildEvidenceItem(item: RankedEvidence): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'evidence-item';
  li.dataset.direction = item.contribution >= 0 ? 'ai' : 'human';

  const head = document.createElement('div');
  head.className = 'evidence-head';

  const name = document.createElement('span');
  name.className = 'evidence-name';
  name.textContent = SIGNAL_LABELS[item.signal] ?? item.signal;

  const pct = document.createElement('span');
  pct.className = 'evidence-pct';
  pct.textContent = `${formatPercent(Math.abs(item.contribution))} ${item.contribution >= 0 ? 'hacia IA' : 'hacia humano'}`;

  head.append(name, pct);

  const bar = document.createElement('div');
  bar.className = 'evidence-bar';
  const barFill = document.createElement('div');
  barFill.className = 'evidence-bar-fill';
  barFill.setAttribute('style', contributionBarStyle(item.contribution));
  bar.append(barFill);

  const text = document.createElement('p');
  text.className = 'evidence-text';
  text.textContent = item.humanReadable;

  const meta = document.createElement('p');
  meta.className = 'evidence-meta';
  meta.textContent = `Confianza de esta señal: ${formatPercent(item.confidence)} · peso en el resultado: ${formatPercent(Math.abs(item.weightedImpact))}`;

  li.append(head, bar, text, meta);
  return li;
}

function renderResult(panel: PanelElements, statusMessage: string, evidence: Evidence[]): void {
  const fusion = fuse(evidence);
  const { summary, ranked } = explain(evidence);

  if (panel.status) panel.status.textContent = statusMessage;
  if (panel.score) panel.score.textContent = `${Math.round(fusion.score * 100)}%`;
  if (panel.confidence) {
    panel.confidence.textContent = `Confianza del análisis: ${fusion.confidenceLevel}`;
    panel.confidence.dataset.level = fusion.confidenceLevel;
  }
  if (panel.summary) {
    panel.summary.textContent = summary || 'No hay evidencia suficiente para explicar el resultado.';
  }

  panel.evidenceList?.replaceChildren(...ranked.map(buildEvidenceItem));
}

// --- Imágenes de la página actual ------------------------------------

/**
 * Una tarjeta independiente por imagen, cada una con su propio score —
 * nunca se mezclan entre sí ni con el texto de la página (fuse() se llama
 * una vez por sujeto, no una vez para toda la página). Reutiliza
 * renderResult construyendo un PanelElements "de mentira" apuntando a los
 * elementos internos de la tarjeta, en vez de duplicar la lógica de
 * pintado de score/evidencias.
 */
const imageCardsContainer = document.querySelector<HTMLElement>('#dom-image-cards');
const imageEmptyEl = document.querySelector<HTMLElement>('#dom-image-empty');
const imageCards = new Map<string, { container: HTMLElement; panel: PanelElements }>();

function buildImageCardSkeleton(sourceId: string): { container: HTMLElement; panel: PanelElements } {
  const container = document.createElement('div');
  container.className = 'image-card';

  const thumb = document.createElement('img');
  thumb.className = 'image-card-thumb';
  thumb.src = sourceId;
  thumb.alt = '';
  thumb.loading = 'lazy';

  const status = document.createElement('p');
  status.className = 'status';

  const scoreRow = document.createElement('div');
  scoreRow.className = 'image-card-score-row';
  const score = document.createElement('div');
  score.className = 'score-value image-card-score';
  const confidence = document.createElement('div');
  confidence.className = 'confidence-label';
  scoreRow.append(score, confidence);

  const summary = document.createElement('p');
  summary.className = 'image-card-summary';

  const evidenceList = document.createElement('ul');
  evidenceList.className = 'evidence-list';

  container.append(thumb, status, scoreRow, summary, evidenceList);

  return { container, panel: { status, score, confidence, summary, evidenceList } };
}

function renderImageEvidence(sourceId: string, evidence: Evidence[]): void {
  if (!imageCardsContainer) return;

  let card = imageCards.get(sourceId);
  if (!card) {
    card = buildImageCardSkeleton(sourceId);
    imageCards.set(sourceId, card);
    imageCardsContainer.append(card.container);
  }

  if (imageEmptyEl) imageEmptyEl.hidden = imageCards.size > 0;
  renderResult(card.panel, 'Imagen analizada', evidence);
}

function clearImageCards(): void {
  imageCards.clear();
  imageCardsContainer?.replaceChildren();
  if (imageEmptyEl) imageEmptyEl.hidden = false;
}

// --- Pestaña "Página actual" ---------------------------------------------

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

async function runDomAnalysis(): Promise<void> {
  renderLoading(domPanel, 'Analizando contenido visible…');
  clearImageCards();

  const tabId = await getActiveTabId();
  if (tabId === undefined) {
    renderEmpty(domPanel, 'No se ha encontrado suficiente texto visible en esta pestaña.');
    return;
  }

  const text = await requestExtraction(tabId);
  if (!text || text.trim().length === 0) {
    renderEmpty(domPanel, 'No se ha encontrado suficiente texto visible en esta pestaña.');
    return;
  }

  const evidence = await collectEvidence(text);
  renderResult(domPanel, `${text.length.toLocaleString('es-ES')} caracteres analizados.`, evidence);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'EAS_CONTENT_UPDATED') {
    void runDomAnalysis();
  }
  // El análisis de imagen (fetch + EXIF + C2PA) corre aquí mismo, en el
  // side panel, no en el service worker: @contentauth/c2pa-web necesita
  // crear un Worker, y eso está prohibido dentro de un service worker.
  if (message?.type === 'EAS_IMAGE_DETECTED') {
    void analyzeImage(message.url, renderImageEvidence);
  }
});

// El side panel analiza "la pestaña activa": debe reanalizar al cambiar de
// pestaña o al terminar de cargar una navegación en la misma pestaña.
chrome.tabs.onActivated.addListener(() => void runDomAnalysis());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === 'complete') void runDomAnalysis();
});

void runDomAnalysis();

// --- Pestaña "Analizar archivo" -------------------------------------------

async function handleFile(file: File): Promise<void> {
  const extension = getExtension(file.name);
  if (!SUPPORTED_FILE_EXTENSIONS.includes(extension)) {
    renderEmpty(
      filePanel,
      `Formato no soportado (${extension || 'sin extensión'}). Usa .txt, .md, .html, .docx o .pdf.`
    );
    return;
  }

  renderLoading(filePanel, `Analizando "${file.name}"…`);

  let text: string;
  try {
    text = await readFileAsText(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    renderEmpty(filePanel, `No se pudo leer "${file.name}": ${message}`);
    return;
  }

  if (!text || text.trim().length === 0) {
    renderEmpty(filePanel, `No se ha encontrado texto analizable en "${file.name}".`);
    return;
  }

  const evidence = await collectEvidence(text);
  renderResult(filePanel, `"${file.name}" — ${text.length.toLocaleString('es-ES')} caracteres analizados.`, evidence);
}

const fileInput = document.querySelector<HTMLInputElement>('#file-input');
const fileDrop = document.querySelector<HTMLLabelElement>('#file-drop');

fileInput?.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void handleFile(file);
});

fileDrop?.addEventListener('dragover', (event) => {
  event.preventDefault();
  fileDrop.classList.add('drag-over');
});

fileDrop?.addEventListener('dragleave', () => {
  fileDrop.classList.remove('drag-over');
});

fileDrop?.addEventListener('drop', (event) => {
  event.preventDefault();
  fileDrop.classList.remove('drag-over');
  const file = event.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
});

// --- Pestañas ---------------------------------------------------------

const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-button');
const tabPanels = document.querySelectorAll<HTMLElement>('[data-tab-panel]');

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    for (const b of tabButtons) b.setAttribute('aria-selected', String(b === button));
    for (const panel of tabPanels) {
      panel.hidden = panel.dataset.tabPanel !== button.dataset.tab;
    }
  });
}
