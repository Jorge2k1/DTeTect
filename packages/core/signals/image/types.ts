import type { Evidence, SignalName } from '../types';

/**
 * Input de las señales de imagen: bytes crudos + de dónde vienen. NO es un
 * "ImageEvidence" — cada señal (exif.ts, c2pa.ts) mapea su resultado al
 * mismo Evidence genérico de /core/signals/types.ts, igual que hacen las
 * señales de texto con SignalInput.
 */
export interface ImageBytes {
  bytes: ArrayBuffer;
  /** Identifica la imagen de origen — se usa como Evidence.sourceId. */
  sourceId: string;
  /** MIME type si se conoce (p. ej. desde la respuesta del fetch). */
  mimeType?: string;
}

/**
 * Análogo a TextSignal/AsyncTextSignal pero para imagen: todas las señales
 * de imagen son async (parsear EXIF, verificar C2PA), así que solo hace
 * falta una variante.
 */
export interface ImageSignal {
  name: SignalName;
  compute(input: ImageBytes): Promise<Evidence>;
}
