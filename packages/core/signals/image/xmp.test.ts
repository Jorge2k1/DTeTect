import { describe, expect, it } from 'vitest';
import { readXmp, xmpSignal } from './xmp';

/**
 * Igual que con exif.test.ts: no hay forma de "fingir" un parseo de XMP,
 * así que se construye un JPEG mínimo con un segmento XMP real y válido
 * (paquete RDF/XML), verificado contra exifr directamente antes de
 * usarlo aquí.
 */
function u16be(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

function buildXmpJpeg(rdfPacket: string): ArrayBuffer {
  const xmpHeader = [...Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'ascii')];
  const payload = [...xmpHeader, ...Buffer.from(rdfPacket, 'utf8')];
  const length = payload.length + 2;
  const app1 = [0xff, 0xe1, ...u16be(length), ...payload];
  const jpeg = new Uint8Array([0xff, 0xd8, ...app1, 0xff, 0xd9]);
  return jpeg.buffer;
}

function rdfWithDescription(inner: string): string {
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      ${inner}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

const AI_XMP_JPEG = buildXmpJpeg(
  rdfWithDescription(
    '<Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>'
  )
);
const CAMERA_XMP_JPEG = buildXmpJpeg(
  rdfWithDescription(
    '<Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture</Iptc4xmpExt:DigitalSourceType>'
  )
);
const CREATOR_TOOL_JPEG = buildXmpJpeg(rdfWithDescription('<xmp:CreatorTool>Midjourney 6.1</xmp:CreatorTool>'));
const NO_XMP_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer;

describe('readXmp', () => {
  it('lee digitalSourceType de IA desde XMP', async () => {
    const result = await readXmp({ bytes: AI_XMP_JPEG, sourceId: 'img-1' });
    expect(result.hasXmp).toBe(true);
    expect(result.digitalSourceType).toContain('trainedAlgorithmicMedia');
  });

  it('lee digitalSourceType de cámara desde XMP', async () => {
    const result = await readXmp({ bytes: CAMERA_XMP_JPEG, sourceId: 'img-2' });
    expect(result.digitalSourceType).toContain('digitalCapture');
  });

  it('lee CreatorTool cuando no hay digitalSourceType', async () => {
    const result = await readXmp({ bytes: CREATOR_TOOL_JPEG, sourceId: 'img-3' });
    expect(result.creatorTool).toBe('Midjourney 6.1');
  });

  it('hasXmp=false cuando no hay segmento XMP', async () => {
    const result = await readXmp({ bytes: NO_XMP_JPEG, sourceId: 'img-4' });
    expect(result.hasXmp).toBe(false);
  });
});

describe('xmpSignal', () => {
  it('genera contribution fuerte hacia IA con digitalSourceType de IA', async () => {
    const evidence = await xmpSignal.compute({ bytes: AI_XMP_JPEG, sourceId: 'img-1' });
    expect(evidence.signal).toBe('xmp-metadata');
    expect(evidence.contribution).toBeGreaterThan(0.7);
  });

  it('genera contribution fuerte hacia humano con digitalSourceType de cámara', async () => {
    const evidence = await xmpSignal.compute({ bytes: CAMERA_XMP_JPEG, sourceId: 'img-2' });
    expect(evidence.contribution).toBeLessThan(-0.7);
  });

  it('genera contribution moderada hacia IA por CreatorTool conocido', async () => {
    const evidence = await xmpSignal.compute({ bytes: CREATOR_TOOL_JPEG, sourceId: 'img-3' });
    expect(evidence.contribution).toBeGreaterThan(0.3);
    expect(evidence.contribution).toBeLessThan(0.8);
  });

  it('sin XMP: contribution neutra, no aplica la inclinación leve que sí usa c2pa.ts', async () => {
    const evidence = await xmpSignal.compute({ bytes: NO_XMP_JPEG, sourceId: 'img-4' });
    expect(evidence.contribution).toBe(0);
    expect(evidence.confidence).toBeLessThan(0.3);
  });
});
