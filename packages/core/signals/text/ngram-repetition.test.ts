import { describe, expect, it } from 'vitest';
import { computeNgramRepetition, ngramRepetitionSignal } from './ngram-repetition';

const VARIED_TEXT =
  'Ayer fuimos al mercado y compramos fruta fresca. Hoy preferimos quedarnos en casa ' +
  'preparando una receta nueva que encontramos en un libro antiguo. Mañana quizás ' +
  'visitemos a los abuelos si el tiempo lo permite.';

const REPETITIVE_TEXT =
  'El informe indica un aumento. El informe indica un aumento. El informe indica un ' +
  'aumento sostenido. El informe indica un aumento constante.';

describe('computeNgramRepetition', () => {
  it('detecta más repetición en texto formulaico', () => {
    const varied = computeNgramRepetition(VARIED_TEXT);
    const repetitive = computeNgramRepetition(REPETITIVE_TEXT);
    expect(repetitive.repetitionRatio).toBeGreaterThan(varied.repetitionRatio);
  });
});

describe('ngramRepetitionSignal', () => {
  it('genera contribution positiva (evidencia de IA) para n-gramas repetidos', () => {
    const evidence = ngramRepetitionSignal.compute({ text: REPETITIVE_TEXT });
    expect(evidence.contribution).toBeGreaterThan(0);
  });
});
