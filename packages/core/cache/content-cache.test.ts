import { describe, expect, it } from 'vitest';
import { InMemoryCache } from './content-cache';

describe('InMemoryCache', () => {
  it('devuelve undefined y false para claves ausentes', () => {
    const cache = new InMemoryCache<string>();
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.has('missing')).toBe(false);
  });

  it('guarda y recupera valores por clave', () => {
    const cache = new InMemoryCache<{ score: number }>();
    cache.set('abc123', { score: 0.9 });

    expect(cache.has('abc123')).toBe(true);
    expect(cache.get('abc123')).toEqual({ score: 0.9 });
  });
});
