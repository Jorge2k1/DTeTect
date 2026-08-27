import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash';

describe('sha256Hex', () => {
  it('produce el hash SHA-256 conocido de una cadena vacía', async () => {
    const hash = await sha256Hex(new TextEncoder().encode(''));
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('produce el mismo hash para el mismo contenido', async () => {
    const bytes = new TextEncoder().encode('contenido de prueba');
    expect(await sha256Hex(bytes)).toBe(await sha256Hex(bytes.slice()));
  });

  it('produce hashes distintos para contenido distinto', async () => {
    const a = await sha256Hex(new TextEncoder().encode('a'));
    const b = await sha256Hex(new TextEncoder().encode('b'));
    expect(a).not.toBe(b);
  });
});
