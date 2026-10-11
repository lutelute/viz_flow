import { memo, type ReactNode } from 'react';
import type { Diagram } from '../model/diagram';
import type { ResolvedLayout, TextMeasurer } from '../layout/types';
import type { CompiledStep, FrameState } from '../timeline/types';
import { makeCtx, type Skin } from '../skins/types';
import { fitTransform } from './fit';

export interface DiagramSvgProps {
  diagram: Diagram;
  layout: ResolvedLayout;
  frame: FrameState;
  steps: CompiledStep[];
  skin: Skin;
  measure: TextMeasurer;
  showTitle?: boolean;
  /** 入れ子で描くときは背景を塗らない */
  showBackground?: boolean;
  showCaption?: boolean;
  showCitation?: boolean;
  /** 箱・ポート・警告を重ね描きする */
  debug?: boolean;
  /** 省略時は viewBox と同じ寸法 */
  width?: number | string;
  height?: number | string;
  className?: string;
}

/**
 * 図を 1 枚の SVG に描く純粋なコンポーネント。
 * 時間の概念は frame（sampleAt の結果）にしか無いので、同じ入力なら同じ出力になる。
 */
export function DiagramSvg(props: DiagramSvgProps): ReactNode {
  const { diagram, layout, frame, steps, skin, measure, debug } = props;
  const ctx = makeCtx(skin, diagram.id, frame.mode, measure);
  const { size } = layout;
  const label = `${diagram.title}の流れ。` + steps.map((s) => `${s.n} ${s.caption}`).join('、');

  return (
    <svg
      viewBox={`0 0 ${size.width} ${size.height}`}
      width={props.width ?? size.width}
      height={props.height ?? size.height}
      role="img"
      aria-label={label}
      className={props.className}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <defs>{skin.Defs(ctx)}</defs>
      {props.showBackground !== false && skin.Background(ctx, size)}
      {props.showTitle !== false && skin.Title(ctx, layout.title, diagram.title, diagram.subtitle)}

      <g data-layer="figure" transform={fitTransform(layout)}>
      <g data-layer="lanes">
        {diagram.lanes.map((lane) => {
          const r = layout.lanes.get(lane.id);
          return r ? <g key={lane.id}>{skin.Lane(ctx, lane, r)}</g> : null;
        })}
      </g>
      <g data-layer="groups">
        {(diagram.groups ?? []).map((g) => {
          const r = layout.groups.get(g.id);
          return r ? <g key={g.id}>{skin.Group(ctx, g, r)}</g> : null;
        })}
      </g>

      <EdgeLayer diagram={diagram} layout={layout} edges={frame.edges} skin={skin} ctxKey={ctxKeyOf(ctx)} ctx={ctx} />
      <NodeLayer diagram={diagram} layout={layout} nodes={frame.nodes} skin={skin} ctxKey={ctxKeyOf(ctx)} ctx={ctx} />

      <g data-layer="badges">
        {steps.map((s) => (
          <g key={s.index}>{skin.Badge(ctx, s.n, s.badge, frame.badges[s.index] ?? 'pending', s.short)}</g>
        ))}
      </g>

      <g data-layer="particles" aria-hidden="true">
        {particlesForDisplay(frame, diagram).map((p) => (
          <g key={`${p.id}:${p.edge ?? p.node ?? ''}`}>{skin.Particle(ctx, p)}</g>
        ))}
      </g>
      </g>

      {props.showCaption && layout.caption && skin.CaptionStrip(ctx, layout.caption, steps, frame.stepIndex)}
      {props.showCitation !== false && skin.Citation(ctx, layout.citation, diagram.sources)}

      {debug && <DebugOverlay layout={layout} />}
    </svg>
  );
}

/** 静止表示では、辺にラベルがあれば粒子のラベルは出さない（同じ語が二重に出るため）。 */
function particlesForDisplay(frame: FrameState, diagram: Diagram): FrameState['particles'] {
  if (frame.mode !== 'static') return frame.particles;
  const labeled = new Set(diagram.edges.filter((e) => e.label).map((e) => e.id));
  return frame.particles.map((p) => (p.edge && labeled.has(p.edge) ? { ...p, payload: { ...p.payload, label: undefined } } : p));
}

