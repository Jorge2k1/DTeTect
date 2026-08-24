import { describe, expect, it } from 'vitest';
import type { Evidence } from '../signals/types';
import { explain } from './explain';

function makeEvidence(overrides: Partial<Evidence>): Evidence {
  return {
    signal: 'burstiness',
    modality: 'text',
    value: 0,
    confidence: 1,
    contribution: 0,
    humanReadable: '',
    ...overrides,
  };
}

describe('explain', () => {
  it('ordena la evidencia por impacto ponderado absoluto, descendente', () => {
    const { ranked } = explain([
      makeEvidence({ signal: 'burstiness', contribution: 0.2, confidence: 1, humanReadable: 'weak' }),
      makeEvidence({ signal: 'ngram-repetition', contribution: 0.9, confidence: 1, humanReadable: 'strong' }),
    ]);
    expect(ranked[0].humanReadable).toBe('strong');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it('construye el resumen a partir de la evidencia mejor rankeada', () => {
    const { summary } = explain([
      makeEvidence({ contribution: 0.9, confidence: 1, humanReadable: 'Frase relevante.' }),
    ]);
    expect(summary).toContain('Frase relevante.');
  });

  it('devuelve un resumen vacío cuando no hay evidencia', () => {
    expect(explain([]).summary).toBe('');
  });
});
