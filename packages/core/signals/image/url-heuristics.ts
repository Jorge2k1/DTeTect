import type { Evidence } from '../types';
import type { ImageBytes, ImageSignal } from './types';

/**
 * Dominios de alojamiento de salidas de generadores de IA, verificados
 * uno a uno (no supuestos) — lista deliberadamente pequeña y conservadora:
 * mejor una lista corta y correcta que una larga con dominios inventados.
 * Necesitará mantenimiento con el tiempo, igual que known-ai-tools.ts.
 */
const KNOWN_AI_HOSTING_DOMAINS = [
  'oaidalleapiprodscus.blob.core.windows.net', // salida de la API de DALL-E (OpenAI)
  'replicate.delivery', // salida de modelos alojados en Replicate
  'cdn.leonardo.ai', // imágenes generadas en Leonardo.ai
];

/**
 * Patrones de nombre de archivo por defecto de herramientas de IA conocidas
 * (antes de que el usuario lo renombre). Deliberadamente conservador: nada
 * de patrones genéricos tipo "número-número" que podrían coincidir con
 * cualquier nombre de archivo aleatorio.
 */
const AI_FILENAME_PATTERNS: RegExp[] = [
  /dall[-·\s]*e?[-·\s]*\d{4}-\d{2}-\d{2}/i, // "DALL·E 2024-01-01 12.00.00 - ..."
  /midjourney/i,
  /stable[_-]?diffusion/i,
  /\bleonardo[_-]?ai\b/i,
];

export interface UrlHeuristicsResult {
  matchedDomain?: string;
  matchedFilenamePattern: boolean;
}

export function analyzeImageUrl(url: string): UrlHeuristicsResult {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    // URL relativa o inválida — no hay dominio que comprobar, se sigue
    // igualmente con la comprobación de nombre de archivo.
  }

  const matchedDomain = KNOWN_AI_HOSTING_DOMAINS.find(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );

  const filename = decodeURIComponent(url.split('?')[0]?.split('/').pop() ?? '');
  const matchedFilenamePattern = AI_FILENAME_PATTERNS.some((pattern) => pattern.test(filename));

  return { matchedDomain, matchedFilenamePattern };
}

function toEvidence(result: UrlHeuristicsResult, sourceId: string): Evidence {
  const base = { signal: 'image-url-heuristics' as const, modality: 'image' as const, sourceId };

  if (result.matchedDomain) {
    return {
      ...base,
      aspect: 'Alojada en dominio de IA',
      value: 1,
      confidence: 0.5,
      contribution: 0.55,
      humanReadable: `La imagen se sirve desde "${result.matchedDomain}", un dominio de alojamiento conocido de herramientas de generación de IA.`,
    };
  }

  if (result.matchedFilenamePattern) {
    return {
      ...base,
      aspect: 'Nombre de archivo típico de IA',
      value: 1,
      confidence: 0.35,
      contribution: 0.4,
      humanReadable: 'El nombre del archivo sigue un patrón típico de herramientas de generación de IA sin renombrar.',
    };
  }

  return {
    ...base,
    aspect: 'Sin coincidencias de URL',
    value: 0,
    confidence: 0.1,
    contribution: 0,
    humanReadable:
      'La URL de la imagen no coincide con ningún patrón conocido de herramientas de IA — esto no descarta nada, muchas imágenes generadas por IA se resuben a otros sitios con otro nombre.',
  };
}

export const imageUrlHeuristicsSignal: ImageSignal = {
  name: 'image-url-heuristics',
  async compute(image: ImageBytes): Promise<Evidence> {
    return toEvidence(analyzeImageUrl(image.sourceId), image.sourceId);
  },
};
