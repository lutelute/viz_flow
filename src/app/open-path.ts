// 「ひらく」の階層。テンプレートの図から、部品をひらいて一段ずつ下へ入る道のりを扱う。
// 道のりは id の列。一覧と比較ではセルの図の id、単体の図ではノードの id を 1 段ずつ並べる。
// 例: ?t=naive-rag&open=embed/enc なら「基本の RAG」の埋め込みモデルをひらき、その中の Transformer をひらいた所。
// 最初の版の図は、部品のほかに「詳しい図」もひらける。道のりにはその図の id が入る（?t=first-naive&open=naive-rag/embed）。
import type { Composition, Diagram } from '../model/diagram';
import { layerOf } from '../content/layers';
import { detailOf } from '../content';

/** 詳しい図に入った段のパンくず */
export const DETAIL_CRUMB = '詳しい図';

export interface OpenLevel {
  /** その段で見せる構成 */
  composition: Composition;
  /** 段の名前。読み上げと、パンくずの既定 */
  title: string;
  /** パンくずだけ短くしたいとき（詳しい図の段） */
  crumb?: string;
  /** 上の段でひらいた部品（最上段は無し） */
  from?: { segment: string; label: string };
}

export interface Openable {
  /** 道のりに足す id */
  segment: string;
  /** 部品の名前 */
  label: string;
  /** ひらいた先の題名と副題 */
  target: { title: string; subtitle?: string };
  /** 部品ではなく、同じ型の詳しい図。図の中に印は出さない */
  detail?: boolean;
}

/** 「LLM」と「の中」のように英数字と日本語をつなぐときは空白を挟む。 */
export function joinJa(a: string, b: string): string {
  return /[A-Za-z0-9]$/.test(a) ? `${a} ${b}` : `${a}${b}`;
}

export function titleOf(c: Composition): string {
  return c.kind === 'single' ? c.diagram.title : c.title;
}

function single(d: Diagram): Composition {
  return { kind: 'single', id: d.id, diagram: d };
}

/** 手動改行を外す。英数字とつながる所だけ空白を入れる（「Transformer エンコーダ」）。 */
export function flat(label: string): string {
  return label.replace(/(.)\n(.)/g, (_, a: string, b: string) => (/[A-Za-z0-9]/.test(a) || /[A-Za-z0-9]/.test(b) ? `${a} ${b}` : `${a}${b}`));
}

/** いまの段でひらけるもの。単体ならひらける部品、一覧と比較なら各セル。 */
export function openablesOf(c: Composition): Openable[] {
  if (c.kind === 'single') {
    const out: Openable[] = [];
    const more = detailOf(c.diagram);
    if (more) out.push({ segment: more.id, label: DETAIL_CRUMB, target: { title: more.title, subtitle: more.subtitle }, detail: true });
    for (const n of c.diagram.nodes) {
      const layer = layerOf(n);
      if (layer) out.push({ segment: n.id, label: flat(n.label), target: { title: layer.title, subtitle: layer.subtitle } });
    }
    return out;
  }
  const ds = c.kind === 'grid' ? c.cells.map((x) => x.diagram) : c.items.map((x) => x.diagram);
  return ds.map((d) => ({ segment: d.id, label: d.title, target: { title: d.title, subtitle: d.subtitle } }));
}

function step(c: Composition, segment: string): { next: Composition; label: string; crumb?: string } | null {
  if (c.kind === 'single') {
    const more = detailOf(c.diagram);
    if (more && more.id === segment) return { next: single(more), label: DETAIL_CRUMB, crumb: DETAIL_CRUMB };
    const node = c.diagram.nodes.find((n) => n.id === segment);
    const layer = node && layerOf(node);
    return node && layer ? { next: single(layer), label: flat(node.label) } : null;
  }
  const ds = c.kind === 'grid' ? c.cells.map((x) => x.diagram) : c.items.map((x) => x.diagram);
  const d = ds.find((x) => x.id === segment);
  return d ? { next: single(d), label: d.title } : null;
}

/** 道のりをたどる。たどれない所で止め、たどれた分だけを返す。 */
export function resolveOpen(root: Composition, path: readonly string[]): { levels: OpenLevel[]; path: string[] } {
  const levels: OpenLevel[] = [{ composition: root, title: titleOf(root) }];
  const ok: string[] = [];
  for (const seg of path) {
    const cur = levels[levels.length - 1].composition;
    const s = step(cur, seg);
    if (!s) break;
    levels.push({ composition: s.next, title: titleOf(s.next), crumb: s.crumb, from: { segment: seg, label: s.label } });
    ok.push(seg);
  }
  return { levels, path: ok };
}

export function parseOpen(v: string | null): string[] {
  if (!v) return [];
  return v.split('/').filter((x) => /^[\w-]+$/.test(x)).slice(0, 8);
}

export function formatOpen(path: readonly string[]): string {
  return path.join('/');
}
