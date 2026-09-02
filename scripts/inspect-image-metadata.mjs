import { readFile } from 'node:fs/promises';
import exifr from 'exifr';

// Mismas dos llamadas que hacen readExif() (packages/core/signals/image/exif.ts)
// y readXmp() (packages/core/signals/image/xmp.ts): exifr necesita {xmp: true}
// explícitamente para leer el bloque XMP, si no lo ignora aunque exista.
const EXIF_OPTIONS = { gps: true };
const XMP_OPTIONS = { xmp: true };

// Campos exactos que revisa cada señal — el resto del objeto que devuelve
// exifr existe, pero la extensión no lo usa para nada.
const EXIF_FIELDS_USED = ['Make', 'Model', 'ExposureTime', 'FNumber', 'ISO', 'Software'];
const XMP_FIELDS_USED = ['DigitalSourceType', 'CreatorTool'];

function printSection(title) {
  console.log(`\n${'='.repeat(title.length)}\n${title}\n${'='.repeat(title.length)}`);
}

function printUsedFields(data, fields) {
  if (!data) {
    console.log('  (sin datos)');
    return;
  }
  for (const field of fields) {
    const value = data[field];
    console.log(`  ${field}: ${value === undefined ? '(no presente)' : value}`);
  }
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Uso: node scripts/inspect-image-metadata.mjs "ruta/a/la/imagen.jpg"');
    process.exit(1);
  }

  const bytes = await readFile(path);

  printSection(`EXIF — campos que usa exif-metadata (${path})`);
  const exifData = await exifr.parse(bytes, EXIF_OPTIONS).catch(() => undefined);
  printUsedFields(exifData, EXIF_FIELDS_USED);

  printSection('XMP — campos que usa xmp-metadata');
  const xmpData = await exifr.parse(bytes, XMP_OPTIONS).catch(() => undefined);
  printUsedFields(xmpData, XMP_FIELDS_USED);

  printSection('EXIF completo (objeto crudo devuelto por exifr)');
  console.log(exifData ?? '(sin datos)');

  printSection('XMP completo (objeto crudo devuelto por exifr)');
  console.log(xmpData ?? '(sin datos)');
}

main();
