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
 * Señales cuya sola presencia (con confianza suficiente) debe dominar la
 * DIRECCIÓN del resultado, no solo su peso relativo — ver más abajo.
 * Solo C2PA con firma válida entra aquí: EXIF pesa más que el texto
 * (DEFAULT_SIGNAL_WEIGHTS) pero es fácil de falsificar o eliminar, así que
 * actúa como evidencia blanda de mayor peso, no como prueba.
 */
export const HARD_EVIDENCE_SIGNALS: ReadonlySet<SignalName> = new Set(['c2pa-provenance']);

/**
 * Cuánto pesa el bloque de evidencia dura frente al blando cuando ambos
 * coexisten en el mismo fuse() — p. ej. el C2PA y el EXIF de una misma
 * imagen. 0.9 = la evidencia blanda como mucho matiza el margen de
 * confianza, nunca invierte la dirección que marca la dura.
 */
const HARD_EVIDENCE_DOMINANCE = 0.9;

interface WeightedAverage {
  rawScore: number;
  weightedConfidence: number;
  totalPossibleWeight: number;
}

function weightedAverage(evidence: Evidence[], weights: Partial<Record<SignalName, number>>): WeightedAverage {
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
  return { rawScore, weightedConfidence, totalPossibleWeight };
}

/**
 * Combina evidencia heterogénea (texto, imagen, o ambas si el llamador
 * decide fusionarlas juntas) en un único score explicado.
 *
 * No es un promedio ponderado plano entre TODA la evidencia: primero se
 * separa en un bloque duro (HARD_EVIDENCE_SIGNALS) y uno blando, cada uno
 * se promedia por separado, y solo entonces se combinan con
 * HARD_EVIDENCE_DOMINANCE. Así, si hay evidencia dura de confianza alta,
 * ninguna cantidad de evidencia blanda en contra puede invertir la
 * dirección del resultado — solo matizar el margen. Sin evidencia dura,
 * el comportamiento es idéntico al promedio ponderado de siempre (Fase 1).
 */
export function fuse(
  evidence: Evidence[],
  weights: Partial<Record<SignalName, number>> = DEFAULT_SIGNAL_WEIGHTS
): FusionResult {
  if (evidence.length === 0) {
    return { score: 0.5, confidenceLevel: 'low', evidenceCount: 0, evidence: [] };
  }

  const hardEvidence = evidence.filter((item) => HARD_EVIDENCE_SIGNALS.has(item.signal));
  const softEvidence = evidence.filter((item) => !HARD_EVIDENCE_SIGNALS.has(item.signal));

  let rawScore: number;
  if (hardEvidence.length > 0) {
    const hard = weightedAverage(hardEvidence, weights);
    rawScore =
      softEvidence.length > 0
        ? HARD_EVIDENCE_DOMINANCE * hard.rawScore + (1 - HARD_EVIDENCE_DOMINANCE) * weightedAverage(softEvidence, weights).rawScore
        : hard.rawScore;
  } else {
    rawScore = weightedAverage(softEvidence, weights).rawScore;
  }

  const score = (rawScore + 1) / 2;

  const { weightedConfidence, totalPossibleWeight } = weightedAverage(evidence, weights);
  const effectiveConfidence = totalPossibleWeight > 0 ? weightedConfidence / totalPossibleWeight : 0;
  const confidenceLevel: ConfidenceLevel =
    effectiveConfidence >= 0.67 ? 'high' : effectiveConfidence >= 0.34 ? 'medium' : 'low';

  return { score, confidenceLevel, evidenceCount: evidence.length, evidence };
}
