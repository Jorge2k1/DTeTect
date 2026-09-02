import type { Evidence, SignalInput, TextSignal } from '../types';
import { splitSentences, splitWords } from './tokenize';

const MIN_SENTENCES_FOR_CONFIDENCE = 5;
const CONFIDENCE_SATURATION_SENTENCES = 20;

/**
 * Pivote calibrado contra texto de referencia (no un valor de libro de
 * texto): un blog personal casual de 2010, claramente humano, midió
 * CV≈0.35; un texto corporativo deliberadamente uniforme midió CV≈0.26; un
 * relato con frases muy variadas midió CV≈0.71. 0.35 separa razonablemente
 * ambos extremos sin forzar el caso ambiguo (blog casual) hacia ningún lado.
 */
const NEUTRAL_BURSTINESS_CV = 0.35;

/**
 * Ganancia aplicada a la desviación normalizada antes de recortar a
 * [-1, 1]. Sin ella, textos con CV moderadamente bajo (p. ej. 0.27, típico
 * de un texto de IA extenso pero no extremadamente uniforme) apenas se
 * separaban del punto neutro. Burstiness acertó la dirección en todos los
 * textos de referencia probados, así que se prioriza frente a MATTR.
 */
const GAIN = 1.8;

export interface BurstinessResult {
  burstiness: number;
  sentenceCount: number;
}

/**
 * Burstiness = coeficiente de variación (σ/μ) de la longitud de las frases
 * en palabras. Cuanto más alto, más varían las frases entre sí (típico de
 * escritura humana); cerca de 0, longitudes muy uniformes (típico de texto
 * generado por IA).
 *
 * No se usa la fórmula clásica (σ-μ)/(σ+μ) de "burstiness" de tiempos entre
 * eventos: para longitudes de frase, la media casi siempre supera a la
 * desviación estándar, así que esa fórmula da valores negativos incluso
 * para texto claramente humano y variado. El CV no tiene ese sesgo
 * estructural.
 */
export function computeBurstiness(text: string): BurstinessResult {
  const lengths = splitSentences(text)
    .map((s) => splitWords(s).length)
    .filter((n) => n > 0);

  if (lengths.length < 2) {
    return { burstiness: 0, sentenceCount: lengths.length };
  }

  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  const burstiness = mean === 0 ? 0 : stdDev / mean;
  return { burstiness, sentenceCount: lengths.length };
}

export const burstinessSignal: TextSignal = {
  name: 'burstiness',
  compute(input: SignalInput): Evidence {
    const { burstiness, sentenceCount } = computeBurstiness(input.text);
    const confidence = Math.max(
      0,
      Math.min(
        1,
        (sentenceCount - MIN_SENTENCES_FOR_CONFIDENCE) /
          (CONFIDENCE_SATURATION_SENTENCES - MIN_SENTENCES_FOR_CONFIDENCE)
      )
    );
    const contribution = Math.max(
      -1,
      Math.min(1, (GAIN * (NEUTRAL_BURSTINESS_CV - burstiness)) / NEUTRAL_BURSTINESS_CV)
    );

    return {
      signal: 'burstiness',
      modality: 'text',
      aspect: burstiness < NEUTRAL_BURSTINESS_CV ? 'Frases de longitud uniforme' : 'Frases de longitud variable',
      value: burstiness,
      confidence,
      contribution,
      humanReadable:
        burstiness < NEUTRAL_BURSTINESS_CV
          ? 'Las frases tienen una longitud muy uniforme, un patrón típico de texto generado por IA.'
          : 'Las frases varían de longitud de forma natural, un patrón típico de escritura humana.',
    };
  },
};
