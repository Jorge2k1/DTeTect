import { describe, expect, it } from 'vitest';
import { mapC2paResultToEvidence, type C2paCheckResult } from './c2pa';

function result(overrides: Partial<C2paCheckResult>): C2paCheckResult {
  return { manifestFound: false, signatureValid: false, ...overrides };
}

describe('mapC2paResultToEvidence', () => {
  it('sin manifiesto: contribución casi nula y confianza muy baja', () => {
    const evidence = mapC2paResultToEvidence(result({ manifestFound: false }), 'img-1');
    expect(evidence.signal).toBe('c2pa-provenance');
    expect(evidence.modality).toBe('image');
    expect(evidence.sourceId).toBe('img-1');
    expect(Math.abs(evidence.contribution)).toBeLessThan(0.2);
    expect(evidence.confidence).toBeLessThan(0.3);
  });

  it('manifiesto presente pero firma inválida: sospechoso, confianza moderada', () => {
    const evidence = mapC2paResultToEvidence(result({ manifestFound: true, signatureValid: false }), 'img-2');
    expect(evidence.contribution).toBeGreaterThan(0);
    expect(evidence.confidence).toBeLessThan(0.7);
  });

  it('manifiesto válido declarando origen de IA: contribución casi máxima hacia IA', () => {
    const evidence = mapC2paResultToEvidence(
      result({
        manifestFound: true,
        signatureValid: true,
        digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
        claimGenerator: 'Adobe Firefly',
      }),
      'img-3'
    );
    expect(evidence.contribution).toBeGreaterThan(0.9);
    expect(evidence.confidence).toBeGreaterThan(0.9);
    expect(evidence.humanReadable).toContain('Adobe Firefly');
  });

  it('reconoce "algorithmicMedia" como IA, no solo "trainedAlgorithmicMedia" (son valores IPTC distintos)', () => {
    const evidence = mapC2paResultToEvidence(
      result({
        manifestFound: true,
        signatureValid: true,
        digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia',
      }),
      'img-3b'
    );
    expect(evidence.contribution).toBeGreaterThan(0.9);
  });

  it('digitalArt/digitalCreation NO se tratan como IA declarada: caen al caso ambiguo, no al de IA confirmada', () => {
    const evidence = mapC2paResultToEvidence(
      result({
        manifestFound: true,
        signatureValid: true,
        digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalArt',
      }),
      'img-3c'
    );
    expect(evidence.contribution).toBeLessThan(0.5);
  });

  it('manifiesto válido declarando captura por cámara: contribución casi máxima hacia humano', () => {
    const evidence = mapC2paResultToEvidence(
      result({
        manifestFound: true,
        signatureValid: true,
        digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture',
      }),
      'img-4'
    );
    expect(evidence.contribution).toBeLessThan(-0.9);
    expect(evidence.confidence).toBeGreaterThan(0.9);
  });

  it('manifiesto válido sin digitalSourceType concluyente ni generador de IA conocido: leve inclinación hacia humano, no neutro puro', () => {
    const evidence = mapC2paResultToEvidence(
      result({ manifestFound: true, signatureValid: true, claimGenerator: 'Adobe Photoshop' }),
      'img-5'
    );
    // No debe ser un cero plano: la ausencia de digitalSourceType en una
    // herramienta que sí firmó C2PA es un indicio débil de que no es IA.
    expect(evidence.contribution).toBeLessThan(0);
    expect(evidence.contribution).toBeGreaterThan(-0.5);
    expect(evidence.humanReadable).toContain('Adobe Photoshop');
  });

  it('manifiesto válido sin digitalSourceType pero con claimGenerator de herramienta de IA conocida: indicio moderado hacia IA', () => {
    const evidence = mapC2paResultToEvidence(
      result({ manifestFound: true, signatureValid: true, claimGenerator: 'Adobe Firefly 3.2' }),
      'img-6'
    );
    expect(evidence.contribution).toBeGreaterThan(0.3);
    expect(evidence.contribution).toBeLessThan(0.9);
    expect(evidence.humanReadable).toContain('Adobe Firefly 3.2');
  });
});
