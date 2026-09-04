// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

// Static output only — there is no backend in this project. See CLAUDE.md.
export default defineConfig({
  // TODO: replace with the real domain before launch (needed for correct OG/canonical URLs).
  site: 'https://taha.dev',
  output: 'static',
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});
