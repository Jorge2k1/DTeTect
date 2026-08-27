import { describe, expect, it } from 'vitest';
import type { Evidence } from '../signals/types';
import { DEFAULT_SIGNAL_WEIGHTS, fuse } from './fusion-engine';

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

  describe('evidencia dura (C2PA) frente a evidencia blanda', () => {
    it('un C2PA válido domina la dirección aunque haya mucha evidencia blanda en contra', () => {
      const result = fuse([
        makeEvidence({ signal: 'c2pa-provenance', modality: 'image', contribution: 1, confidence: 1 }),
        makeEvidence({ signal: 'burstiness', contribution: -1, confidence: 1 }),
        makeEvidence({ signal: 'lexical-diversity-mattr', contribution: -1, confidence: 1 }),
        makeEvidence({ signal: 'ngram-repetition', contribution: -1, confidence: 1 }),
        makeEvidence({ signal: 'perplexity', contribution: -1, confidence: 1 }),
      ]);
      // Con el promedio plano de antes esto daba ~52% (casi neutro). Con
      // fusión por niveles debe quedar cerca del máximo, solo matizado.
      expect(result.score).toBeGreaterThan(0.85);
    });

    it('sin evidencia dura, el comportamiento es idéntico al promedio ponderado de la Fase 1', () => {
      const evidence = [
        makeEvidence({ signal: 'burstiness', contribution: 0.5, confidence: 0.8 }),
        makeEvidence({ signal: 'lexical-diversity-mattr', contribution: -0.3, confidence: 1 }),
        makeEvidence({ signal: 'ngram-repetition', contribution: 0.2, confidence: 0.6 }),
      ];
      const result = fuse(evidence);

      let weightedContribution = 0;
      let weightedConfidence = 0;
      for (const item of evidence) {
        const w = DEFAULT_SIGNAL_WEIGHTS[item.signal] * item.confidence;
        weightedContribution += item.contribution * w;
        weightedConfidence += w;
      }
      const expectedScore = (weightedContribution / weightedConfidence + 1) / 2;

      expect(result.score).toBeCloseTo(expectedScore, 10);
    });

    it('EXIF por sí solo (sin C2PA) actúa como evidencia blanda, no domina la dirección', () => {
      const result = fuse([
        makeEvidence({ signal: 'exif-metadata', modality: 'image', contribution: 1, confidence: 1 }),
        makeEvidence({ signal: 'burstiness', contribution: -1, confidence: 1 }),
        makeEvidence({ signal: 'lexical-diversity-mattr', contribution: -1, confidence: 1 }),
      ]);
      // EXIF pesa más que una señal de texto sola, pero sigue siendo un
      // voto entre otros: no debe acercarse al máximo como sí hace C2PA.
      expect(result.score).toBeLessThan(0.85);
    });
  });
});
