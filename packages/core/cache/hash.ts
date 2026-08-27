/**
 * SHA-256 de unos bytes, en hexadecimal, para usar como clave de cache de
 * contenido (dos imágenes con los mismos bytes comparten resultado, sin
 * importar la URL). Usa la Web Crypto API global (`crypto.subtle`),
 * disponible tanto en el navegador como en Node — sigue siendo testeable
 * en vitest sin necesitar un DOM.
 */
export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer =
    bytes instanceof Uint8Array
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes;

  const digest = await crypto.subtle.digest('SHA-256', buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