function ctxKeyOf(ctx: ReturnType<typeof makeCtx>): string {
  return `${ctx.skin.id}:${ctx.diagramId}:${ctx.mode}`;
}

type LayerProps = {
  diagram: Diagram;
  layout: ResolvedLayout;
  skin: Skin;
  ctxKey: string;
  ctx: ReturnType<typeof makeCtx>;
};

const EdgeLayer = memo(
  function EdgeLayer({ diagram, layout, edges, skin, ctx }: LayerProps & { edges: FrameState['edges'] }) {
    return (
      <g data-layer="edges">
        {diagram.edges.map((e) => {
          const geom = layout.edges.get(e.id);
          return geom ? <g key={e.id}>{skin.Edge(ctx, e, geom, edges[e.id] ?? 'pending')}</g> : null;
        })}
      </g>
    );
  },
  (a, b) => a.diagram === b.diagram && a.layout === b.layout && a.skin === b.skin && a.ctxKey === b.ctxKey && shallowEqualRecord(a.edges, b.edges),
);

const NodeLayer = memo(
  function NodeLayer({ diagram, layout, nodes, skin, ctx }: LayerProps & { nodes: FrameState['nodes'] }) {
    return (
      <g data-layer="nodes">
        {diagram.nodes.map((n) => {
          const box = layout.nodes.get(n.id);
          return box ? <g key={n.id}>{skin.Node(ctx, n, box, nodes[n.id] ?? { phase: 'pending' })}</g> : null;
        })}
      </g>
    );
  },
  (a, b) => a.diagram === b.diagram && a.layout === b.layout && a.skin === b.skin && a.ctxKey === b.ctxKey && nodesEqual(a.nodes, b.nodes),
);

function shallowEqualRecord(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

function nodesEqual(a: FrameState['nodes'], b: FrameState['nodes']): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const x = a[k];
    const y = b[k];
    if (!y) return false;
    if (x.phase !== y.phase) return false;
    if (quant(x.progress) !== quant(y.progress)) return false;
    if (quant(x.pulse) !== quant(y.pulse)) return false;
  }
  return true;
}

function quant(v: number | undefined): number {
  return v == null ? -1 : Math.round(v * 24);
}

function DebugOverlay({ layout }: { layout: ResolvedLayout }): ReactNode {
  const items: ReactNode[] = [];
  for (const [id, b] of layout.nodes) {
    items.push(<rect key={`b-${id}`} x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#e0007f" strokeWidth={1} strokeDasharray="4 3" />);
    for (const [side, p] of Object.entries(b.ports)) {
      items.push(<circle key={`p-${id}-${side}`} cx={p.x} cy={p.y} r={3} fill="#e0007f" />);
    }
  }
  for (const [id, e] of layout.edges) {
    items.push(<polyline key={`e-${id}`} points={e.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#0077e0" strokeWidth={1} />);
    if (e.label) items.push(<rect key={`l-${id}`} x={e.label.box.x} y={e.label.box.y} width={e.label.box.width} height={e.label.box.height} fill="none" stroke="#00a070" strokeWidth={1} />);
    items.push(<circle key={`bd-${id}`} cx={e.badgeAt.x} cy={e.badgeAt.y} r={3} fill="#00a070" />);
  }
  for (const [id, r] of layout.lanes) {
    items.push(<rect key={`ln-${id}`} x={r.x} y={r.y} width={r.width} height={r.height} fill="none" stroke="#999" strokeWidth={1} />);
  }
  items.push(<rect key="fig" x={layout.figure.x} y={layout.figure.y} width={layout.figure.width} height={layout.figure.height} fill="none" stroke="#f0a000" strokeWidth={1} />);
  layout.warnings.forEach((w, i) => {
    items.push(
      <text key={`w-${i}`} x={8} y={layout.size.height - 8 - i * 14} fontSize={12} fill="#c00">
        {w.kind}: {w.ids.join(', ')} {w.message}
      </text>,
    );
  });
  return <g data-layer="debug">{items}</g>;
}
