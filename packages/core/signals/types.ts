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
