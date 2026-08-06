import { defineConfig } from 'vite';

// Served from GitHub Pages as a project site: andrescarballo.github.io/raiz/
// The base path must match the repo name or every asset URL 404s.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/raiz/' : '/',
  build: {
    target: 'es2020',
    // Textures and models are heavy; don't inline them into the JS bundle.
    assetsInlineLimit: 4096
  }
});
