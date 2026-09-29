import { defineConfig } from 'vite';

// Relative asset paths so the build works both locally and under a GitHub Pages sub-path.
export default defineConfig({
  base: './',
});
