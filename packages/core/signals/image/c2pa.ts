import type { Evidence } from '../types';
import { matchesKnownAiSoftware } from './known-ai-tools';

/**
 * `@contentauth/c2pa-web` no puede ejecutarse en Node/vitest: usa un Web
 * Worker del navegador y necesita fetch() de un binario WASM (verificado
 * al probarlo directamente — falla con "Worker is not defined" y
 * "fetch failed" para file://). La invocación real del SDK vive en
 * packages/extension/background (entorno de navegador real, con Worker y
 * fetch funcionando); aquí solo vive el mapeo — puro, determinista y
 * testeable con fixtures — de un resultado de verificación ya simplificado
 * al Evidence genérico.
 */
export interface C2paCheckResult {
  /** true si se encontró algún manifiesto C2PA en el archivo. */
  manifestFound: boolean;
  /** true si la firma criptográfica del manifiesto activo es válida. */
  signatureValid: boolean;
  /** Herramienta/generador declarado en el manifiesto activo, si lo hay. */
  claimGenerator?: string;
  /**
   * digitalSourceType del manifiesto activo (vocabulario IPTC/C2PA), si lo
   * declara — p. ej. ".../trainedAlgorithmicMedia" para contenido generado
   * por IA, o ".../digitalCapture" para una fotografía tomada por cámara.
   */
  digitalSourceType?: string;
}

/**
 * Vocabulario IPTC de digitalSourceType (http://cv.iptc.org/newscodes/digitalsourcetype/).
 * Deliberadamente no se incluyen valores ambiguos como "digitalArt",
 * "digitalCreation", "softwareImage" o "screenCapture" — pueden ser 100%
 * obra humana (arte digital dibujado a mano, capturas de pantalla) y no
 * dicen nada fiable sobre IA vs. humano; se quedan en el caso neutro.
 */
const AI_SOURCE_TYPES = [
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'algorithmicMedia',
  'dataDrivenMedia',
  'compositeSynthetic',
];
const CAMERA_SOURCE_TYPES = [
  'digitalCapture',
  'negativeFilm',
  'positiveFilm',
  'print',
  'computationalCapture',
  'compositeCapture',
];

function matchesAny(digitalSourceType: string | undefined, needles: string[]): boolean {
  return digitalSourceType !== undefined && needles.some((needle) => digitalSourceType.includes(needle));
}

export function mapC2paResultToEvidence(result: C2paCheckResult, sourceId: string): Evidence {
  const base = { signal: 'c2pa-provenance' as const, modality: 'image' as const, sourceId };

  if (!result.manifestFound) {
    return {
      ...base,
      value: 0,
      confidence: 0.1,
      contribution: 0.05,
      humanReadable:
        'La imagen no tiene manifiesto C2PA — no aporta ni descarta nada por sí solo, la mayoría de imágenes hoy no lo tienen.',
    };
  }

  if (!result.signatureValid) {
    return {
      ...base,
      value: 0,
      confidence: 0.5,
      contribution: 0.3,
      humanReadable:
        'La imagen tiene un manifiesto C2PA pero su firma no es válida — el historial de procedencia no es de fiar.',
    };
  }

  if (matchesAny(result.digitalSourceType, AI_SOURCE_TYPES)) {
    return {
      ...base,
      value: 1,
      confidence: 0.98,
      contribution: 0.98,
      humanReadable: `Manifiesto C2PA firmado y válido: declara origen generado por IA${
        result.claimGenerator ? ` (${result.claimGenerator})` : ''
      }.`,
    };
  }

  if (matchesAny(result.digitalSourceType, CAMERA_SOURCE_TYPES)) {
    return {
      ...base,
      value: 1,
      confidence: 0.98,
      contribution: -0.98,
      humanReadable: 'Manifiesto C2PA firmado y válido: declara origen de captura por cámara real.',
    };
  }

  // Válido, pero sin digitalSourceType concluyente: no es un cero neutro.
  // Las herramientas de generación de IA tienen fuerte incentivo a
  // declarar ese campo explícitamente (es su forma de demostrar
  // cumplimiento normativo); si una herramienta firmó C2PA pero no lo
  // declaró, eso ya es un indicio débil de que probablemente no es un
  // generador de IA. Se comprueba también el claimGenerator por si nombra
  // una herramienta de IA conocida sin haber marcado el campo formal.
  if (matchesKnownAiSoftware(result.claimGenerator)) {
    return {
      ...base,
      value: 0.7,
      confidence: 0.5,
      contribution: 0.6,
      humanReadable: `Manifiesto C2PA firmado y válido, creado con "${result.claimGenerator}" — herramienta asociada a generación de imagen por IA, aunque el manifiesto no declara el origen de forma explícita.`,
    };
  }

  return {
    ...base,
    value: 0.4,
    confidence: 0.4,
    contribution: -0.2,
    humanReadable: `Manifiesto C2PA firmado y válido${
      result.claimGenerator ? ` (creado con ${result.claimGenerator})` : ''
    }, pero no declara el origen del contenido de forma concluyente — la ausencia de esa declaración es un indicio débil, no una prueba, de que probablemente no es contenido generado por IA.`,
  };
}
