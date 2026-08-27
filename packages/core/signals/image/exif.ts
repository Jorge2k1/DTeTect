import exifr from 'exifr';
import type { Evidence } from '../types';
import { matchesKnownAiSoftware as matchesKnownAiSoftwarePattern } from './known-ai-tools';
import type { ImageBytes, ImageSignal } from './types';

export interface ExifResult {
  hasExif: boolean;
  hasCameraMake: boolean;
  hasCameraModel: boolean;
  hasGps: boolean;
  hasExposureData: boolean;
  software?: string;
  matchesKnownAiSoftware: boolean;
}

const EMPTY_RESULT: ExifResult = {
  hasExif: false,
  hasCameraMake: false,
  hasCameraModel: false,
  hasGps: false,
  hasExposureData: false,
  matchesKnownAiSoftware: false,
};

/**
 * Parsea EXIF de los bytes de una imagen. exifr funciona igual en Node que
 * en navegador (sin DOM), así que esto es 100% testeable en vitest.
 */
export async function readExif(image: ImageBytes): Promise<ExifResult> {
  const data = await exifr.parse(image.bytes, { gps: true }).catch(() => undefined);
  if (!data) return EMPTY_RESULT;

  const software: string | undefined = typeof data.Software === 'string' ? data.Software : undefined;
  const matchesKnownAiSoftware = matchesKnownAiSoftwarePattern(software);

  return {
    hasExif: true,
    hasCameraMake: typeof data.Make === 'string' && data.Make.trim().length > 0,
    hasCameraModel: typeof data.Model === 'string' && data.Model.trim().length > 0,
    hasGps: typeof data.latitude === 'number' || typeof data.GPSLatitude !== 'undefined',
    hasExposureData:
      typeof data.ExposureTime === 'number' || typeof data.FNumber === 'number' || typeof data.ISO === 'number',
    software,
    matchesKnownAiSoftware,
  };
}

function toEvidence(result: ExifResult, sourceId: string): Evidence {
  if (result.matchesKnownAiSoftware) {
    return {
      signal: 'exif-metadata',
      modality: 'image',
      sourceId,
      value: 1,
      confidence: 0.7,
      contribution: 0.9,
      humanReadable: `Los metadatos EXIF declaran la herramienta "${result.software}", asociada a generación de imagen por IA.`,
    };
  }

  if (result.hasCameraMake && result.hasCameraModel) {
    return {
      signal: 'exif-metadata',
      modality: 'image',
      sourceId,
      value: 1,
      confidence: result.hasExposureData ? 0.7 : 0.55,
      contribution: -0.8,
      humanReadable: 'Los metadatos EXIF son consistentes con una fotografía tomada por una cámara real.',
    };
  }

  if (!result.hasExif) {
    return {
      signal: 'exif-metadata',
      modality: 'image',
      sourceId,
      value: 0,
      confidence: 0.15,
      contribution: 0.15,
      humanReadable:
        'La imagen no tiene metadatos EXIF — puede deberse a generación por IA o simplemente a que se eliminaron al subir o editar el archivo.',
    };
  }

  return {
    signal: 'exif-metadata',
    modality: 'image',
    sourceId,
    value: 0.5,
    confidence: 0.2,
    contribution: 0,
    humanReadable: 'Los metadatos EXIF presentes no son concluyentes.',
  };
}

export const exifSignal: ImageSignal = {
  name: 'exif-metadata',
  async compute(image: ImageBytes): Promise<Evidence> {
    const result = await readExif(image);
    return toEvidence(result, image.sourceId);
  },
};
