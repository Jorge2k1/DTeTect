/**
 * Vocabulario IPTC de digitalSourceType
 * (http://cv.iptc.org/newscodes/digitalsourcetype/). Compartido entre
 * c2pa.ts (declaración firmada criptográficamente) y xmp.ts (la misma
 * declaración, pero sin firma) — es el mismo campo del mismo estándar en
 * los dos sitios, así que se clasifica una sola vez.
 *
 * Deliberadamente no se incluyen valores ambiguos como "digitalArt",
 * "digitalCreation", "softwareImage" o "screenCapture" — pueden ser 100%
 * obra humana (arte digital dibujado a mano, capturas de pantalla) y no
 * dicen nada fiable sobre IA vs. humano.
 */
const AI_SOURCE_TYPES = [
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'algorithmicMedia',
  'dataDrivenMedia',
  'compositeSynthetic',
];

const CAMERA_SOURCE_TYPES = [
  'digitalCapture',
  'negativeFilm',
  'positiveFilm',
  'print',
  'computationalCapture',
  'compositeCapture',
];

export type DigitalSourceTypeClassification = 'ai' | 'camera' | 'unknown';

export function classifyDigitalSourceType(digitalSourceType: string | undefined): DigitalSourceTypeClassification {
  if (digitalSourceType === undefined) return 'unknown';
  if (AI_SOURCE_TYPES.some((needle) => digitalSourceType.includes(needle))) return 'ai';
  if (CAMERA_SOURCE_TYPES.some((needle) => digitalSourceType.includes(needle))) return 'camera';
  return 'unknown';
}
