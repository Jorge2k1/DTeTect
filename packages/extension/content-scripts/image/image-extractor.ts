import { observeContentChanges } from '../text/dom-observer';

const MIN_IMAGE_DIMENSION = 100; // px — descarta iconos, spacers, píxeles de tracking
const VISIBILITY_THRESHOLD = 0.1;

/**
 * Este content script SOLO identifica imágenes visibles (URL, dimensiones,
 * un id estable del elemento). NUNCA lee píxeles ni intenta usar
 * <canvas> — eso choca con la política de "tainted canvas" para imágenes
 * cross-origin. La descarga de bytes la hace el service worker
 * (background/service-worker.ts), que sí puede hacer fetch() cross-origin
 * gracias a host_permissions, sin las restricciones CORS que sufre este
 * content script embebido en la página.
 */
interface DetectedImageMessage {
  type: 'EAS_IMAGE_DETECTED';
  url: string;
  elementId: string;
  width: number;
  height: number;
  /** Texto asociado a la imagen en la página (alt, title, figcaption), si hay. */
  context?: string;
}

const notifiedUrls = new Set<string>();
let elementCounter = 0;
const elementIds = new WeakMap<Element, string>();

function getElementId(el: Element): string {
  let id = elementIds.get(el);
  if (!id) {
    id = `eas-img-${++elementCounter}`;
    elementIds.set(el, id);
  }
  return id;
}

/**
 * Texto que el autor de la página escribió describiendo esta imagen
 * concreta — no es un metadato del archivo, es contenido de la propia
 * página (a veces declara explícitamente "generado por IA", a veces no
 * dice nada). Se limita deliberadamente a alt/title/figcaption: fuentes
 * semánticamente ligadas a ESTA imagen, no un rastreo genérico del texto
 * cercano que podría capturar contenido de otra parte de la página.
 */
function captureContext(el: Element): string | undefined {
  const parts: string[] = [];

  if (el instanceof HTMLImageElement && el.alt) parts.push(el.alt);

  const title = el.getAttribute('title');
  if (title) parts.push(title);

  const figcaption = el.closest('figure')?.querySelector('figcaption');
  if (figcaption?.textContent) parts.push(figcaption.textContent.trim());

  const joined = parts.join(' — ').trim();
  return joined.length > 0 ? joined : undefined;
}

function notify(url: string, el: Element, width: number, height: number): void {
  if (!url || notifiedUrls.has(url)) return;
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) return;

  notifiedUrls.add(url);
  const message: DetectedImageMessage = {
    type: 'EAS_IMAGE_DETECTED',
    url,
    elementId: getElementId(el),
    width,
    height,
    context: captureContext(el),
  };
  chrome.runtime.sendMessage(message).catch(() => {});
}

function notifyImgElement(el: HTMLImageElement): void {
  const url = el.currentSrc || el.src;
  if (!url) return;
  notify(url, el, el.naturalWidth, el.naturalHeight);
}

function backgroundImageUrl(el: Element): string | undefined {
  const value = window.getComputedStyle(el).backgroundImage;
  const match = /url\((['"]?)(.*?)\1\)/.exec(value);
  const rawUrl = match?.[2];
  if (!rawUrl) return undefined;
  try {
    return new URL(rawUrl, document.baseURI).href;
  } catch {
    return undefined;
  }
}

const imageObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;

      if (el instanceof HTMLImageElement) {
        if (el.complete) {
          notifyImgElement(el);
        } else {
          el.addEventListener('load', () => notifyImgElement(el), { once: true });
        }
        continue;
      }

      const bgUrl = backgroundImageUrl(el);
      if (bgUrl) {
        const rect = el.getBoundingClientRect();
        notify(bgUrl, el, rect.width, rect.height);
      }
    }
  },
  { threshold: VISIBILITY_THRESHOLD }
);

const observedElements = new WeakSet<Element>();

function observeCandidates(root: ParentNode = document): void {
  for (const img of root.querySelectorAll('img')) {
    if (!observedElements.has(img)) {
      observedElements.add(img);
      imageObserver.observe(img);
    }
  }

  for (const el of root.querySelectorAll('*')) {
    if (observedElements.has(el)) continue;
    if (backgroundImageUrl(el) === undefined) continue;
    observedElements.add(el);
    imageObserver.observe(el);
  }
}

observeCandidates();
observeContentChanges(() => observeCandidates());
