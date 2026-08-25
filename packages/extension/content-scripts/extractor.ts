const BLOCK_SELECTOR = 'p, li, blockquote, h1, h2, h3, h4, h5, h6, article, section, td, dd';
const EXCLUDED_ANCESTOR_SELECTOR =
  'nav, header, footer, aside, script, style, noscript, form, [aria-hidden="true"], [role="navigation"]';
const MIN_BLOCK_TEXT_LENGTH = 40;
const MAX_LINK_DENSITY = 0.5;

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  const isFullyTransparent = style.opacity !== '' && Number(style.opacity) === 0;
  if (style.display === 'none' || style.visibility === 'hidden' || isFullyTransparent) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isExcluded(el: Element): boolean {
  return el.closest(EXCLUDED_ANCESTOR_SELECTOR) !== null;
}

function linkDensity(el: Element): number {
  const text = (el.textContent ?? '').trim();
  if (text.length === 0) return 1;
  const linkText = Array.from(el.querySelectorAll('a'))
    .map((a) => (a.textContent ?? '').trim())
    .join('');
  return linkText.length / text.length;
}

/**
 * article/section casan con BLOCK_SELECTOR como contenedores Y como
 * bloques propios: si dentro tienen p/li/etc., su textContent duplicaría
 * el de sus hijos. Nos quedamos solo con los bloques más internos (los que
 * no contienen a su vez otro bloque candidato).
 */
function isLeafBlock(el: Element): boolean {
  return el.querySelector(BLOCK_SELECTOR) === null;
}

export interface ExtractOptions {
  /**
   * Un documento parseado a partir de un archivo subido (no insertado en la
   * página en vivo) no tiene layout: getComputedStyle/getBoundingClientRect
   * no reflejan nada real. Para ese caso se salta la comprobación de
   * visibilidad y se confía solo en los filtros de exclusión/densidad de
   * enlaces/longitud, que no dependen de layout.
   */
  skipVisibilityCheck?: boolean;
}

/**
 * Extracción tipo Readability: recorre bloques semánticos, descarta
 * navegación/publicidad por ancestro y por densidad de enlaces, y deduplica
 * texto repetido (p. ej. tarjetas de producto repetidas en el DOM).
 */
export function extractVisibleText(root: ParentNode = document, options: ExtractOptions = {}): string {
  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR)).filter(isLeafBlock);
  const seenText = new Set<string>();
  const chunks: string[] = [];

  for (const block of blocks) {
    if (!(block instanceof HTMLElement)) continue;
    if (isExcluded(block)) continue;
    if (!options.skipVisibilityCheck && !isVisible(block)) continue;

    const text = (block.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < MIN_BLOCK_TEXT_LENGTH) continue;
    if (linkDensity(block) > MAX_LINK_DENSITY) continue;
    if (seenText.has(text)) continue;

    seenText.add(text);
    chunks.push(text);
  }

  return chunks.join('\n\n');
}
