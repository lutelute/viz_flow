// 全様式 × 全テンプレートの静止画を撮り、1 ページに並べる。npm run shots。
//   npx tsx scripts/shots.ts [--url http://localhost:5173/viz_flow/] [--out shots/current] [--width 540]
// 目視用。差分検査は baseline と pixelmatch で比べる（--compare）。
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : d;
};
const base = opt('--url', 'http://localhost:5173/viz_flow/');
const outDir = opt('--out', 'shots/current');
const width = Number(opt('--width', '540'));
const compare = argv.includes('--compare');
const baselineDir = 'shots/baseline';

interface Cell { template: string; style: string; size: string; file: string; diff?: number }

const page = await (async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  return Object.assign(p, { browser });
})();

await page.goto(`${base}?export=1`, { waitUntil: 'networkidle' });
const catalog = await page.evaluate(() => window.__vizflowCatalog);
const templates = catalog?.templates ?? ['naive-rag'];
const styles = catalog?.styles ?? ['sketch'];
const sizes = ['4x5'];

mkdirSync(outDir, { recursive: true });
const cells: Cell[] = [];
for (const template of templates) {
  for (const style of styles) {
    for (const size of sizes) {
      const url = `${base}?export=1&t=${template}&style=${style}&size=${size}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__vizflow?.isReady === true, null, { timeout: 30000 });
      const file = `${template}_${style}_${size}.png`;
      const full = join(outDir, file);
      await page.screenshot({ path: full, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
      const cell: Cell = { template, style, size, file };
      if (compare && existsSync(join(baselineDir, file))) {
        const a = PNG.sync.read(readFileSync(join(baselineDir, file)));
        const b = PNG.sync.read(readFileSync(full));
        if (a.width === b.width && a.height === b.height) {
          const diff = new PNG({ width: a.width, height: a.height });
          const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
          cell.diff = n / (a.width * a.height);
          mkdirSync('shots/diff', { recursive: true });
          writeFileSync(join('shots/diff', file), PNG.sync.write(diff));
        }
      }
      cells.push(cell);
      console.log(`shot ${file}${cell.diff != null ? `  diff ${(cell.diff * 100).toFixed(2)}%` : ''}`);
    }
  }
}
await page.browser.close();

const html = `<!doctype html><meta charset="utf-8"><title>shots</title>
<style>body{margin:16px;font-family:system-ui;background:#eee}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(${width}px,1fr));gap:16px}
figure{margin:0;background:#fff;padding:8px;border:3px solid transparent}
figure.bad{border-color:#c00}
img{width:100%;display:block}figcaption{font-size:12px;padding:6px 2px}</style>
<div class="grid">${cells
  .map(
    (c) =>
      `<figure class="${c.diff != null && c.diff > 0.01 ? 'bad' : ''}"><img src="${c.file}"><figcaption>${c.template} / ${c.style} / ${c.size}${
        c.diff != null ? ` / 差分 ${(c.diff * 100).toFixed(2)}%` : ''
      }</figcaption></figure>`,
  )
  .join('')}</div>`;
writeFileSync(join(outDir, 'index.html'), html);
console.log(`${cells.length} 枚。${join(outDir, 'index.html')} を開く`);
