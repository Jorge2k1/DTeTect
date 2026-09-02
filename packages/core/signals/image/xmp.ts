import exifr from 'exifr';
import type { Evidence } from '../types';
import { classifyDigitalSourceType } from './iptc-digital-source-type';
import { matchesKnownAiSoftware } from './known-ai-tools';
import type { ImageBytes, ImageSignal } from './types';

/**
 * XMP es la versión SIN FIRMA CRIPTOGRÁFICA del mismo campo que lee
 * c2pa.ts: muchas herramientas (Photoshop, Lightroom, algunos
 * generadores) escriben `digitalSourceType` en un bloque XMP incrustado
 * en el archivo sin llegar a firmar un manifiesto C2PA completo. Por eso
 * es una señal más débil que C2PA (se puede eliminar o falsificar sin más
 * esfuerzo que editar el archivo), pero más fuerte que EXIF puro — es una
 * declaración explícita, no una inferencia a partir de Make/Model.
 */
export interface XmpResult {
  hasXmp: boolean;
  digitalSourceType?: string;
  /** xmp:CreatorTool — la herramienta que creó/exportó el archivo. */
  creatorTool?: string;
}

const EMPTY_RESULT: XmpResult = { hasXmp: false };

/**
 * exifr necesita la opción `xmp: true` explícitamente — sin ella ignora
 * por completo el segmento XMP, aunque exista (verificado: con una imagen
 * que solo tiene XMP, sin EXIF, exifr.parse() por defecto devuelve
 * undefined; con `xmp: true` sí lo lee).
 */
export async function readXmp(image: ImageBytes): Promise<XmpResult> {
  const data = await exifr.parse(image.bytes, { xmp: true }).catch(() => undefined);
  if (!data) return EMPTY_RESULT;

  return {
    hasXmp: true,
    digitalSourceType: typeof data.DigitalSourceType === 'string' ? data.DigitalSourceType : undefined,
    creatorTool: typeof data.CreatorTool === 'string' ? data.CreatorTool : undefined,
  };
}

function toEvidence(result: XmpResult, sourceId: string): Evidence {
  const base = { signal: 'xmp-metadata' as const, modality: 'image' as const, sourceId };
  const sourceTypeClass = classifyDigitalSourceType(result.digitalSourceType);

  if (sourceTypeClass === 'ai') {
    return {
      ...base,
      aspect: 'Origen declarado: IA (XMP)',
      value: 1,
      confidence: 0.75,
      contribution: 0.85,
      humanReadable: `Los metadatos XMP declaran origen generado por IA (sin firma criptográfica, a diferencia de C2PA).`,
    };
  }

  if (sourceTypeClass === 'camera') {
    return {
      ...base,
      aspect: 'Origen declarado: cámara (XMP)',
      value: 1,
      confidence: 0.75,
      contribution: -0.85,
      humanReadable: 'Los metadatos XMP declaran origen de captura por cámara (sin firma criptográfica, a diferencia de C2PA).',
    };
  }

  if (matchesKnownAiSoftware(result.creatorTool)) {
    return {
      ...base,
      aspect: 'Herramienta de IA declarada (XMP)',
      value: 0.7,
      confidence: 0.4,
      contribution: 0.5,
      humanReadable: `Los metadatos XMP nombran "${result.creatorTool}" como herramienta creadora — asociada a generación de imagen por IA.`,
    };
  }

  // A diferencia de C2PA, no se aplica aquí el razonamiento de "ausencia
  // de declaración = indicio de que no es IA": firmar C2PA es un acto
  // deliberado de procedencia, pero un bloque XMP puede existir por
  // razones totalmente ajenas (perfil de color, palabras clave, rating)
  // sin que quien lo escribió tuviera ningún motivo para declarar origen.
  return {
    ...base,
    aspect: result.hasXmp ? 'XMP sin origen concluyente' : 'Sin metadatos XMP',
    value: 0,
    confidence: 0.1,
    contribution: 0,
    humanReadable: result.hasXmp
      ? 'La imagen tiene metadatos XMP, pero sin información de origen que sea concluyente.'
      : 'La imagen no tiene metadatos XMP.',
  };
}

export const xmpSignal: ImageSignal = {
  name: 'xmp-metadata',
  async compute(image: ImageBytes): Promise<Evidence> {
    const result = await readXmp(image);
    return toEvidence(result, image.sourceId);
  },
};
