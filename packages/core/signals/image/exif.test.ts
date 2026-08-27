import { describe, expect, it } from 'vitest';
import { exifSignal, readExif } from './exif';

/**
 * exifr solo se puede validar contra bytes de imagen reales — no hay forma
 * de "fingir" un parseo de EXIF. En vez de depender de binarios externos
 * (no descargables desde aquí de forma fiable), se construye un JPEG
 * mínimo con un segmento EXIF/TIFF real y válido byte a byte. Se verificó
 * contra exifr directamente antes de usarlo aquí.
 */
function u16le(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff];
}
function u16be(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}
function u32le(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

interface TagSpec {
  tag: number;
  type: number;
  count: number;
  valueBytes: number[];
}

function asciiTag(tag: number, value: string): TagSpec {
  const bytes = [...Buffer.from(value + '\0', 'ascii')];
  return { tag, type: 2, count: bytes.length, valueBytes: bytes };
}

function buildExifJpeg(tags: TagSpec[]): ArrayBuffer {
  const ifdStart = 8;
  const ifdSize = 2 + tags.length * 12 + 4;
  let externalOffset = ifdStart + ifdSize;

  const ifdBytes: number[] = [...u16le(tags.length)];
  const externalBytes: number[] = [];

  for (const t of tags) {
    ifdBytes.push(...u16le(t.tag), ...u16le(t.type), ...u32le(t.count));
    if (t.valueBytes.length <= 4) {
      const padded = [...t.valueBytes];
      while (padded.length < 4) padded.push(0);
      ifdBytes.push(...padded);
    } else {
      ifdBytes.push(...u32le(externalOffset));
      externalBytes.push(...t.valueBytes);
      externalOffset += t.valueBytes.length;
    }
  }
  ifdBytes.push(...u32le(0));

  const tiffHeader = [0x49, 0x49, 0x2a, 0x00, ...u32le(8)];
  const tiff = [...tiffHeader, ...ifdBytes, ...externalBytes];
  const exifHeader = [...Buffer.from('Exif\0\0', 'ascii')];
  const app1Payload = [...exifHeader, ...tiff];
  const app1Length = app1Payload.length + 2;
  const app1 = [0xff, 0xe1, ...u16be(app1Length), ...app1Payload];

  const jpeg = new Uint8Array([0xff, 0xd8, ...app1, 0xff, 0xd9]);
  return jpeg.buffer;
}

const CAMERA_JPEG = buildExifJpeg([asciiTag(0x010f, 'Canon'), asciiTag(0x0110, 'Canon EOS 5D')]);
const AI_SOFTWARE_JPEG = buildExifJpeg([asciiTag(0x0131, 'Midjourney 6.1')]);
const NO_EXIF_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer;

describe('readExif', () => {
  it('detecta metadatos de cámara real (Make/Model)', async () => {
    const result = await readExif({ bytes: CAMERA_JPEG, sourceId: 'img-1' });
    expect(result.hasExif).toBe(true);
    expect(result.hasCameraMake).toBe(true);
    expect(result.hasCameraModel).toBe(true);
    expect(result.matchesKnownAiSoftware).toBe(false);
  });

  it('detecta un nombre de software de IA conocido', async () => {
    const result = await readExif({ bytes: AI_SOFTWARE_JPEG, sourceId: 'img-2' });
    expect(result.software).toBe('Midjourney 6.1');
    expect(result.matchesKnownAiSoftware).toBe(true);
  });

  it('devuelve hasExif=false cuando no hay segmento EXIF', async () => {
    const result = await readExif({ bytes: NO_EXIF_JPEG, sourceId: 'img-3' });
    expect(result.hasExif).toBe(false);
  });
});

describe('exifSignal', () => {
  it('genera contribution negativa (hacia humano) para EXIF de cámara real', async () => {
    const evidence = await exifSignal.compute({ bytes: CAMERA_JPEG, sourceId: 'img-1' });
    expect(evidence.signal).toBe('exif-metadata');
    expect(evidence.modality).toBe('image');
    expect(evidence.sourceId).toBe('img-1');
    expect(evidence.contribution).toBeLessThan(0);
  });

  it('genera contribution fuertemente positiva (hacia IA) para software de IA conocido', async () => {
    const evidence = await exifSignal.compute({ bytes: AI_SOFTWARE_JPEG, sourceId: 'img-2' });
    expect(evidence.contribution).toBeGreaterThan(0.5);
  });

  it('genera contribution débil y de baja confianza sin EXIF', async () => {
    const evidence = await exifSignal.compute({ bytes: NO_EXIF_JPEG, sourceId: 'img-3' });
    expect(evidence.confidence).toBeLessThan(0.3);
  });
});
