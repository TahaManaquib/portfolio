/**
 * Generates the social preview image and the Apple touch icon.
 *
 * Run with `npm run og`. The outputs are committed to `public/`, so this is not
 * part of the build — nothing in the site pipeline depends on it. Re-run it
 * whenever the name, role or pitch in `src/data/site.ts` changes.
 *
 * Font caveat: SVG text is rasterised by sharp's SVG backend using fonts
 * installed on the machine, so the stack below is deliberately made of fonts
 * Windows/macOS actually ship. It is close to Inter but not identical — the
 * site's real font is only available as a woff2 in node_modules, which the
 * rasteriser cannot resolve by family name. Since the PNG is generated once and
 * committed, this only has to be right on the machine that runs it.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { site } from '../src/data/site.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const BG = '#0b0c0e';
const FG = '#e6e7e9';
const MUTED = '#8b8f96';
const ACCENT = '#6ee7a8';
const BORDER = '#1f2226';

const SANS = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "Consolas, 'DejaVu Sans Mono', 'Courier New', monospace";

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap. SVG has no auto-wrapping, so lines are built by hand. */
function wrap(words, maxChars) {
  const lines = [[]];
  let len = 0;
  for (const w of words) {
    if (len > 0 && len + 1 + w.length > maxChars) {
      lines.push([]);
      len = 0;
    }
    lines[lines.length - 1].push(w);
    len += (len > 0 ? 1 : 0) + w.length;
  }
  return lines;
}

/**
 * The pitch, wrapped, with the highlighted terms in accent wherever they land.
 * Colouring by word rather than by slice index means a different pitch or a
 * different wrap point cannot split a word in half.
 */
function pitchLines() {
  const highlights = new Set(site.pitch.highlights);
  const [a, b, c] = site.pitch.highlights;
  const sentence = `${site.pitch.lead} — ${a}, ${b}, and ${c}.`;

  // 52 characters fits the 1008px content column at 36px in this font stack.
  return wrap(sentence.split(' '), 52)
    .map((words, i) => {
      const spans = words
        .map((w) => {
          const bare = w.replace(/[.,]+$/, '');
          const trail = w.slice(bare.length);
          return highlights.has(bare)
            ? `<tspan fill="${ACCENT}">${esc(bare)}</tspan>${esc(trail)}`
            : esc(w);
        })
        .join(' ');
      return `<tspan x="96" dy="${i === 0 ? 0 : 52}">${spans}</tspan>`;
    })
    .join('');
}

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="0.5" y="0.5" width="1199" height="629" fill="none" stroke="${BORDER}"/>

  <text x="96" y="126" font-family="${MONO}" font-size="22" letter-spacing="3.2" fill="${MUTED}">
    ${esc(site.role.toUpperCase())}
  </text>

  <text x="96" y="248" font-family="${SANS}" font-size="86" font-weight="600" fill="${FG}">
    ${esc(site.name)}
  </text>

  <text x="96" y="330" font-family="${SANS}" font-size="36" fill="${FG}">
    ${pitchLines()}
  </text>

  <circle cx="102" cy="500" r="6" fill="${ACCENT}"/>
  <text x="120" y="507" font-family="${MONO}" font-size="21" letter-spacing="2.4" fill="${MUTED}">
    ${esc(site.availability.label.toUpperCase())}
  </text>

  <text x="1104" y="507" text-anchor="end" font-family="${MONO}" font-size="21" fill="${MUTED}">
    ${esc(site.contact.find((c) => c.label === 'github')?.value ?? '')}
  </text>
</svg>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="180" height="180">
  <rect width="32" height="32" fill="${BG}"/>
  <rect x="7" y="9" width="18" height="3.6" fill="${ACCENT}"/>
  <rect x="14.2" y="9" width="3.6" height="14" fill="${ACCENT}"/>
</svg>`;

await mkdir(publicDir, { recursive: true });

await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(join(publicDir, 'og.png'));
await sharp(Buffer.from(icon))
  .resize(180, 180)
  .png({ compressionLevel: 9 })
  .toFile(join(publicDir, 'apple-touch-icon.png'));

// Keep the raw SVG around so the card can be tweaked without re-deriving it.
await writeFile(join(root, 'scripts', 'og.svg'), og, 'utf8');

const meta = await sharp(join(publicDir, 'og.png')).metadata();
console.log(`og.png              ${meta.width}x${meta.height}`);
console.log('apple-touch-icon.png 180x180');
