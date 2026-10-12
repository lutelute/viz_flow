import type { Diagram, DiagramEdge, DiagramNode, Side, Via } from '../model/diagram';
import { buildSegments, posAt, type Route } from '../core/particle-math';
import type { Cell, EdgeGeom, EdgeLabelGeom, GridGeom, LayoutStyle, NodeBox, Pt, Rect } from './types';
import { maxLineWidth } from './measure';

/** チャネルを通る座標。実際の値はトラック割付のあとで決まる */
interface ChannelRef {
  ch: string;
  base: number;
  group: string;
}
type Coord = number | ChannelRef;
interface PPt {
  x: Coord;
  y: Coord;
}

interface Plan {
  edge: DiagramEdge;
  fromSide: Side;
  toSide: Side;
  pts: PPt[];
}

const BADGE_GAP = 26;
const LABEL_LINE_HEIGHT = 1.3;
const EPS = 0.5;

function isHorizontal(side: Side): boolean {
  return side === 'left' || side === 'right';
}

/** 相手に向いている辺 */
function facingSide(box: NodeBox, target: Pt): Side {
  const dx = target.x - box.cx;
  const dy = target.y - box.cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

function num(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function cornerRadius(prev: Pt, v: Pt, next: Pt, r: number): number {
  return Math.max(0, Math.min(r, dist(prev, v) / 2, dist(v, next) / 2));
}

function towards(from: Pt, to: Pt, len: number): Pt {
  const d = dist(from, to);
  if (d === 0) return { x: from.x, y: from.y };
  return { x: from.x + ((to.x - from.x) / d) * len, y: from.y + ((to.y - from.y) / d) * len };
}

function quadAt(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/** 連続する重複点と、まっすぐ続く途中の点を除く */
export function simplifyPolyline(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
    out.push({ x: p.x, y: p.y });
  }
  for (let i = 1; i < out.length - 1; ) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    if (Math.abs(cross) < 1e-6 && dot > 0) out.splice(i, 1);
    else i++;
  }
  return out;
}

/** 角を Q で丸めた SVG パス。r は隣接セグメントの半分を上限にする */
export function roundedPathD(points: Pt[], r: number): string {
  if (points.length < 2) return '';
  const parts = [`M ${num(points[0].x)} ${num(points[0].y)}`];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const v = points[i];
    const next = points[i + 1];
    const ri = cornerRadius(prev, v, next, r);
    if (ri < 0.01) {
      parts.push(`L ${num(v.x)} ${num(v.y)}`);
      continue;
    }
    const a = towards(v, prev, ri);
    const b = towards(v, next, ri);
    parts.push(`L ${num(a.x)} ${num(a.y)}`, `Q ${num(v.x)} ${num(v.y)} ${num(b.x)} ${num(b.y)}`);
  }
  const last = points[points.length - 1];
  parts.push(`L ${num(last.x)} ${num(last.y)}`);
  return parts.join(' ');
}

/** 角を 4 点の円弧サンプルに置き換えた折れ線。粒子はこの上を走る */
export function sampleCorners(points: Pt[], r: number): Pt[] {
  if (points.length < 2) return points.map((p) => ({ x: p.x, y: p.y }));
  const out: Pt[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const v = points[i];
    const next = points[i + 1];
    const ri = cornerRadius(prev, v, next, r);
    if (ri < 0.01) {
      out.push({ x: v.x, y: v.y });
      continue;
    }
    const a = towards(v, prev, ri);
    const b = towards(v, next, ri);
    for (const t of [0, 1 / 3, 2 / 3, 1]) out.push(quadAt(a, v, b, t));
  }
  const last = points[points.length - 1];
  out.push({ x: last.x, y: last.y });
  return out;
}

