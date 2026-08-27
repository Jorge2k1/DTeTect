import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './manifest.json';

// crx() lee manifest.json y genera los entry points correctos (service
// worker ES module, side panel, y el wrapper que permite que el content
// script estático importe módulos pese a la limitación de MV3).
export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // El helper __vitePreload de Vite (para import() dinámicos) usa
    // document/window sin comprobar si existen — pensado para páginas web
    // normales, no para un service worker de MV3 (sin document/window).
    // Ahí revienta con "window is not defined" y enmascara el error real
    // que estuviera pasando dentro del import() dinámico. La extensión no
    // necesita esta optimización de precarga, así que se desactiva.
    modulePreload: false,
  },
});
