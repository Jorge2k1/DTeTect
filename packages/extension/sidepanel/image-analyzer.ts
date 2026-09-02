import {
  exifSignal,
  imageContextTextSignal,
  imageUrlHeuristicsSignal,
  InMemoryCache,
  mapC2paResultToEvidence,
  sha256Hex,
  xmpSignal,
  type Evidence,
  type ImageBytes,
} from '@eas/core';

/**
 * Vive en el side panel, no en el service worker: @contentauth/c2pa-web
 * crea un Web Worker internamente para el trabajo pesado de WASM, y crear
 * Workers está prohibido por especificación dentro de un
 * ServiceWorkerGlobalScope (verificado al intentarlo: "Worker is not
 * defined"). El side panel es una página normal — igual que ya usa su
 * propio Worker pdf.js para leer PDFs en la pestaña "Analizar archivo" —
 * así que aquí sí funciona.
 *
 * @contentauth/c2pa-web (con su WASM de 8MB) se carga con import()
 * dinámico, no al abrir el side panel: la mayoría de sesiones analizan
 * solo texto y nunca tocan una imagen.
 */

/**
 * Cache por hash de CONTENIDO (los bytes de la imagen), no por URL ni por
 * página: EXIF/XMP/C2PA dependen solo de los bytes del archivo, así que si
 * la misma imagen reaparece se evita repetir el parseo — la parte cara de
 * este pipeline. Deliberadamente NO incluye la evidencia de contexto de
 * página (image-context-text): esa depende de dónde y con qué alt/pie de
 * foto aparece la imagen, que puede ser distinto cada vez aunque los
 * bytes sean idénticos — cachearla por hash de contenido devolvería el
 * contexto de la primera página donde se vio la imagen, no el de la
 * actual. Por eso se recalcula siempre, aparte del resto (es barata: solo
 * comparación de texto, sin fetch ni parseo de formato de archivo).
 */
const cacheableEvidenceByHash = new InMemoryCache<Evidence[]>();
const inFlightUrls = new Set<string>();

function guessMimeType(url: string, headerType: string | null): string {
  if (headerType && headerType.startsWith('image/')) return headerType;
  const ext = (url.split('?')[0] ?? url).split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'avif':
      return 'image/avif';
    default:
      return 'image/jpeg';
  }
}

async function computeCacheableEvidence(image: ImageBytes): Promise<Evidence[]> {
  const { checkC2pa } = await import('./c2pa-client');
  const [exifEvidence, xmpEvidence, c2paResult] = await Promise.all([
    exifSignal.compute(image),
    xmpSignal.compute(image),
    checkC2pa(image.bytes, image.mimeType ?? 'image/jpeg'),
  ]);
  return [exifEvidence, xmpEvidence, mapC2paResultToEvidence(c2paResult, image.sourceId)];
}

/**
 * image-url-heuristics e image-context-text no leen bytes de la imagen en
 * absoluto — solo la URL y el texto de contexto. Antes se calculaban
 * después del fetch() de más abajo, así que si ese fetch fallaba (imagen
 * caída, bloqueada por CORS, dominio con URLs efímeras...) se perdía TODA
 * la evidencia, incluidas estas dos que no tenían por qué depender de eso.
 * Se calculan aparte, siempre, independientemente de si el fetch funciona.
 */
async function computeUrlAndContextEvidence(url: string, context: string | undefined): Promise<Evidence[]> {
  const placeholder: ImageBytes = { bytes: new ArrayBuffer(0), sourceId: url, context };
  return Promise.all([imageUrlHeuristicsSignal.compute(placeholder), imageContextTextSignal.compute(placeholder)]);
}

export async function analyzeImage(
  url: string,
  context: string | undefined,
  onEvidence: (sourceId: string, evidence: Evidence[]) => void
): Promise<void> {
  if (inFlightUrls.has(url)) return;
  inFlightUrls.add(url);

  try {
    const urlAndContextEvidence = await computeUrlAndContextEvidence(url, context);

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      console.error('EAS: fallo al descargar la imagen', url, error);
      onEvidence(url, urlAndContextEvidence);
      return;
    }
    if (!response.ok) {
      onEvidence(url, urlAndContextEvidence);
      return;
    }

    const bytes = await response.arrayBuffer();
    const mimeType = guessMimeType(url, response.headers.get('content-type'));
    const hash = await sha256Hex(bytes);
    const image: ImageBytes = { bytes, sourceId: url, mimeType, context };

    const cached = cacheableEvidenceByHash.get(hash);
    const cacheableEvidence = cached ?? (await computeCacheableEvidence(image));
    if (!cached) cacheableEvidenceByHash.set(hash, cacheableEvidence);

    onEvidence(url, [...cacheableEvidence, ...urlAndContextEvidence]);
  } catch (error) {
    console.error('EAS: fallo analizando imagen', url, error);
  } finally {
    inFlightUrls.delete(url);
  }
}
