import type { C2paCheckResult } from '@eas/core';
import { createC2pa, type C2paSdk } from '@contentauth/c2pa-web';
import type { Action, Manifest } from '@contentauth/c2pa-types';
import c2paWasmUrl from '@contentauth/c2pa-web/resources/c2pa.wasm?url';

/**
 * Invocación real del SDK de C2PA — solo puede vivir en una página normal
 * de la extensión (side panel), nunca en /core (usa fetch() de un binario
 * WASM y un Web Worker, ninguno disponible en Node/vitest) ni en el
 * service worker (crear un Worker desde dentro de un
 * ServiceWorkerGlobalScope está prohibido por especificación — verificado
 * al intentarlo). El resultado se simplifica a C2paCheckResult y se mapea
 * a Evidence con la función pura de /core/signals/image/c2pa.ts.
 *
 * No se pasa `workerSrc`: la librería exige que sea una URL https (la
 * nuestra es forzosamente chrome-extension://, verificado al intentarlo),
 * y MV3 no permite añadir `blob:` a `worker-src` en el CSP del manifest
 * (verificado al intentarlo: la extensión ni siquiera cargaba). Sin
 * `workerSrc`, la librería crea el worker desde una URL blob: por su
 * cuenta — pendiente de confirmar si el CSP por defecto ('self') lo
 * permite al ser blob: de mismo origen, o si también lo bloquea.
 */
let sdkPromise: Promise<C2paSdk> | undefined;

function getSdk(): Promise<C2paSdk> {
  sdkPromise ??= createC2pa({ wasmSrc: c2paWasmUrl });
  return sdkPromise;
}

function findDigitalSourceType(manifest: Manifest | undefined): string | undefined {
  if (!manifest?.assertions) return undefined;

  for (const assertion of manifest.assertions) {
    if (assertion.label !== 'c2pa.actions' && assertion.label !== 'c2pa.actions.v2') continue;
    const data = assertion.data as { actions?: Action[] } | undefined;
    for (const action of data?.actions ?? []) {
      if (action.digitalSourceType) return action.digitalSourceType;
    }
  }

  return undefined;
}

export async function checkC2pa(bytes: ArrayBuffer, mimeType: string): Promise<C2paCheckResult> {
  try {
    const sdk = await getSdk();
    const blob = new Blob([bytes], { type: mimeType });
    const reader = await sdk.reader.fromBlob(mimeType, blob);
    if (!reader) return { manifestFound: false, signatureValid: false };

    const store = await reader.manifestStore();
    const activeManifest = store.active_manifest ? store.manifests?.[store.active_manifest] : undefined;
    await reader.free();

    return {
      manifestFound: true,
      signatureValid: store.validation_state === 'Valid' || store.validation_state === 'Trusted',
      claimGenerator: activeManifest?.claim_generator ?? undefined,
      digitalSourceType: findDigitalSourceType(activeManifest),
    };
  } catch (error) {
    console.error('EAS: fallo verificando C2PA', error);
    return { manifestFound: false, signatureValid: false };
  }
}
