/**
 * Web Crypto API global: disponible tanto en navegador como en Node (desde
 * Node 19), pero no está tipada sin la lib "DOM" de TypeScript ni sin
 * @types/node. Se declara aquí, mínima y a mano, en vez de añadir "DOM" a
 * tsconfig — así se mantiene la protección de tipos que impide usar
 * accidentalmente document/window/HTMLElement/etc. en /core.
 */
declare const crypto: {
  subtle: {
    digest(algorithm: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
  };
};

/**
 * Mismo caso que crypto: la clase URL es global tanto en Node como en
 * navegador, pero su tipo viene de la lib "DOM" que /core no incluye a
 * propósito. Se declara mínima — solo lo que usa url-heuristics.ts.
 */
declare class URL {
  constructor(url: string, base?: string);
  readonly hostname: string;
}