/** 線分が矩形（shrink だけ内側に縮めたもの）に触れるか */
export function segmentHitsRect(p: Pt, q: Pt, r: Rect, shrink: number): boolean {
  const x0 = r.x + shrink;
  const y0 = r.y + shrink;
  const x1 = r.x + r.width - shrink;
  const y1 = r.y + r.height - shrink;
  if (x1 <= x0 || y1 <= y0) return false;
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const clip = (pv: number, qv: number): boolean => {
    if (pv === 0) return qv >= 0;
    const t = qv / pv;
    if (pv < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, p.x - x0) && clip(dx, x1 - p.x) && clip(-dy, p.y - y0) && clip(dy, y1 - p.y);
}

/** 線分がノード箱に触れるか。両端のノードと指定の除外は見ない */
export function segmentHitsNode(p: Pt, q: Pt, nodes: Iterable<NodeBox>, exclude: Set<string>): boolean {
  for (const n of nodes) {
    if (exclude.has(n.id)) continue;
    if (segmentHitsRect(p, q, { x: n.x, y: n.y, width: n.w, height: n.h }, 1)) return true;
  }
  return false;
}

class Router {
  private readonly channels = new Map<string, { base: number; groups: string[] }>();
  private readonly portOrder = new Map<string, Map<string, number>>();
  private readonly tracks = new Map<string, { slots: Map<string, number>; count: number }>();
  private readonly byId = new Map<string, DiagramNode>();
  private readonly diagram: Diagram;
  private readonly nodes: Map<string, NodeBox>;
  private readonly lanes: Map<string, Rect>;
  private readonly style: LayoutStyle;
  private readonly grid: GridGeom;

  constructor(diagram: Diagram, nodes: Map<string, NodeBox>, lanes: Map<string, Rect>, style: LayoutStyle, grid: GridGeom) {
    this.diagram = diagram;
    this.nodes = nodes;
    this.lanes = lanes;
    this.style = style;
    this.grid = grid;
    for (const n of diagram.nodes) this.byId.set(n.id, n);
  }

  private cell(id: string): Cell {
    const c = this.grid.cells.get(id);
    if (c) return c;
    const n = this.byId.get(id);
    return { lane: n?.lane ?? this.grid.laneOrder[0] ?? '', col: n?.col ?? 0, row: n?.row ?? 0 };
  }

  private laneIndex(laneId: string): number {
    const i = this.grid.laneOrder.indexOf(laneId);
    return i < 0 ? 0 : i;
  }

  private ref(ch: string, base: number, group: string): ChannelRef {
    const entry = this.channels.get(ch);
    if (!entry) this.channels.set(ch, { base, groups: [group] });
    else if (!entry.groups.includes(group)) entry.groups.push(group);
    return { ch, base, group };
  }

  /** 列 c と c+1 の間の縦チャネル */
  private colChannel(c: number, group: string): ChannelRef {
    const { originX, colWidth } = this.grid;
    return this.ref(`v:${c}`, originX + colWidth * (c + 1), group);
  }

  private laneTop(laneId: string): { y: number; header: number; rows: number; rect: Rect } {
    const g = this.grid.lanes.get(laneId);
    const rect = this.lanes.get(laneId) ?? g?.rect ?? { x: 0, y: 0, width: 0, height: 0 };
    return { y: rect.y, header: g?.header ?? 0, rows: g?.rows ?? 1, rect };
  }

  /** セルの上側にある横チャネル。最上行ならレーンの上の隙間 */
  private rowChannelAbove(cell: Cell, group: string): ChannelRef {
    const lane = this.laneTop(cell.lane);
    if (cell.row > 0) {
      return this.ref(`h:${cell.lane}:${cell.row}`, lane.y + lane.header + this.grid.rowHeight * cell.row, group);
    }
    return this.ref(`gap:${this.laneIndex(cell.lane)}`, lane.rect.y - this.grid.laneGap / 2, group);
  }

  /** セルの下側にある横チャネル。最下行ならレーンの下の隙間 */
  private rowChannelBelow(cell: Cell, group: string): ChannelRef {
    const lane = this.laneTop(cell.lane);
    if (cell.row < lane.rows - 1) {
      return this.ref(`h:${cell.lane}:${cell.row + 1}`, lane.y + lane.header + this.grid.rowHeight * (cell.row + 1), group);
    }
    return this.ref(`gap:${this.laneIndex(cell.lane) + 1}`, lane.rect.y + lane.rect.height + this.grid.laneGap / 2, group);
  }

  /** レーンの外側（上端の上、または下端の下）を走る横チャネル */
  private laneOuterChannel(laneId: string, side: 'top' | 'bottom', group: string): ChannelRef {
    const lane = this.laneTop(laneId);
    const i = this.laneIndex(laneId);
    if (side === 'top') return this.ref(`gap:${i}`, lane.rect.y - this.grid.laneGap / 2, group);
    return this.ref(`gap:${i + 1}`, lane.rect.y + lane.rect.height + this.grid.laneGap / 2, group);
  }

  private port(box: NodeBox, side: Side): Pt {
    return box.ports[side];
  }

  private clear(p: Pt, q: Pt, ...exclude: string[]): boolean {
    return !segmentHitsNode(p, q, this.nodes.values(), new Set(exclude));
  }

  private viaPoint(v: Via, fromCell: Cell): Pt {
    if ('x' in v) return { x: v.x, y: v.y };
    const laneId = v.lane ?? fromCell.lane;
    const lane = this.laneTop(laneId);
    return {
      x: this.grid.originX + this.grid.colWidth * (v.col + 0.5),
      y: lane.y + lane.header + this.grid.rowHeight * ((v.row ?? 0) + 0.5),
    };
  }

  private planVia(e: DiagramEdge, F: NodeBox, T: NodeBox, via: Via[]): Plan {
    const fc = this.cell(F.id);
    const pts = via.map((v) => this.viaPoint(v, fc));
    const fromSide = e.fromSide ?? facingSide(F, pts[0]);
    const toSide = e.toSide ?? facingSide(T, pts[pts.length - 1]);
    const p0 = this.port(F, fromSide);
    const p1 = this.port(T, toSide);
    const out: PPt[] = [p0];
    let cur: Pt = p0;
    pts.forEach((v, i) => {
      if (i === 0) out.push(isHorizontal(fromSide) ? { x: v.x, y: cur.y } : { x: cur.x, y: v.y });
      else out.push({ x: v.x, y: cur.y });
      out.push(v);
      cur = v;
    });
    out.push(isHorizontal(toSide) ? { x: cur.x, y: p1.y } : { x: p1.x, y: cur.y }, p1);
    return { edge: e, fromSide, toSide, pts: out };
  }

  /** 作者が辺を指定したときの定型。横横は Z、縦縦は逆 Z、横縦と縦横は L */
  private planWithSides(e: DiagramEdge, F: NodeBox, T: NodeBox, fromSide: Side, toSide: Side): Plan {
    const p0 = this.port(F, fromSide);
    const p1 = this.port(T, toSide);
    const fc = this.cell(F.id);
    const tc = this.cell(T.id);
    let pts: PPt[];
    if (isHorizontal(fromSide) && isHorizontal(toSide)) {
      let mx: ChannelRef;
      if (fromSide === toSide) {
        mx = fromSide === 'right'
          ? this.colChannel(Math.max(fc.col, tc.col), e.id)
          : this.colChannel(Math.min(fc.col, tc.col) - 1, e.id);
      } else {
        mx = this.colChannel(fromSide === 'right' ? fc.col : fc.col - 1, `${F.id}|${fromSide}`);
      }
      pts = [p0, { x: mx, y: p0.y }, { x: mx, y: p1.y }, p1];
    } else if (!isHorizontal(fromSide) && !isHorizontal(toSide)) {
      let my: ChannelRef;
      if (fromSide === toSide) {
        const fi = this.laneIndex(fc.lane);
        const ti = this.laneIndex(tc.lane);
        const vertical = fromSide === 'bottom' ? 'bottom' : 'top';
        const outer = vertical === 'bottom' ? (fi >= ti ? fc.lane : tc.lane) : fi <= ti ? fc.lane : tc.lane;
        my = this.laneOuterChannel(outer, vertical, e.id);
      } else {
        my = fromSide === 'bottom' ? this.rowChannelBelow(fc, `${F.id}|${fromSide}`) : this.rowChannelAbove(fc, `${F.id}|${fromSide}`);
      }
      pts = [p0, { x: p0.x, y: my }, { x: p1.x, y: my }, p1];
    } else if (isHorizontal(fromSide)) {
      pts = [p0, { x: p1.x, y: p0.y }, p1];
    } else {
      pts = [p0, { x: p0.x, y: p1.y }, p1];
    }
    return { edge: e, fromSide, toSide, pts };
  }

  /** 横に出て列チャネルを縦に進み、相手に隣る行チャネルを横に進んで上下から入る。ノードを横切らない保険の経路 */
  private planS5(e: DiagramEdge, F: NodeBox, T: NodeBox, enterFrom: 'top' | 'bottom'): Plan {
    const fc = this.cell(F.id);
    const tc = this.cell(T.id);
    const fromSide: Side = T.cx >= F.cx ? 'right' : 'left';
    const p0 = this.port(F, fromSide);
    const p1 = this.port(T, enterFrom);
    const mx = this.colChannel(fromSide === 'right' ? fc.col : fc.col - 1, `${F.id}|${fromSide}`);
    const my = enterFrom === 'top' ? this.rowChannelAbove(tc, `${T.id}|top`) : this.rowChannelBelow(tc, `${T.id}|bottom`);
    return {
      edge: e,
      fromSide,
      toSide: enterFrom,
      pts: [p0, { x: mx, y: p0.y }, { x: mx, y: my }, { x: p1.x, y: my }, p1],
    };
  }

  /** ループと後戻り。レーンの外周（隙間）を使って戻る */
  private planLoop(e: DiagramEdge, F: NodeBox, T: NodeBox): Plan {
    const fc = this.cell(F.id);
    const tc = this.cell(T.id);
    const fi = this.laneIndex(fc.lane);
    const ti = this.laneIndex(tc.lane);
    const tryVertical = (fromSide: 'top' | 'bottom', toSide: 'top' | 'bottom', my: ChannelRef): Plan | null => {
      const p0 = this.port(F, fromSide);
      const p1 = this.port(T, toSide);
      const ok =
        this.clear(p0, { x: p0.x, y: my.base }, F.id) &&
        this.clear({ x: p1.x, y: my.base }, p1, T.id);
      if (!ok) return null;
      return { edge: e, fromSide, toSide, pts: [p0, { x: p0.x, y: my }, { x: p1.x, y: my }, p1] };
    };

    if (fi === ti) {
      const below = tryVertical('bottom', 'bottom', this.laneOuterChannel(fc.lane, 'bottom', e.id));
      if (below) return below;
      const above = tryVertical('top', 'top', this.laneOuterChannel(fc.lane, 'top', e.id));
      if (above) return above;
      return this.planS5(e, F, T, 'bottom');
    }
    if (fi < ti) {
      const down = tryVertical('bottom', 'top', this.rowChannelBelow(fc, e.id));
      if (down) return down;
      return this.planS5(e, F, T, 'top');
    }
    const up = tryVertical('top', 'bottom', this.rowChannelAbove(fc, e.id));
    if (up) return up;
    return this.planS5(e, F, T, 'bottom');
  }

  /** 前向きの辺。同行は直線、同列は縦線、それ以外は列チャネル経由の Z、無理なら S5 */
  private planForward(e: DiagramEdge, F: NodeBox, T: NodeBox, preferFanIn: boolean): Plan {
    const fc = this.cell(F.id);
    const tc = this.cell(T.id);
    if (Math.abs(F.cy - T.cy) < EPS) {
      return { edge: e, fromSide: 'right', toSide: 'left', pts: [this.port(F, 'right'), this.port(T, 'left')] };
    }
    if (Math.abs(F.cx - T.cx) < EPS) {
      const down = F.cy < T.cy;
      return {
        edge: e,
        fromSide: down ? 'bottom' : 'top',
        toSide: down ? 'top' : 'bottom',
        pts: [this.port(F, down ? 'bottom' : 'top'), this.port(T, down ? 'top' : 'bottom')],
      };
    }
    const p0 = this.port(F, 'right');
    const p1 = this.port(T, 'left');
    const xFrom = this.grid.originX + this.grid.colWidth * (fc.col + 1);
    const xTo = this.grid.originX + this.grid.colWidth * tc.col;
    const viaFrom = this.clear({ x: xFrom, y: p1.y }, p1, T.id);
    const viaTo = this.clear(p0, { x: xTo, y: p0.y }, F.id);
    const z = (mx: ChannelRef): Plan => ({ edge: e, fromSide: 'right', toSide: 'left', pts: [p0, { x: mx, y: p0.y }, { x: mx, y: p1.y }, p1] });
    if (preferFanIn && viaTo) return z(this.colChannel(tc.col - 1, `${T.id}|left`));
    if (viaFrom) return z(this.colChannel(fc.col, `${F.id}|right`));
    if (viaTo) return z(this.colChannel(tc.col - 1, `${T.id}|left`));
    return this.planS5(e, F, T, F.cy < T.cy ? 'top' : 'bottom');
  }

  private planEdge(e: DiagramEdge, preferFanIn: boolean): Plan | null {
    const F = this.nodes.get(e.from);
    const T = this.nodes.get(e.to);
    if (!F || !T) return null;
    if (e.via && e.via.length > 0) return this.planVia(e, F, T, e.via);
    if (e.fromSide && e.toSide) return this.planWithSides(e, F, T, e.fromSide, e.toSide);
    if (e.fromSide) return this.planWithSides(e, F, T, e.fromSide, facingSide(T, this.port(F, e.fromSide)));
    if (e.toSide) return this.planWithSides(e, F, T, facingSide(F, this.port(T, e.toSide)), e.toSide);
    const fc = this.cell(F.id);
    const tc = this.cell(T.id);
    if (e.role === 'loop' || tc.col < fc.col) return this.planLoop(e, F, T);
    return this.planForward(e, F, T, preferFanIn);
  }

  private resolveBase(c: Coord): number {
    return typeof c === 'number' ? c : c.base;
  }

  private isRef(c: Coord): c is ChannelRef {
    return typeof c !== 'number';
  }

  /**
   * 端点をポート参照に置き換える。同じ辺に複数の線が付くときは track 刻みで並べる。
   * 幹線を共有する線（隣のチャネルと同じ group）は 1 本として数える。
   * 直線の辺は動かせないので中央に固定したまま、同じ辺の幹線と同じ枠に入れる。
   */
  private attachPorts(plan: Plan): void {
    const F = this.nodes.get(plan.edge.from);
    const T = this.nodes.get(plan.edge.to);
    const n = plan.pts.length;
    if (!F || !T || n < 2) return;
    this.attachPort(plan, F, plan.fromSide, 0, 1, 2);
    this.attachPort(plan, T, plan.toSide, n - 1, n - 2, n - 3);
  }

  private attachPort(plan: Plan, box: NodeBox, side: Side, i0: number, i1: number, i2: number): void {
    const horizontal = isHorizontal(side);
    const key = `port:${box.id}:${side}`;
    const base = horizontal ? box.cy : box.cx;
    const adjacent = plan.pts[i1];
    const along = (p: PPt) => this.resolveBase(horizontal ? p.y : p.x);
    const normal = (p: PPt) => this.resolveBase(horizontal ? p.x : p.y);
    const neighbourRef = horizontal ? adjacent.x : adjacent.y;
    const straight = plan.pts.length === 2;
    const group = straight ? `${box.id}|${side}` : this.isRef(neighbourRef) ? neighbourRef.group : plan.edge.id;

    let order = 0;
    if (plan.pts.length >= 3) {
      const dir = Math.sign(along(plan.pts[i2]) - base);
      const depth = Math.abs(normal(adjacent) - (horizontal ? box.ports[side].x : box.ports[side].y));
      order = dir === 0 ? 0 : dir * (1e6 - depth);
    }
    const keys = this.portOrder.get(key) ?? new Map<string, number>();
    if (!keys.has(group)) keys.set(group, order);
    this.portOrder.set(key, keys);
    const ref = this.ref(key, base, group);

    if (straight) return;
    const port = box.ports[side];
    plan.pts[i0] = horizontal ? { x: port.x, y: ref } : { x: ref, y: port.y };
    if (horizontal && typeof adjacent.y === 'number') plan.pts[i1] = { x: adjacent.x, y: ref };
    if (!horizontal && typeof adjacent.x === 'number') plan.pts[i1] = { x: ref, y: adjacent.y };
  }

  /** ポートに付く線を、進む向きと近いチャネルから順に並べ、互いに交差しないようにする */
  private sortPorts(): void {
    for (const [key, keys] of this.portOrder) {
      const entry = this.channels.get(key);
      if (!entry) continue;
      entry.groups = entry.groups
        .map((g, i) => ({ g, i, k: keys.get(g) ?? 0 }))
        .sort((a, b) => a.k - b.k || a.i - b.i)
        .map((x) => x.g);
    }
  }

  /**
   * チャネルごとにトラックを割り付ける。区間（チャネルに沿った範囲）が重なる group だけ別のトラックにし、
   * 離れている group は同じトラックを共有する。ポートは全 group を並べる。
   */
  private assignTracks(plans: Plan[]): void {
    const spans = new Map<string, Map<string, { min: number; max: number }>>();
    const note = (ref: ChannelRef, a: number, b: number) => {
      const byGroup = spans.get(ref.ch) ?? new Map<string, { min: number; max: number }>();
      const cur = byGroup.get(ref.group);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      byGroup.set(ref.group, cur ? { min: Math.min(cur.min, lo), max: Math.max(cur.max, hi) } : { min: lo, max: hi });
      spans.set(ref.ch, byGroup);
    };
    for (const p of plans) {
      for (let i = 0; i < p.pts.length - 1; i++) {
        const a = p.pts[i];
        const b = p.pts[i + 1];
        if (this.isRef(a.x) && this.isRef(b.x) && a.x.ch === b.x.ch && a.x.group === b.x.group) {
          note(a.x, this.resolveBase(a.y), this.resolveBase(b.y));
        }
        if (this.isRef(a.y) && this.isRef(b.y) && a.y.ch === b.y.ch && a.y.group === b.y.group) {
          note(a.y, this.resolveBase(a.x), this.resolveBase(b.x));
        }
      }
    }
    const margin = this.style.track;
    this.tracks.clear();
    for (const [ch, entry] of this.channels) {
      const slots = new Map<string, number>();
      if (ch.startsWith('port:')) {
        entry.groups.forEach((g, i) => slots.set(g, i));
        this.tracks.set(ch, { slots, count: entry.groups.length });
        continue;
      }
      const byGroup = spans.get(ch);
      const used: Array<{ idx: number; min: number; max: number }> = [];
      let count = 0;
      for (const g of entry.groups) {
        const span = byGroup?.get(g);
        let idx = count;
        if (span) {
          const taken = new Set(
            used.filter((u) => u.max + margin > span.min && span.max + margin > u.min).map((u) => u.idx),
          );
          idx = 0;
          while (taken.has(idx)) idx++;
          used.push({ idx, ...span });
        }
        slots.set(g, idx);
        count = Math.max(count, idx + 1);
      }
      this.tracks.set(ch, { slots, count });
    }
  }

  private resolve(c: Coord): number {
    if (typeof c === 'number') return c;
    const t = this.tracks.get(c.ch);
    const idx = t?.slots.get(c.group);
    if (!t || idx === undefined) return c.base;
    return c.base + (idx - (t.count - 1) / 2) * this.style.track;
  }

  private segmentAt(points: Pt[], at: number): { pt: Pt; d: Pt } {
    const poly = buildSegments(points);
    const pt = posAt(poly, at);
    let seg = poly.segs[poly.segs.length - 1];
    const target = at * poly.totalLen;
    for (const s of poly.segs) {
      if (target <= s.cumLen) {
        seg = s;
        break;
      }
    }
    if (!seg || seg.len === 0) return { pt, d: { x: 1, y: 0 } };
    return { pt, d: { x: (seg.x1 - seg.x0) / seg.len, y: (seg.y1 - seg.y0) / seg.len } };
  }

  /** ラベル候補の悪さ。ノードに重なれば大、他の線に触れれば中、レーンの帯に入れば面積に応じて小 */
  private labelPenalty(box: Rect, selfId: string, others: Array<{ id: string; points: Pt[] }>, lanes = true): number {
    let penalty = 0;
    for (const n of this.nodes.values()) {
      const ox = Math.min(box.x + box.width, n.x + n.w) - Math.max(box.x, n.x);
      const oy = Math.min(box.y + box.height, n.y + n.h) - Math.max(box.y, n.y);
      if (ox > 1 && oy > 1) penalty += 1000;
    }
    for (const o of others) {
      if (o.id === selfId) continue;
      for (let i = 0; i < o.points.length - 1; i++) {
        if (segmentHitsRect(o.points[i], o.points[i + 1], box, 0)) penalty += 100;
      }
    }
    if (!lanes) return penalty;
    for (const lane of this.lanes.values()) {
      const ox = Math.min(box.x + box.width, lane.x + lane.width) - Math.max(box.x, lane.x);
      const oy = Math.min(box.y + box.height, lane.y + lane.height) - Math.max(box.y, lane.y);
      if (ox > 0 && oy > 0) penalty += (ox * oy) / 100;
    }
    return penalty;
  }

  private inLane(p: Pt): boolean {
    for (const lane of this.lanes.values()) {
      if (p.x >= lane.x && p.x <= lane.x + lane.width && p.y >= lane.y && p.y <= lane.y + lane.height) return true;
    }
    return false;
  }

  /**
   * ラベルは labelAt の位置から法線方向に font.edge.size × 0.9 離す。既定は進行方向の左手側。
   * 部品や他の線に掛かるときは反対側を選ぶ。レーンの隙間を走る線では、レーンの帯に掛かる面積も比べる。
   */
  private labelFor(
    e: DiagramEdge,
    points: Pt[],
    others: Array<{ id: string; points: Pt[] }>,
  ): { label?: EdgeLabelGeom; badgeAt: Pt; axis: 'x' | 'y' } {
    const at = e.labelAt ?? (e.role === 'branch' ? 0.35 : 0.5);
    const { pt, d } = this.segmentAt(points, at);
    const axis: 'x' | 'y' = Math.abs(d.x) >= Math.abs(d.y) ? 'x' : 'y';
    let n = { x: d.y, y: -d.x };
    const badge = (nn: Pt): Pt => ({ x: pt.x - nn.x * BADGE_GAP, y: pt.y - nn.y * BADGE_GAP });
    // ラベルが無い辺では画面の上側（縦の線なら左側）に置き、下側は粒子のラベルに空けておく
    if (!e.label) {
      const up = n.y < -0.01 || (Math.abs(n.y) <= 0.01 && n.x < 0) ? n : { x: -n.x, y: -n.y };
      return { badgeAt: { x: pt.x + up.x * BADGE_GAP, y: pt.y + up.y * BADGE_GAP }, axis };
    }

    const font = this.style.font.edge;
    const offset = font.size * 0.9;
    const lines = e.label.split('\n');
    const w = maxLineWidth(lines, this.style.measure, font);
    const h = lines.length * font.size * LABEL_LINE_HEIGHT;
    const place = (nn: Pt): EdgeLabelGeom => {
      const pos = { x: pt.x + nn.x * offset, y: pt.y + nn.y * offset };
      if (axis === 'x') pos.y += nn.y * (h / 2);
      else pos.x += nn.x * (w / 2);
      // pos は縦横どちらの線でも枠の中心なので、字は常に中央揃えにする（start / end だと幅の半分ずれる）
      return { pos, anchor: 'middle', lines, box: { x: pos.x - w / 2, y: pos.y - h / 2, width: w, height: h } };
    };
    let label = place(n);
    // レーンの隙間では帯に掛かる面積も比べる。レーンの中では帯は両側とも同じなので、部品と線だけで比べる
    const lanes = !this.inLane(pt);
    const flipped = { x: -n.x, y: -n.y };
    const alt = place(flipped);
    if (this.labelPenalty(alt.box, e.id, others, lanes) < this.labelPenalty(label.box, e.id, others, lanes)) {
      label = alt;
      n = flipped;
    }
    return { label, badgeAt: badge(n), axis };
  }

  /** 重なるラベルを、乗っているセグメントの向きに沿って押し広げる */
  private pushLabels(items: Array<{ geom: EdgeGeom; axis: 'x' | 'y' }>): void {
    const withLabel = items.filter((it) => it.geom.label);
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (let i = 0; i < withLabel.length; i++) {
        for (let j = i + 1; j < withLabel.length; j++) {
          const a = withLabel[i].geom.label!;
          const b = withLabel[j].geom.label!;
          const ox = Math.min(a.box.x + a.box.width, b.box.x + b.box.width) - Math.max(a.box.x, b.box.x);
          const oy = Math.min(a.box.y + a.box.height, b.box.y + b.box.height) - Math.max(a.box.y, b.box.y);
          if (ox <= 0 || oy <= 0) continue;
          const axis = withLabel[i].axis;
          const shift = (axis === 'x' ? ox : oy) / 2 + 2;
          const sign = (axis === 'x' ? a.box.x <= b.box.x : a.box.y <= b.box.y) ? -1 : 1;
          this.shiftLabel(a, axis, sign * shift);
          this.shiftLabel(b, axis, -sign * shift);
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  private shiftLabel(l: EdgeLabelGeom, axis: 'x' | 'y', by: number): void {
    if (axis === 'x') {
      l.pos.x += by;
      l.box.x += by;
    } else {
      l.pos.y += by;
      l.box.y += by;
    }
  }

  private pointsOf(plan: Plan): Pt[] {
    const raw = plan.pts.map((p) => ({ x: this.resolve(p.x), y: this.resolve(p.y) }));
    const points = simplifyPolyline(raw);
    return points.length < 2 ? [raw[0], raw[raw.length - 1]] : points;
  }

  private materialize(plan: Plan, points: Pt[], others: Array<{ id: string; points: Pt[] }>): { geom: EdgeGeom; axis: 'x' | 'y' } {
    const route: Route = buildSegments(sampleCorners(points, this.style.corner));
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const arrowAngle = (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI;
    const { label, badgeAt, axis } = this.labelFor(plan.edge, points, others);
    return {
      axis,
      geom: {
        id: plan.edge.id,
        points,
        d: roundedPathD(points, this.style.corner),
        route,
        label,
        arrowAt: { x: last.x, y: last.y },
        arrowAngle,
        badgeAt,
      },
    };
  }

  run(): Map<string, EdgeGeom> {
    const first = new Map<string, Plan>();
    for (const e of this.diagram.edges) {
      const p = this.planEdge(e, false);
      if (p) first.set(e.id, p);
    }
    const outCount = new Map<string, number>();
    const inCount = new Map<string, number>();
    for (const p of first.values()) {
      const ok = `${p.edge.from}|${p.fromSide}`;
      const ik = `${p.edge.to}|${p.toSide}`;
      outCount.set(ok, (outCount.get(ok) ?? 0) + 1);
      inCount.set(ik, (inCount.get(ik) ?? 0) + 1);
    }

    this.channels.clear();
    this.portOrder.clear();
    const plans: Plan[] = [];
    for (const e of this.diagram.edges) {
      const f = first.get(e.id);
      if (!f) continue;
      const fanIn = (inCount.get(`${e.to}|${f.toSide}`) ?? 0) >= 2 && (outCount.get(`${e.from}|${f.fromSide}`) ?? 0) <= 1;
      const p = this.planEdge(e, fanIn);
      if (p) plans.push(p);
    }
    for (const p of plans) this.attachPorts(p);
    this.sortPorts();
    this.assignTracks(plans);

    const all = plans.map((p) => ({ id: p.edge.id, points: this.pointsOf(p) }));
    const items = plans.map((p, i) => this.materialize(p, all[i].points, all));
    this.pushLabels(items);
    const out = new Map<string, EdgeGeom>();
    for (const it of items) out.set(it.geom.id, it.geom);
    return out;
  }
}

/**
 * 全エッジを直交配線する。lanes はレーン帯の矩形、grid は列・行・隙間の寸法。
 * 同じ入力からは常に同じ結果を返す。
 */
export function routeEdges(
  diagram: Diagram,
  nodes: Map<string, NodeBox>,
  lanes: Map<string, Rect>,
  style: LayoutStyle,
  grid: GridGeom,
): Map<string, EdgeGeom> {
  return new Router(diagram, nodes, lanes, style, grid).run();
}
