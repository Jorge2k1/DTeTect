import type { Evidence } from '../types';
import { matchesKnownAiSoftware } from './known-ai-tools';
import type { ImageBytes, ImageSignal } from './types';

/**
 * No es una marca criptográfica ni un metadato del archivo — es texto que
 * el propio autor de la página escribió cerca de la imagen (alt, title,
 * pie de foto) declarando de dónde viene. Solo es evidencia cuando dice
 * algo explícito: su ausencia no significa nada (la inmensa mayoría de
 * imágenes, de IA o no, no llevan ningún aviso).
 */
const AI_DISCLOSURE_PATTERNS: RegExp[] = [
  /generad[ao]\s+(por|con)\s+(ia|inteligencia artificial|ai)/i,
  /cread[ao]\s+(por|con)\s+(ia|inteligencia artificial|ai)/i,
  /\bimagen\s+de\s+ia\b/i,
  /\bfoto\s+de\s+ia\b/i,
  /\bai[- ]generated\b/i,
  /\bgenerated\s+(by|with|using)\s+(ai|artificial intelligence)/i,
  /\bcreated\s+(by|with|using)\s+(ai|artificial intelligence)/i,
  /\bmade\s+with\s+ai\b/i,
];

export interface ImageContextResult {
  text: string;
  matchesDisclosure: boolean;
  matchesKnownTool: boolean;
}

export function analyzeImageContext(contextText: string | undefined): ImageContextResult {
  const text = (contextText ?? '').trim();
  return {
    text,
    matchesDisclosure: text.length > 0 && AI_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(text)),
    matchesKnownTool: matchesKnownAiSoftware(text.length > 0 ? text : undefined),
  };
}

function toEvidence(result: ImageContextResult, sourceId: string): Evidence {
  const base = { signal: 'image-context-text' as const, modality: 'image' as const, sourceId };

  if (result.matchesDisclosure) {
    return {
      ...base,
      aspect: 'Declaración explícita de IA',
      value: 1,
      confidence: 0.6,
      contribution: 0.7,
      humanReadable:
        'El texto alrededor de la imagen (alt, título o pie de foto) declara explícitamente que es contenido generado por IA.',
    };
  }

  if (result.matchesKnownTool) {
    return {
      ...base,
      aspect: 'Menciona herramienta de IA',
      value: 0.7,
      confidence: 0.4,
      contribution: 0.5,
      humanReadable: 'El texto alrededor de la imagen menciona una herramienta de generación de IA conocida.',
    };
  }

  return {
    ...base,
    aspect: 'Sin mención de IA en el texto',
    value: 0,
    confidence: 0.1,
    contribution: 0,
    humanReadable:
      'No se encontró ninguna declaración de generación por IA en el texto alrededor de la imagen — la mayoría de imágenes no incluyen ese tipo de aviso, así que esto no aporta ni descarta nada.',
  };
}

export const imageContextTextSignal: ImageSignal = {
  name: 'image-context-text',
  async compute(image: ImageBytes): Promise<Evidence> {
    return toEvidence(analyzeImageContext(image.context), image.sourceId);
  },
};
