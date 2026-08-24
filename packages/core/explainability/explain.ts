import { DEFAULT_SIGNAL_WEIGHTS } from '../fusion/fusion-engine';
import type { Evidence, SignalName } from '../signals/types';

export interface RankedEvidence extends Evidence {
  rank: number;
  weightedImpact: number;
}

export interface Explanation {
  summary: string;
  ranked: RankedEvidence[];
}

/**
 * Ordena la evidencia por su impacto real en el score (contribution *
 * confidence * peso de señal) y construye un resumen legible con las
 * razones más influyentes, para sostener la explicabilidad frente al
 * Artículo 50 del EU AI Act.
 */
export function explain(
  evidence: Evidence[],
  weights: Partial<Record<SignalName, number>> = DEFAULT_SIGNAL_WEIGHTS,
  topN = 5
): Explanation {
  const ranked = evidence
    .map((item) => {
      const weight = weights[item.signal] ?? DEFAULT_SIGNAL_WEIGHTS[item.signal] ?? 1;
      return { ...item, weightedImpact: item.contribution * item.confidence * weight, rank: 0 };
    })
    .sort((a, b) => Math.abs(b.weightedImpact) - Math.abs(a.weightedImpact))
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const summary = ranked
    .slice(0, topN)
    .map((item) => item.humanReadable)
    .join(' ');

  return { summary, ranked };
}
