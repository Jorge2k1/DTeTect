import type { Evidence, SignalName } from '../signals/types';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface FusionResult {
  /** 0..1 — más alto implica más evidencia acumulada de generación por IA. */
  score: number;
  confidenceLevel: ConfidenceLevel;
  evidenceCount: number;
  evidence: Evidence[];
}

/**
 * Pesos por tipo de señal. La evidencia dura (procedencia, V2) pesa mucho
 * más que la evidencia blanda (patrones lingüísticos, Fase 1) porque es
 * casi determinista frente a estadística.
 *
 * Dentro de la evidencia blanda, lexical-diversity-mattr pesa menos que
 * las demás: en textos técnicos/informativos (humanos o de IA) la
 * diversidad léxica sube solo por cubrir muchos términos distintos, no
 * por el estilo de escritura, así que es la señal menos fiable de las
 * tres cuando actúan solas. burstiness y ngram-repetition acertaron la
 * dirección en todos los textos de referencia probados (ver
 * calibration.test.ts) y por eso pesan más.
 */
export const DEFAULT_SIGNAL_WEIGHTS: Record<SignalName, number> = {
  burstiness: 1.6,
  'lexical-diversity-mattr': 0.4,
  'ngram-repetition': 1.1,
  perplexity: 1.5,
  'c2pa-provenance': 5,
  'exif-metadata': 3,
};

/**
 * Combina evidencia heterogénea (texto hoy, texto + imagen en V2) en un
 * único score explicado. No es un promedio simple: cada evidencia pesa por
 * su propia confianza y por el peso configurado de su tipo de señal, así
 * que una señal poco fiable o de bajo peso apenas mueve el resultado.
 */
export function fuse(
  evidence: Evidence[],
  weights: Partial<Record<SignalName, number>> = DEFAULT_SIGNAL_WEIGHTS
): FusionResult {
  if (evidence.length === 0) {
    return { score: 0.5, confidenceLevel: 'low', evidenceCount: 0, evidence: [] };
  }

  let weightedContribution = 0;
  let weightedConfidence = 0;
  let totalPossibleWeight = 0;

  for (const item of evidence) {
    const weight = weights[item.signal] ?? DEFAULT_SIGNAL_WEIGHTS[item.signal] ?? 1;
    const effectiveWeight = weight * item.confidence;

    weightedContribution += item.contribution * effectiveWeight;
    weightedConfidence += effectiveWeight;
    totalPossibleWeight += weight;
  }

  const rawScore = weightedConfidence > 0 ? weightedContribution / weightedConfidence : 0;
  const score = (rawScore + 1) / 2;

  const effectiveConfidence = totalPossibleWeight > 0 ? weightedConfidence / totalPossibleWeight : 0;
  const confidenceLevel: ConfidenceLevel =
    effectiveConfidence >= 0.67 ? 'high' : effectiveConfidence >= 0.34 ? 'medium' : 'low';

  return { score, confidenceLevel, evidenceCount: evidence.length, evidence };
}
