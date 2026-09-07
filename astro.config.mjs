// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

/**
 * The origin canonical links and the OG image URL are built against.
 *
 * Resolved rather than hardcoded, because the site's address changes once and
 * should not need a commit when it does: Vercel first, `tahamanaquib.com`
 * after. In order —
 *
 *  1. `SITE_URL`, for anyone who wants to force it.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets to the project's
 *     *production* domain — the `.vercel.app` one today, and the custom domain
 *     automatically once that is attached in the dashboard. Deliberately not
 *     `VERCEL_URL`, which is the per-deployment URL and would make every
 *     preview build claim a different canonical.
 *  3. The custom domain, for local builds and as the eventual steady state.
 *
 * Only absolute URLs need this — social scrapers do not resolve relative ones —
 * so it affects `<link rel="canonical">` and `og:image`, nothing else.
 */
const site =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://tahamanaquib.com');

// Static output only — there is no backend in this project. See CLAUDE.md.
// No Vercel adapter: that is for SSR, and this build is a directory of files
// Vercel serves as-is. Adding one would pull in a dependency to do nothing.
export default defineConfig({
  site,
  output: 'static',
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});
