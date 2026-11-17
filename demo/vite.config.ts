import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error plain ESM helper without types
import { homepageDemoPlugin } from './homepage-plugin.mjs';
// @ts-expect-error plain ESM config without types
import { ORIGIN, BADGE } from './demo.config.mjs';

export default defineConfig({
  plugins: [react(), homepageDemoPlugin({ origin: ORIGIN, badge: BADGE })],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'src/main.tsx',
      output: { entryFileNames: 'webchat.js', assetFileNames: 'assets/[name][extname]' },
    },
  },
});
