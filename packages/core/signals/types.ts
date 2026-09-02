export type Modality = 'text' | 'image';

export type SignalName =
  | 'burstiness'
  | 'lexical-diversity-mattr'
  | 'ngram-repetition'
  | 'perplexity'
  // Fase 2 (imagen)
  | 'c2pa-provenance'
  | 'exif-metadata'
  | 'xmp-metadata'
  | 'image-url-heuristics'
  | 'image-context-text';

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
  /**
   * Qué aspecto concreto detectó esta evidencia, en 2-5 palabras (p. ej.
   * "Origen declarado: cámara" o "Nombre de archivo típico de IA") —
   * distinto del nombre de la señal (que es fijo, p. ej. "Procedencia
   * C2PA") y de humanReadable (la frase completa). Una misma señal puede
   * activar ramas muy distintas entre sí (C2PA sin manifiesto vs. C2PA
   * declarando IA vs. C2PA declarando cámara...), así que el nombre de la
   * señal por sí solo no basta para saber de un vistazo a qué atributo
   * concreto se está haciendo referencia en la UI.
   */
  aspect: string;
  /** Valor crudo de la métrica, en las unidades propias de cada señal. */
  value: number;
  /** 0..1 — cuánto se puede confiar en esta medición concreta. */
  confidence: number;
  /** -1..1 — hacia generado por IA (+) o hacia humano (-). */
  contribution: number;
  humanReadable: string;
  /**
   * Desglose, atributo por atributo, de los datos crudos que llevaron a
   * esta conclusión (p. ej. para C2PA: si había manifiesto, si la firma
   * era válida, qué digitalSourceType declaraba...). Opcional: solo tiene
   * sentido cuando una misma conclusión puede depender de varios campos a
   * la vez y una sola frase en prosa no deja claro cuál de ellos fue
   * determinante. Se muestra en la UI como una lista corta, no en el
   * cuerpo de humanReadable, para no mezclar la explicación narrativa con
   * los datos concretos que la sustentan.
   */
  details?: { label: string; value: string }[];
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
