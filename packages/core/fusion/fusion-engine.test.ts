import { describe, expect, it } from 'vitest';
import type { Evidence } from '../signals/types';
import { fuse } from './fusion-engine';

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

describe('fuse', () => {
  it('devuelve un resultado neutro y de baja confianza sin evidencia', () => {
    const result = fuse([]);
    expect(result.score).toBe(0.5);
    expect(result.confidenceLevel).toBe('low');
  });

  it('inclina el score hacia IA cuando las contribuciones son positivas', () => {
    const result = fuse([
      makeEvidence({ signal: 'burstiness', contribution: 0.8, confidence: 1 }),
      makeEvidence({ signal: 'ngram-repetition', contribution: 0.6, confidence: 1 }),
    ]);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('inclina el score hacia humano cuando las contribuciones son negativas', () => {
    const result = fuse([makeEvidence({ contribution: -0.9, confidence: 1 })]);
    expect(result.score).toBeLessThan(0.5);
  });

  it('da más peso a evidencia de alta confianza que a la de baja confianza', () => {
    const highConfidence = fuse([makeEvidence({ contribution: 1, confidence: 1 })]);
    const lowConfidence = fuse([makeEvidence({ contribution: 1, confidence: 0.1 })]);
    expect(highConfidence.confidenceLevel).toBe('high');
    expect(lowConfidence.confidenceLevel).toBe('low');
  });

  it('no es un promedio simple: una señal con más peso configurado domina', () => {
    const result = fuse(
      [
        makeEvidence({ signal: 'burstiness', contribution: 1, confidence: 1 }),
        makeEvidence({ signal: 'perplexity', contribution: -1, confidence: 1 }),
      ],
      { burstiness: 1, perplexity: 5 }
    );
    expect(result.score).toBeLessThan(0.5);
  });
});
