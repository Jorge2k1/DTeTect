import type { Evidence, SignalInput, TextSignal } from '../types';
import { splitWords } from './tokenize';

const DEFAULT_N = 3;
const MIN_NGRAMS_FOR_CONFIDENCE = 10;
const CONFIDENCE_SATURATION_NGRAMS = 80;
const BASELINE_REPETITION_RATIO = 0.15;

/**
 * Igual que en burstiness.ts: sin ganancia, la repetición exacta de
 * trigramas apenas se activaba en textos largos y temáticamente variados
 * (p. ej. un texto de IA que repite estructura pero cambia las entidades
 * nombradas en cada párrafo), aunque la dirección del signal ya era
 * correcta en todos los textos de referencia probados.
 */
const GAIN = 1.3;

export interface NgramRepetitionResult {
  repetitionRatio: number;
  ngramCount: number;
}

export function computeNgramRepetition(text: string, n = DEFAULT_N): NgramRepetitionResult {
  const words = splitWords(text);
  if (words.length < n) {
    return { repetitionRatio: 0, ngramCount: 0 };
  }

  const ngrams: string[] = [];
  for (let i = 0; i + n <= words.length; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }

  const uniqueCount = new Set(ngrams).size;
  const repetitionRatio = 1 - uniqueCount / ngrams.length;
  return { repetitionRatio, ngramCount: ngrams.length };
}

export const ngramRepetitionSignal: TextSignal = {
  name: 'ngram-repetition',
  compute(input: SignalInput): Evidence {
    const { repetitionRatio, ngramCount } = computeNgramRepetition(input.text);
    const confidence = Math.max(
      0,
      Math.min(
        1,
        (ngramCount - MIN_NGRAMS_FOR_CONFIDENCE) / (CONFIDENCE_SATURATION_NGRAMS - MIN_NGRAMS_FOR_CONFIDENCE)
      )
    );
    const contribution = Math.max(
      -1,
      Math.min(1, (GAIN * (repetitionRatio - BASELINE_REPETITION_RATIO)) / (1 - BASELINE_REPETITION_RATIO))
    );

    return {
      signal: 'ngram-repetition',
      modality: 'text',
      value: repetitionRatio,
      confidence,
      contribution,
      humanReadable:
        repetitionRatio > BASELINE_REPETITION_RATIO
          ? 'Se repiten secuencias de palabras con más frecuencia de lo habitual, un patrón asociado a texto generado por IA.'
          : 'Las secuencias de palabras no se repiten de forma anómala.',
    };
  },
};
