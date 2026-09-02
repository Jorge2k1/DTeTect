import type { Evidence } from '../types';
import { classifyDigitalSourceType } from './iptc-digital-source-type';
import { matchesKnownAiSoftware } from './known-ai-tools';

/**
 * `@contentauth/c2pa-web` no puede ejecutarse en Node/vitest: usa un Web
 * Worker del navegador y necesita fetch() de un binario WASM (verificado
 * al probarlo directamente — falla con "Worker is not defined" y
 * "fetch failed" para file://). La invocación real del SDK vive en
 * packages/extension/background (entorno de navegador real, con Worker y
 * fetch funcionando); aquí solo vive el mapeo — puro, determinista y
 * testeable con fixtures — de un resultado de verificación ya simplificado
 * al Evidence genérico.
 */
export interface C2paCheckResult {
  /** true si se encontró algún manifiesto C2PA en el archivo. */
  manifestFound: boolean;
  /** true si la firma criptográfica del manifiesto activo es válida. */
  signatureValid: boolean;
  /** Herramienta/generador declarado en el manifiesto activo, si lo hay. */
  claimGenerator?: string;
  /**
   * digitalSourceType del manifiesto activo (vocabulario IPTC/C2PA), si lo
   * declara — p. ej. ".../trainedAlgorithmicMedia" para contenido generado
   * por IA, o ".../digitalCapture" para una fotografía tomada por cámara.
   */
  digitalSourceType?: string;
}

/**
 * El valor crudo de digitalSourceType es una URL completa del vocabulario
 * IPTC (p. ej. "http://cv.iptc.org/newscodes/digitalsourcetype/
 * algorithmicMedia") — para mostrarlo como atributo legible en la UI basta
 * el último segmento, que es el término real del vocabulario.
 */
function shortDigitalSourceType(digitalSourceType: string | undefined): string {
  if (!digitalSourceType) return '(ninguno)';
  return digitalSourceType.split('/').pop() || digitalSourceType;
}

function claimGeneratorDetail(claimGenerator: string | undefined): { label: string; value: string } {
  return { label: 'Generador declarado (claimGenerator)', value: claimGenerator ?? '(no especificado)' };
}

export function mapC2paResultToEvidence(result: C2paCheckResult, sourceId: string): Evidence {
  const sourceTypeClass = classifyDigitalSourceType(result.digitalSourceType);
  const base = { signal: 'c2pa-provenance' as const, modality: 'image' as const, sourceId };

  if (!result.manifestFound) {
    return {
      ...base,
      aspect: 'Sin manifiesto C2PA',
      value: 0,
      confidence: 0.1,
      contribution: 0.05,
      humanReadable:
        'La imagen no tiene manifiesto C2PA — no aporta ni descarta nada por sí solo, la mayoría de imágenes hoy no lo tienen.',
      details: [{ label: 'Manifiesto C2PA', value: 'No encontrado en el archivo' }],
    };
  }

  if (!result.signatureValid) {
    return {
      ...base,
      aspect: 'Firma C2PA inválida',
      value: 0,
      confidence: 0.5,
      contribution: 0.3,
      humanReadable:
        'La imagen tiene un manifiesto C2PA pero su firma no es válida — el historial de procedencia no es de fiar.',
      details: [
        { label: 'Manifiesto C2PA', value: 'Encontrado' },
        {
          label: 'Firma criptográfica',
          value: 'No válida — no coincide con el contenido o no la emitió una autoridad de confianza',
        },
      ],
    };
  }

  if (sourceTypeClass === 'ai') {
    return {
      ...base,
      aspect: 'Origen declarado: IA',
      value: 1,
      confidence: 0.98,
      contribution: 0.98,
      humanReadable: `Manifiesto C2PA firmado y válido: declara origen generado por IA${
        result.claimGenerator ? ` (${result.claimGenerator})` : ''
      }.`,
      details: [
        { label: 'Firma criptográfica', value: 'Válida' },
        { label: 'digitalSourceType declarado', value: shortDigitalSourceType(result.digitalSourceType) },
        claimGeneratorDetail(result.claimGenerator),
      ],
    };
  }

  if (sourceTypeClass === 'camera') {
    return {
      ...base,
      aspect: 'Origen declarado: cámara',
      value: 1,
      confidence: 0.98,
      contribution: -0.98,
      humanReadable: 'Manifiesto C2PA firmado y válido: declara origen de captura por cámara real.',
      details: [
        { label: 'Firma criptográfica', value: 'Válida' },
        { label: 'digitalSourceType declarado', value: shortDigitalSourceType(result.digitalSourceType) },
        claimGeneratorDetail(result.claimGenerator),
      ],
    };
  }

  // Válido, pero sin digitalSourceType concluyente: no es un cero neutro.
  // Las herramientas de generación de IA tienen fuerte incentivo a
  // declarar ese campo explícitamente (es su forma de demostrar
  // cumplimiento normativo); si una herramienta firmó C2PA pero no lo
  // declaró, eso ya es un indicio débil de que probablemente no es un
  // generador de IA. Se comprueba también el claimGenerator por si nombra
  // una herramienta de IA conocida sin haber marcado el campo formal.
  if (matchesKnownAiSoftware(result.claimGenerator)) {
    return {
      ...base,
      aspect: 'Herramienta de IA (sin declarar origen)',
      value: 0.7,
      confidence: 0.5,
      contribution: 0.6,
      humanReadable: `Manifiesto C2PA firmado y válido, creado con "${result.claimGenerator}" — herramienta asociada a generación de imagen por IA, aunque el manifiesto no declara el origen de forma explícita.`,
      details: [
        { label: 'Firma criptográfica', value: 'Válida' },
        { label: 'digitalSourceType declarado', value: shortDigitalSourceType(result.digitalSourceType) },
        { label: 'Generador declarado (claimGenerator)', value: `${result.claimGenerator} — coincide con herramienta de IA conocida` },
      ],
    };
  }

  return {
    ...base,
    aspect: 'Sin origen declarado',
    value: 0.4,
    confidence: 0.4,
    contribution: -0.2,
    humanReadable: `Manifiesto C2PA firmado y válido${
      result.claimGenerator ? ` (creado con ${result.claimGenerator})` : ''
    }, pero no declara el origen del contenido de forma concluyente — la ausencia de esa declaración es un indicio débil, no una prueba, de que probablemente no es contenido generado por IA.`,
    details: [
      { label: 'Firma criptográfica', value: 'Válida' },
      { label: 'digitalSourceType declarado', value: shortDigitalSourceType(result.digitalSourceType) },
      claimGeneratorDetail(result.claimGenerator),
    ],
  };
}
