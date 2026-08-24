import { describe, expect, it } from 'vitest';
import { burstinessSignal, computeBurstiness } from './burstiness';

const HUMAN_TEXT =
  'Me desperté tarde. El sol ya calentaba fuerte cuando finalmente decidí salir a la ' +
  'calle, todavía medio dormido, preguntándome si había cerrado la puerta con llave. ' +
  'El vecino me saludó. No contesté porque no lo vi hasta que ya había cruzado la ' +
  'esquina, así que seguí caminando sin mirar atrás, algo avergonzado por la torpeza.';

const UNIFORM_TEXT =
  'El sistema procesa los datos correctamente. El sistema genera un informe detallado. ' +
  'El sistema envía el resultado al usuario. El sistema guarda el registro en la base ' +
  'de datos. El sistema notifica al administrador del proceso.';

describe('computeBurstiness', () => {
  it('da más burstiness a un texto con frases de longitud variada', () => {
    const human = computeBurstiness(HUMAN_TEXT);
    const uniform = computeBurstiness(UNIFORM_TEXT);
    expect(human.burstiness).toBeGreaterThan(uniform.burstiness);
  });

  it('devuelve 0 cuando hay menos de dos frases', () => {
    expect(computeBurstiness('Una sola frase.').burstiness).toBe(0);
  });
});

describe('burstinessSignal', () => {
  it('genera contribution positiva (evidencia de IA) para texto uniforme', () => {
    const evidence = burstinessSignal.compute({ text: UNIFORM_TEXT.repeat(3) });
    expect(evidence.contribution).toBeGreaterThan(0);
  });

  it('etiqueta la evidencia con la señal y modalidad correctas', () => {
    const evidence = burstinessSignal.compute({ text: HUMAN_TEXT });
    expect(evidence.signal).toBe('burstiness');
    expect(evidence.modality).toBe('text');
  });
});
