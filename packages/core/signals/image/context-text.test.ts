import { describe, expect, it } from 'vitest';
import { analyzeImageContext, imageContextTextSignal } from './context-text';

describe('analyzeImageContext', () => {
  it('detecta una declaración explícita en español', () => {
    expect(analyzeImageContext('Ilustración generada por IA para el artículo').matchesDisclosure).toBe(true);
    expect(analyzeImageContext('Foto de IA usada como ejemplo').matchesDisclosure).toBe(true);
  });

  it('detecta una declaración explícita en inglés', () => {
    expect(analyzeImageContext('This is an AI-generated image').matchesDisclosure).toBe(true);
    expect(analyzeImageContext('Image created with AI').matchesDisclosure).toBe(true);
  });

  it('detecta el nombre de una herramienta de IA conocida aunque no sea una declaración formal', () => {
    const result = analyzeImageContext('Prompt used in Midjourney for this piece');
    expect(result.matchesKnownTool).toBe(true);
  });

  it('no detecta nada en un texto alt normal', () => {
    const result = analyzeImageContext('Foto de la playa al atardecer');
    expect(result.matchesDisclosure).toBe(false);
    expect(result.matchesKnownTool).toBe(false);
  });

  it('maneja undefined sin lanzar excepción', () => {
    const result = analyzeImageContext(undefined);
    expect(result.matchesDisclosure).toBe(false);
    expect(result.text).toBe('');
  });
});

describe('imageContextTextSignal', () => {
  it('genera contribution fuertemente positiva con una declaración explícita', async () => {
    const evidence = await imageContextTextSignal.compute({
      bytes: new ArrayBuffer(0),
      sourceId: 'img-1',
      context: 'Imagen generada por IA',
    });
    expect(evidence.signal).toBe('image-context-text');
    expect(evidence.contribution).toBeGreaterThan(0.5);
  });

  it('genera contribution neutra y confianza baja sin contexto', async () => {
    const evidence = await imageContextTextSignal.compute({
      bytes: new ArrayBuffer(0),
      sourceId: 'img-2',
    });
    expect(evidence.contribution).toBe(0);
    expect(evidence.confidence).toBeLessThan(0.3);
  });
});
