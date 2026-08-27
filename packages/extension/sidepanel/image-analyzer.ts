import { exifSignal, InMemoryCache, mapC2paResultToEvidence, sha256Hex, type Evidence } from '@eas/core';

/**
 * Vive en el side panel, no en el service worker: @contentauth/c2pa-web
 * crea un Web Worker internamente para el trabajo pesado de WASM, y crear
 * Workers está prohibido por especificación dentro de un
 * ServiceWorkerGlobalScope (verificado al intentarlo: "Worker is not
 * defined"). El side panel es una página normal — igual que ya usa su
 * propio Worker pdf.js para leer PDFs en la pestaña "Analizar archivo" —
 * así que aquí sí funciona.
 *
 * exifr y @contentauth/c2pa-web (con su WASM de 8MB) se cargan con
 * import() dinámico, no al abrir el side panel: la mayoría de sesiones
 * analizan solo texto y nunca tocan una imagen.
 */

/**
 * Cache por hash de contenido (no por URL): si la misma imagen aparece en
 * varias páginas, o se reanaliza la misma página, se evita repetir el
 * parseo de EXIF/C2PA — la parte cara de este pipeline. Vive en memoria,
 * por sesión del side panel (se pierde al cerrarlo).
 */
const evidenceByHash = new InMemoryCache<Evidence[]>();
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

export async function analyzeImage(url: string, onEvidence: (sourceId: string, evidence: Evidence[]) => void): Promise<void> {
  if (inFlightUrls.has(url)) return;
  inFlightUrls.add(url);

  try {
    const response = await fetch(url);
    if (!response.ok) return;

    const bytes = await response.arrayBuffer();
    const mimeType = guessMimeType(url, response.headers.get('content-type'));
    const hash = await sha256Hex(bytes);

    const cached = evidenceByHash.get(hash);
    if (cached) {
      onEvidence(url, cached);
      return;
    }

    const { checkC2pa } = await import('./c2pa-client');
    const [exifEvidence, c2paResult] = await Promise.all([
      exifSignal.compute({ bytes, sourceId: url, mimeType }),
      checkC2pa(bytes, mimeType),
    ]);
    const evidence = [exifEvidence, mapC2paResultToEvidence(c2paResult, url)];

    evidenceByHash.set(hash, evidence);
    onEvidence(url, evidence);
  } catch (error) {
    console.error('EAS: fallo analizando imagen', url, error);
  } finally {
    inFlightUrls.delete(url);
  }
}
