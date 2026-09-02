import { describe, expect, it } from 'vitest';
import { classifyDigitalSourceType } from './iptc-digital-source-type';

describe('classifyDigitalSourceType', () => {
  it('clasifica trainedAlgorithmicMedia y variantes como IA', () => {
    expect(classifyDigitalSourceType('http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia')).toBe(
      'ai'
    );
    expect(classifyDigitalSourceType('http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia')).toBe('ai');
    expect(classifyDigitalSourceType('.../dataDrivenMedia')).toBe('ai');
  });

  it('clasifica digitalCapture y variantes como cámara', () => {
    expect(classifyDigitalSourceType('http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture')).toBe(
      'camera'
    );
    expect(classifyDigitalSourceType('.../computationalCapture')).toBe('camera');
  });

  it('no clasifica digitalArt/screenCapture como IA ni cámara: son ambiguos', () => {
    expect(classifyDigitalSourceType('.../digitalArt')).toBe('unknown');
    expect(classifyDigitalSourceType('.../screenCapture')).toBe('unknown');
  });

  it('devuelve "unknown" para undefined', () => {
    expect(classifyDigitalSourceType(undefined)).toBe('unknown');
  });
});
