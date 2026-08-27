/**
 * Nombres de herramientas de generación de imagen por IA conocidas, tal
 * como pueden aparecer en el campo EXIF "Software" o en el
 * claimGenerator de un manifiesto C2PA. Lista deliberadamente pequeña y
 * de confianza moderada, no alta: su ausencia no prueba nada (cualquier
 * herramienta puede omitir el campo, o usar un nombre no listado aquí).
 * Compartida entre exif.ts y c2pa.ts para no duplicarla ni desincronizarla.
 */
export const KNOWN_AI_SOFTWARE_PATTERNS: RegExp[] = [
  /midjourney/i,
  /dall-?e/i,
  /stable diffusion/i,
  /adobe firefly/i,
  /leonardo\.ai/i,
  /nightcafe/i,
  /playground ai/i,
];

export function matchesKnownAiSoftware(name: string | undefined): boolean {
  return name !== undefined && KNOWN_AI_SOFTWARE_PATTERNS.some((pattern) => pattern.test(name));
}
