// Playwright で ?export=1 のページを 1 フレームずつ撮り、ffmpeg で MP4 にする。
//   npm run export -- --template naive-rag --style sketch --size 4x5 --format mp4
//   npm run export -- --template naive-rag --size 4x5,9x16 --format png --step 3
// 既定ではローカルの dev サーバー（5173）か preview（4173）を探し、無ければ preview を起動する。
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';

interface Args {
  template: string;
  style: string;
  sizes: string[];
  fps: number;
  loops: number;
  format: 'mp4' | 'png';
  step?: number;
  at?: number;
  out: string;
  url?: string;
  keepFrames: boolean;
  ffmpeg: string;
  crf: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    template: 'naive-rag',
    style: 'sketch',
    sizes: ['4x5'],
    fps: 30,
    loops: 1,
    format: 'mp4',
    out: 'out',
    keepFrames: false,
    ffmpeg: process.env.FFMPEG ?? 'ffmpeg',
    crf: 17,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--template': a.template = v; i++; break;
      case '--style': a.style = v; i++; break;
      case '--size': a.sizes = v.split(','); i++; break;
      case '--fps': a.fps = Number(v); i++; break;
      case '--loops': a.loops = Number(v); i++; break;
      case '--format': a.format = v as Args['format']; i++; break;
      case '--step': a.step = Number(v); i++; break;
      case '--at': a.at = Number(v); i++; break;
      case '--out': a.out = v; i++; break;
      case '--url': a.url = v; i++; break;
      case '--ffmpeg': a.ffmpeg = v; i++; break;
      case '--crf': a.crf = Number(v); i++; break;
      case '--keep-frames': a.keepFrames = true; break;
      default:
        if (k.startsWith('--')) throw new Error(`知らない引数: ${k}`);
    }
  }
  return a;
}

async function reachable(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'GET' });
    return r.ok || r.status === 302;
  } catch {
    return false;
  }
}

async function findOrStartServer(explicit?: string): Promise<{ base: string; proc?: ChildProcess }> {
  if (explicit) return { base: explicit };
  for (const base of ['http://localhost:5173/viz_flow/', 'http://localhost:4173/viz_flow/']) {
    if (await reachable(base)) return { base };
  }
  const proc = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await reachable('http://localhost:4173/viz_flow/')) return { base: 'http://localhost:4173/viz_flow/', proc };
  }
  proc.kill();
  throw new Error('preview サーバーを起動できなかった。先に npm run build を実行すること');
}

async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__vizflow?.isReady === true, null, { timeout: 30000 });
}

function progress(done: number, total: number, started: number) {
  const pct = Math.round((done / total) * 100);
  const el = (Date.now() - started) / 1000;
  const left = done > 0 ? ((total - done) * el) / done : 0;
  process.stdout.write(`\r  ${String(pct).padStart(3)}%  ${done}/${total}  残り ${left.toFixed(0)} 秒   `);
  if (done === total) process.stdout.write('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { base, proc } = await findOrStartServer(args.url);
  const browser = await chromium.launch();
  mkdirSync(args.out, { recursive: true });
  try {
    for (const size of args.sizes) {
      const url = `${base}?export=1&t=${encodeURIComponent(args.template)}&style=${args.style}&size=${size}`;
      const dims = size === '9x16' ? [1080, 1920] : size === '1x1' ? [1080, 1080] : [1080, 1350];
      const page = await browser.newPage({ viewport: { width: dims[0], height: dims[1] }, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: 'networkidle' });
      await waitReady(page);
      const info = await page.evaluate(() => {
        const v = window.__vizflow!;
        return { duration: v.duration, fps: v.fps, steps: v.steps };
      });
      const name = `${args.template}_${args.style}_${size}`;

      if (args.format === 'png') {
        let t = args.at ?? 0;
        if (args.step != null) {
          const s = info.steps.find((x) => x.n === args.step);
          if (!s) throw new Error(`ステップ ${args.step} が無い`);
          t = Math.max(s.t0, s.t1 - 0.02);
        }
        await page.evaluate((tt) => window.__vizflow!.seek(tt), t);
        await page.waitForTimeout(80);
        const file = join(args.out, `${name}${args.step != null ? `_step${args.step}` : args.at != null ? `_t${args.at}` : ''}.png`);
        await page.screenshot({ path: file, clip: { x: 0, y: 0, width: dims[0], height: dims[1] } });
        console.log(`saved ${file}`);
        await page.close();
        continue;
      }

      const fps = args.fps;
      const n = Math.round(info.duration * fps * args.loops);
      const frames = join(args.out, `frames_${name}`);
      rmSync(frames, { recursive: true, force: true });
      mkdirSync(frames, { recursive: true });
      console.log(`${name}: ${info.duration.toFixed(1)} 秒 × ${args.loops} 周 = ${n} フレーム`);
      const started = Date.now();
      for (let i = 0; i < n; i++) {
        const t = (i / fps) % info.duration;
        await page.evaluate((tt) => window.__vizflow!.seek(tt), t);
        await page.screenshot({ path: join(frames, `${String(i).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: dims[0], height: dims[1] } });
        progress(i + 1, n, started);
      }
      await page.close();

      const mp4 = join(args.out, `${name}.mp4`);
      const r = spawnSync(args.ffmpeg, [
        '-y', '-framerate', String(fps), '-i', join(frames, '%04d.png'),
        '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf), '-profile:v', 'high', '-level', '4.1',
        '-g', String(fps * 2), '-bf', '2', '-pix_fmt', 'yuv420p',
        '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
        '-movflags', '+faststart', mp4,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      if (r.status !== 0) {
        console.error(r.stderr?.toString().split('\n').slice(-12).join('\n'));
        throw new Error('ffmpeg が失敗した');
      }
      if (!args.keepFrames) rmSync(frames, { recursive: true, force: true });
      console.log(`saved ${mp4}`);
    }
  } finally {
    await browser.close();
    proc?.kill();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

