export type Modality = 'text' | 'image';

export type SignalName =
  | 'burstiness'
  | 'lexical-diversity-mattr'
  | 'ngram-repetition'
  | 'perplexity'
  // Reservadas para V2 (imagen) — el Fusion Engine ya sabe pesarlas.
  | 'c2pa-provenance'
  | 'exif-metadata';

/**
 * Unidad de evidencia común a texto e imagen. El Fusion Engine solo conoce
 * este tipo, nunca "TextEvidence" o "ImageEvidence", para que V2 se sume sin
 * tocar la fusión ni la UI.
 */
export interface Evidence {
  signal: SignalName;
  modality: Modality;
  /**
   * Identifica de qué elemento concreto viene esta evidencia (p. ej.
   * 'page-text' para el texto de la página, o la URL/id de una imagen
   * concreta). El core no sabe qué es una "página" o una "imagen" — solo
   * expone este campo para que quien fusiona evidencia (side panel,
   * service worker) pueda agrupar un Evidence[] por sujeto y calcular un
   * score independiente por cada uno, sin que el texto y una imagen (o,
   * en el futuro, un vídeo) se mezclen en la misma fusión.
   */
  sourceId?: string;
  /** Valor crudo de la métrica, en las unidades propias de cada señal. */
  value: number;
  /** 0..1 — cuánto se puede confiar en esta medición concreta. */
  confidence: number;
  /** -1..1 — hacia generado por IA (+) o hacia humano (-). */
  contribution: number;
  humanReadable: string;
}

export interface SignalInput {
  text: string;
}

export interface TextSignal {
  name: SignalName;
  compute(input: SignalInput): Evidence;
}

export interface AsyncTextSignal {
  name: SignalName;
  compute(input: SignalInput): Promise<Evidence>;
}
