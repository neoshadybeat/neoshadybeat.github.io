// Generates the derived files of the site from index.html:
//   es/index.html                       static Spanish page (indexable, canonical /es/)
//   cv/Cayetano-Soriano-Gallego-CV-*.pdf downloadable CVs from the print stylesheet
// Usage (from the repo root):
//   npm i --no-save playwright-core && node scripts/build.mjs
// Uses the locally installed Google Chrome; set CHROME=/path/to/chrome to override.
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (file.endsWith('/')) file += 'index.html';
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });

// Spanish page: render index.html in Spanish and freeze the result, so crawlers get Spanish HTML at /es/.
{
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await p.goto(`${base}/?lang=es`, { waitUntil: 'load' });
  let html = await p.evaluate(() => {
    const doc = document.documentElement.cloneNode(true);
    doc.removeAttribute('data-theme');
    doc.querySelectorAll('.reveal.visible').forEach(el => el.classList.remove('visible'));
    return '<!DOCTYPE html>\n' + doc.outerHTML;
  });
  const swap = (from, to) => { if (!html.includes(from)) throw new Error('es build: missing ' + from); html = html.replaceAll(from, to); };
  swap('<link rel="canonical" href="https://cayetano.dev/">', '<link rel="canonical" href="https://cayetano.dev/es/">');
  swap('<meta property="og:url" content="https://cayetano.dev/">', '<meta property="og:url" content="https://cayetano.dev/es/">');
  swap('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="es_ES">');
  swap('<meta property="og:locale:alternate" content="es_ES">', '<meta property="og:locale:alternate" content="en_US">');
  const meta = await p.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name="description"]').content }));
  html = html.replace(/(<meta property="og:title" content=")[^"]*/, `$1${meta.title.replace(/"/g, '&quot;')}`)
             .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${meta.title.replace(/"/g, '&quot;')}`)
             .replace(/(<meta property="og:description" content=")[^"]*/, `$1${meta.desc.replace(/"/g, '&quot;')}`)
             .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${meta.desc.replace(/"/g, '&quot;')}`);
  fs.mkdirSync(path.join(root, 'es'), { recursive: true });
  fs.writeFileSync(path.join(root, 'es', 'index.html'), html);
  console.log('wrote es/index.html');
  await p.close();
}

for (const lang of ['en', 'es']) {
  const p = await browser.newPage();
  // Force the language: '/' otherwise follows the browser locale, which made the EN CV come out in Spanish.
  await p.goto(lang === 'es' ? `${base}/es/` : `${base}/?lang=en`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.emulateMedia({ media: 'print' });
  const out = path.join(root, 'cv', `Cayetano-Soriano-Gallego-CV-${lang.toUpperCase()}.pdf`);
  await p.pdf({ path: out, format: 'A4', printBackground: true });
  console.log('wrote', path.relative(root, out));
  await p.close();
}
await browser.close();
server.close();
