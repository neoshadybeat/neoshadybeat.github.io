// Regenerates the downloadable CVs in cv/ from the site's print stylesheet.
// Usage (from the repo root):
//   npm i --no-save playwright-core && node scripts/build-cv.mjs
// Uses the locally installed Google Chrome; set CHROME=/path/to/chrome to override.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const page = pathToFileURL(path.join(root, 'index.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });

for (const lang of ['en', 'es']) {
  const p = await browser.newPage();
  await p.goto(`${page}?lang=${lang}`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.emulateMedia({ media: 'print' });
  const out = path.join(root, 'cv', `Cayetano-Soriano-Gallego-CV-${lang.toUpperCase()}.pdf`);
  await p.pdf({ path: out, format: 'A4', printBackground: true });
  console.log('wrote', path.relative(root, out));
  await p.close();
}
await browser.close();
