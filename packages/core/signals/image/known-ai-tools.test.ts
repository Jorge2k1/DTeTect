import { describe, expect, it } from 'vitest';
import { matchesKnownAiSoftware } from './known-ai-tools';

describe('matchesKnownAiSoftware', () => {
  it('reconoce nombres conocidos, sin distinguir mayúsculas', () => {
    expect(matchesKnownAiSoftware('Midjourney 6.1')).toBe(true);
    expect(matchesKnownAiSoftware('DALL-E 3')).toBe(true);
    expect(matchesKnownAiSoftware('Adobe Firefly 3.2')).toBe(true);
  });

  it('no reconoce herramientas no relacionadas con generación de IA', () => {
    expect(matchesKnownAiSoftware('Adobe Photoshop')).toBe(false);
    expect(matchesKnownAiSoftware('Canon EOS 5D')).toBe(false);
  });

  it('devuelve false para undefined', () => {
    expect(matchesKnownAiSoftware(undefined)).toBe(false);
  });
});
