/**
 * Interfaz de cache genérica, sin depender de chrome.storage ni de
 * ningún backend concreto — así se puede testear en Node/vitest y la
 * extensión puede envolver chrome.storage.local (u otra cosa) con la
 * misma forma cuando necesite sobrevivir a que el service worker de MV3
 * se descargue por inactividad.
 */
export interface ContentCache<T> {
  get(key: string): T | undefined | Promise<T | undefined>;
  set(key: string, value: T): void | Promise<void>;
  has(key: string): boolean | Promise<boolean>;
}

/** Cache en memoria sin persistencia. Sirve como implementación por
 * defecto y para tests; no sobrevive a que se descargue el proceso. */
export class InMemoryCache<T> implements ContentCache<T> {
  private readonly store = new Map<string, T>();

  get(key: string): T | undefined {
    return this.store.get(key);
  }

  set(key: string, value: T): void {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}
