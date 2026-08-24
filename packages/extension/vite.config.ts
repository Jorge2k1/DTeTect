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
  },
});
