import type { AsyncTextSignal, Evidence, SignalInput } from '../types';

/**
 * Interfaz estable para la señal de perplexity. Se intentó un proxy sin
 * modelo pre-entrenado (bigrama de palabras entrenado en el propio
 * documento, evaluado en la mitad restante), pero un documento de unos
 * cientos de palabras no tiene datos suficientes para que un bigrama
 * generalice: en textos realistas (no repetidos literalmente) da lecturas
 * seguras y equivocadas en ambas direcciones. Un proxy fiable necesita
 * conocimiento del lenguaje en general, que solo aporta un modelo
 * pre-entrenado — de ahí que se mantenga como stub hasta la implementación
 * real vía ONNX Runtime Web (tipo distilgpt2), detrás de esta misma
 * interfaz, sin cambiar cómo el resto del sistema la consume.
 */
export interface PerplexitySignal extends AsyncTextSignal {
  name: 'perplexity';
  ready: boolean;
}

export const stubPerplexitySignal: PerplexitySignal = {
  name: 'perplexity',
  ready: false,
  async compute(_input: SignalInput): Promise<Evidence> {
    return {
      signal: 'perplexity',
      modality: 'text',
      aspect: 'Señal no implementada',
      value: 0,
      confidence: 0,
      contribution: 0,
      humanReadable: 'La señal de perplexity aún no está implementada (pendiente de modelo ONNX).',
    };
  },
};
