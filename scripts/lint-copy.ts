// 文言と見た目の「生成 AI らしさ」を機械的に見つける。npm run lint:copy。
// 旧コード（削除予定）は対象外にしている。消したら EXCLUDE から外すこと。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const TARGETS = ['src', 'README.md', 'docs', 'index.html'];
const EXCLUDE = [
  'src/components/',
  'src/core/themes.ts',
  'src/core/path.ts',
  'src/core/a11y.ts',
  'src/templates/',
  'src/utils/',
  'src/LegacyApp.tsx',
  'src/App.css',
  'src/index.css',
  'docs/js-particle-engine.md',
  'README.md',
];

interface Rule { name: string; re: RegExp; only?: RegExp; skip?: RegExp }

const RULES: Rule[] = [
  { name: 'em-dash', re: /—/ },
  { name: '中黒で並べる題', re: /\S\s+·\s+\S/ },
  { name: '矢印の文', re: /\S\s*→\s*\S/, only: /\.(md|html)$/ },
  { name: '絵文字', re: /[\u{1F300}-\u{1FAFF}\u{2728}\u{2B50}]/u },
  { name: '禁止語', re: /直感的|シームレス|簡単に|洗練|高品質|次世代|革新的|豊富な|柔軟な|最適化された|強力な/ },
  { name: 'Tailwind の hex', re: /#(6366f1|8b5cf6|ec4899|f59e0b|10b981|06b6d4|818cf8|a78bfa|f472b6|fbbf24|34d399|22d3ee|94a3b8|cbd5e1|475569|64748b|0f172a|f1f5f9|ef4444|14b8a6|f97316)\b/i },
  { name: 'Inter フォント', re: /['"]Inter['"]/ },
  { name: 'fontFamily の直書き', re: /fontFamily=\{?['"`]/, skip: /src\/skins\/text\.tsx$/ },
  { name: '詰めた字送り', re: /letter-spacing:\s*-0\.0/ },
  { name: '放射グラデ背景', re: /radial-gradient/ },
  { name: 'ガラス', re: /backdrop-filter/ },
  { name: 'ぼかし', re: /feGaussianBlur/ },
  { name: 'foreignObject', re: /foreignObject/ },
  { name: 'sparkles', re: /sparkles/ },
  { name: '実時間（描画経路）', re: /Math\.random\(|Date\.now\(|performance\.now\(/, only: /src\/(model|layout|timeline|skins|render)\// },
  { name: '罫線コメント', re: /\/\/\s*[━─]{3,}|\/\*\s*[━─]{3,}/ },
  { name: '英語 UI 文言', re: /Skip to content|Grid Compare|Single View|Pause animations/ },
];

function walk(p: string, out: string[]) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const f of readdirSync(p)) walk(join(p, f), out);
  } else if (/\.(ts|tsx|css|md|html)$/.test(p)) {
    out.push(p);
  }
}

const files: string[] = [];
for (const t of TARGETS) {
  try { walk(join(ROOT, t), files); } catch { /* 無ければ飛ばす */ }
}

let count = 0;
for (const file of files) {
  const rel = relative(ROOT, file);
  if (EXCLUDE.some((e) => rel.startsWith(e))) continue;
  if (rel === 'scripts/lint-copy.ts') continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const r of RULES) {
      if (r.only && !r.only.test(rel)) continue;
      if (r.skip && r.skip.test(rel)) continue;
      if (r.re.test(line)) {
        count++;
        console.log(`${rel}:${i + 1}: [${r.name}] ${line.trim().slice(0, 100)}`);
      }
    }
  });
}

if (count > 0) {
  console.error(`\n${count} 件。上の行を直すこと。`);
  process.exit(1);
}
console.log('lint:copy: 問題なし');
