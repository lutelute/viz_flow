// 1 枚だけ撮る開発用の補助。使い方: npx tsx scripts/shot.ts <url> <out.png> [幅] [高さ]
import { chromium } from 'playwright';

const [url, out, w = '1280', h = '800'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: tsx scripts/shot.ts <url> <out.png> [width] [height]');
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
