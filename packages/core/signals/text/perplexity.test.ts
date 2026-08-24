import { describe, expect, it } from 'vitest';
import { stubPerplexitySignal } from './perplexity';

describe('stubPerplexitySignal', () => {
  it('se marca como no lista', () => {
    expect(stubPerplexitySignal.ready).toBe(false);
  });

  it('devuelve evidencia neutra con confianza cero', async () => {
    const evidence = await stubPerplexitySignal.compute({ text: 'cualquier texto' });
    expect(evidence.signal).toBe('perplexity');
    expect(evidence.confidence).toBe(0);
    expect(evidence.contribution).toBe(0);
  });
});
