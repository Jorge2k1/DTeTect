import { describe, expect, it } from 'vitest';
import { computeMattr, mattrSignal } from './mattr';

const RICH_VOCAB_TEXT =
  'La arquitectura modular permite extender el sistema sin reescribir componentes ' +
  'existentes. Cada señal aporta evidencia estadística independiente, mientras que el ' +
  'motor de fusión combina esas pistas heterogéneas en una puntuación explicable, ' +
  'robusta ante modalidades futuras como imágenes o metadatos de procedencia.';

const REPETITIVE_TEXT = 'El texto es bueno. '.repeat(10);

describe('computeMattr', () => {
  it('puntúa más alto un vocabulario rico que uno repetitivo', () => {
    const rich = computeMattr(RICH_VOCAB_TEXT);
    const repetitive = computeMattr(REPETITIVE_TEXT);
    expect(rich.mattr).toBeGreaterThan(repetitive.mattr);
  });

  it('devuelve 0 para texto vacío', () => {
    expect(computeMattr('').mattr).toBe(0);
  });
});

describe('mattrSignal', () => {
  it('genera contribution positiva (evidencia de IA) para vocabulario repetitivo', () => {
    const evidence = mattrSignal.compute({ text: REPETITIVE_TEXT });
    expect(evidence.contribution).toBeGreaterThan(0);
  });
});
