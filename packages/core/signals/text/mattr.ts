import type { Evidence, SignalInput, TextSignal } from '../types';
import { splitWords } from './tokenize';

const DEFAULT_WINDOW_SIZE = 50;
const NEUTRAL_MATTR = 0.65;

/**
 * A diferencia de burstiness/ngram-repetition, aquí NO se aplica una
 * ganancia: en texto técnico/informativo (humano o IA) la diversidad
 * léxica sube solo por cubrir muchos términos distintos, no por el estilo
 * de quien escribe. Amplificar esta señal amplificaría también sus falsos
 * positivos en ese género. Se compensa dándole menos peso en el Fusion
 * Engine (ver DEFAULT_SIGNAL_WEIGHTS), no más sensibilidad aquí.
 */
const MIN_TOKENS_FOR_CONFIDENCE = 30;
const CONFIDENCE_SATURATION_TOKENS = 150;

export interface MattrResult {
  mattr: number;
  tokenCount: number;
}

/**
 * MATTR (Moving-Average Type-Token Ratio): desliza una ventana de tamaño
 * fijo sobre el texto y promedia la riqueza léxica de cada ventana, evitando
 * el sesgo de la TTR clásica frente a la longitud del texto.
 */
export function computeMattr(text: string, windowSize = DEFAULT_WINDOW_SIZE): MattrResult {
  const words = splitWords(text);
  const tokenCount = words.length;

  if (tokenCount === 0) {
    return { mattr: 0, tokenCount: 0 };
  }

  if (tokenCount <= windowSize) {
    return { mattr: new Set(words).size / tokenCount, tokenCount };
  }

  const ratios: number[] = [];
  for (let i = 0; i + windowSize <= tokenCount; i++) {
    const window = words.slice(i, i + windowSize);
    ratios.push(new Set(window).size / windowSize);
  }

  const mattr = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return { mattr, tokenCount };
}

export const mattrSignal: TextSignal = {
  name: 'lexical-diversity-mattr',
  compute(input: SignalInput): Evidence {
    const { mattr, tokenCount } = computeMattr(input.text);
    const confidence = Math.max(
      0,
      Math.min(
        1,
        (tokenCount - MIN_TOKENS_FOR_CONFIDENCE) / (CONFIDENCE_SATURATION_TOKENS - MIN_TOKENS_FOR_CONFIDENCE)
      )
    );
    const contribution = Math.max(-1, Math.min(1, (NEUTRAL_MATTR - mattr) / NEUTRAL_MATTR));

    return {
      signal: 'lexical-diversity-mattr',
      modality: 'text',
      aspect: mattr < NEUTRAL_MATTR ? 'Vocabulario poco variado' : 'Vocabulario variado',
      value: mattr,
      confidence,
      contribution,
      humanReadable:
        mattr < NEUTRAL_MATTR
          ? 'El vocabulario es poco variado para la longitud del texto, lo que puede indicar generación por IA.'
          : 'El vocabulario es rico y variado, un patrón típico de escritura humana.',
    };
  },
};
