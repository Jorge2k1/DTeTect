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

function notify(url: string, el: Element, width: number, height: number): void {
  if (!url || notifiedUrls.has(url)) return;
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) return;

  notifiedUrls.add(url);
  const message: DetectedImageMessage = { type: 'EAS_IMAGE_DETECTED', url, elementId: getElementId(el), width, height };
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
