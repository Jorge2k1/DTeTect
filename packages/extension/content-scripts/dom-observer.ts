export type ContentChangeListener = () => void;

export interface ObserveOptions {
  debounceMs?: number;
  target?: Node;
}

/**
 * Observa mutaciones del DOM (contenido dinámico / SPA) y avisa con
 * debounce para no relanzar el análisis en cada micro-cambio.
 */
export function observeContentChanges(listener: ContentChangeListener, options: ObserveOptions = {}): () => void {
  const { debounceMs = 800, target = document.body } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const observer = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(listener, debounceMs);
  });

  observer.observe(target, { childList: true, subtree: true, characterData: true });

  return () => {
    if (timer) clearTimeout(timer);
    observer.disconnect();
  };
}
