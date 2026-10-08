import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The build output (dist/) is the unpacked Chrome extension:
// public/ (manifest.json, background.js, icons) is copied as-is and
// index.html becomes the extension page opened by the toolbar icon.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
    sourcemap: mode === 'development',
    modulePreload: { polyfill: false },
  },
}));
