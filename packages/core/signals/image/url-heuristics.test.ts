import { describe, expect, it } from 'vitest';
import { analyzeImageUrl, imageUrlHeuristicsSignal } from './url-heuristics';

describe('analyzeImageUrl', () => {
  it('detecta un dominio de alojamiento de IA conocido', () => {
    const result = analyzeImageUrl('https://replicate.delivery/pbxt/abc123/output.png');
    expect(result.matchedDomain).toBe('replicate.delivery');
  });

  it('detecta el dominio también en subdominios', () => {
    const result = analyzeImageUrl('https://cdn.leonardo.ai/users/x/generations/y/image.jpg');
    expect(result.matchedDomain).toBe('cdn.leonardo.ai');
  });

  it('detecta un nombre de archivo con patrón de DALL-E sin renombrar', () => {
    const result = analyzeImageUrl('https://example.com/uploads/DALL%C2%B7E%202024-03-01%2012.00.00.png');
    expect(result.matchedFilenamePattern).toBe(true);
  });

  it('no detecta nada en una URL de imagen normal', () => {
    const result = analyzeImageUrl('https://example.com/photos/vacaciones-2023.jpg');
    expect(result.matchedDomain).toBeUndefined();
    expect(result.matchedFilenamePattern).toBe(false);
  });

  it('no lanza excepción con una URL relativa o inválida', () => {
    expect(() => analyzeImageUrl('/images/foo.jpg')).not.toThrow();
  });
});

describe('imageUrlHeuristicsSignal', () => {
  it('genera contribution positiva (hacia IA) cuando el dominio coincide', async () => {
    const evidence = await imageUrlHeuristicsSignal.compute({
      bytes: new ArrayBuffer(0),
      sourceId: 'https://replicate.delivery/pbxt/abc/out.png',
    });
    expect(evidence.signal).toBe('image-url-heuristics');
    expect(evidence.modality).toBe('image');
    expect(evidence.contribution).toBeGreaterThan(0);
  });

  it('genera confianza baja y contribution neutra sin coincidencias', async () => {
    const evidence = await imageUrlHeuristicsSignal.compute({
      bytes: new ArrayBuffer(0),
      sourceId: 'https://example.com/photos/vacaciones.jpg',
    });
    expect(evidence.contribution).toBe(0);
    expect(evidence.confidence).toBeLessThan(0.3);
  });
});
