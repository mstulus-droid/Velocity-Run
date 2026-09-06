import { defineConfig } from 'vite';

// The project folder doubles as a plain static site: index.html carries an
// import map that points bare "three" at vendor/three.module.js, so the raw
// source runs on any static host with no build step. Under vite the same
// bare specifier resolves from node_modules instead, and `npm run build`
// produces a bundled, minified dist/.
export default defineConfig({
  server: { port: 8950, strictPort: true },
  preview: { port: 8951, strictPort: true },
  build: { target: 'es2020' },
});
