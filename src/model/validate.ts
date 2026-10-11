import type { Diagram, Payload, StepAction } from './diagram';

export interface DiagramIssue {
  code:
    | 'duplicate-id'
    | 'missing-lane'
    | 'missing-node'
    | 'missing-edge'
    | 'missing-group-node'
    | 'cell-collision'
    | 'step-order'
    | 'particle-discontinuity'
    | 'particle-unknown'
    | 'empty';
  message: string;
  where?: string;
}

/** 参照切れ・経路の不連続・セル重複を見つける。描画前に呼ぶ。 */
export function validateDiagram(d: Diagram): DiagramIssue[] {
  const issues: DiagramIssue[] = [];
  const push = (code: DiagramIssue['code'], message: string, where?: string) =>
    issues.push({ code, message, where });

  if (d.nodes.length === 0) push('empty', 'ノードが 1 つもない', d.id);
  if (d.steps.length === 0) push('empty', 'ステップが 1 つもない', d.id);

  const laneIds = new Set<string>();
  for (const l of d.lanes) {
    if (laneIds.has(l.id)) push('duplicate-id', `レーン id が重複: ${l.id}`, l.id);
    laneIds.add(l.id);
  }

  const nodeIds = new Set<string>();
  const cells = new Map<string, string>();
  for (const n of d.nodes) {
    if (nodeIds.has(n.id)) push('duplicate-id', `ノード id が重複: ${n.id}`, n.id);
    nodeIds.add(n.id);
    if (!laneIds.has(n.lane)) push('missing-lane', `ノード ${n.id} のレーン ${n.lane} が無い`, n.id);
    if (n.col != null && !n.at) {
      const key = `${n.lane}/${n.col}/${n.row ?? 0}`;
      const other = cells.get(key);
      if (other) push('cell-collision', `ノード ${n.id} と ${other} が同じセル ${key}`, n.id);
      cells.set(key, n.id);
    }
  }

  const edgeById = new Map<string, { from: string; to: string }>();
  for (const e of d.edges) {
    if (edgeById.has(e.id)) push('duplicate-id', `エッジ id が重複: ${e.id}`, e.id);
    edgeById.set(e.id, { from: e.from, to: e.to });
    if (!nodeIds.has(e.from)) push('missing-node', `エッジ ${e.id} の from ${e.from} が無い`, e.id);
    if (!nodeIds.has(e.to)) push('missing-node', `エッジ ${e.id} の to ${e.to} が無い`, e.id);
  }

  for (const g of d.groups ?? []) {
    for (const id of g.nodes) {
      if (!nodeIds.has(id)) push('missing-group-node', `グループ ${g.id} のノード ${id} が無い`, g.id);
    }
  }

  let prevN = 0;
  for (const s of d.steps) {
    if (s.n !== prevN + 1) push('step-order', `ステップ番号が飛んでいる: ${prevN} の次が ${s.n}`, `step ${s.n}`);
    prevN = s.n;
  }

  checkParticles(d, edgeById, nodeIds, push);
  return issues;
}

export function assertValidDiagram(d: Diagram): void {
  const issues = validateDiagram(d);
  if (issues.length > 0) {
    const lines = issues.map((i) => `  [${i.code}] ${i.message}`);
    throw new Error(`図 ${d.id} の定義に問題がある:\n${lines.join('\n')}`);
  }
}

/** 粒子ごとに「いまどのノードにいるか」を追い、travel の先頭エッジが現在地から出ているかを見る。 */
function checkParticles(
  d: Diagram,
  edgeById: Map<string, { from: string; to: string }>,
  nodeIds: Set<string>,
  push: (code: DiagramIssue['code'], message: string, where?: string) => void,
) {
  const at = new Map<string, string>();
  const where = (n: number) => `step ${n}`;

  const act = (n: number, a: StepAction) => {
    switch (a.type) {
      case 'travel': {
        if (a.edges.length === 0) {
          push('missing-edge', `粒子 ${a.particle} の travel にエッジが無い`, where(n));
          return;
        }
        let cur = at.get(a.particle);
        for (const eid of a.edges) {
          const e = edgeById.get(eid);
          if (!e) {
            push('missing-edge', `粒子 ${a.particle} のエッジ ${eid} が無い`, where(n));
            return;
          }
          if (cur != null && cur !== e.from) {
            push(
              'particle-discontinuity',
              `粒子 ${a.particle} は ${cur} にいるのにエッジ ${eid} は ${e.from} から出ている`,
              where(n),
            );
          }
          cur = e.to;
        }
        at.set(a.particle, cur!);
        return;
      }
      case 'dwell': {
        if (!nodeIds.has(a.node)) push('missing-node', `dwell のノード ${a.node} が無い`, where(n));
        const cur = at.get(a.particle);
        if (cur == null) at.set(a.particle, a.node);
        else if (cur !== a.node) {
          push('particle-discontinuity', `粒子 ${a.particle} は ${cur} にいるのに ${a.node} で dwell`, where(n));
        }
        return;
      }
      case 'split': {
        requireAt(a.particle, a.at);
        at.delete(a.particle);
        for (const x of a.into) at.set(x.particle, a.at);
        return;
      }
      case 'merge': {
        for (const p of a.particles) requireAt(p, a.at);
        for (const p of a.particles) at.delete(p);
        at.set(a.into.particle, a.at);
        return;
      }
      case 'end': {
        if (!at.has(a.particle)) push('particle-unknown', `粒子 ${a.particle} は存在しないのに end`, where(n));
        if (a.mode !== 'stay') at.delete(a.particle);
        return;
      }
      case 'highlight': {
        for (const id of a.nodes ?? []) if (!nodeIds.has(id)) push('missing-node', `highlight のノード ${id} が無い`, where(n));
        for (const id of a.edges ?? []) if (!edgeById.has(id)) push('missing-edge', `highlight のエッジ ${id} が無い`, where(n));
        return;
      }
    }

    function requireAt(p: string, node: string) {
      if (!nodeIds.has(node)) push('missing-node', `ノード ${node} が無い`, where(n));
      const cur = at.get(p);
      if (cur == null) push('particle-unknown', `粒子 ${p} は存在しない`, where(n));
      else if (cur !== node) push('particle-discontinuity', `粒子 ${p} は ${cur} にいるのに ${node} で合流・分岐`, where(n));
    }
  };

  for (const s of d.steps) for (const a of s.actions) act(s.n, a);
}

export function describePayload(p: Payload): string {
  return p.label ?? p.kind;
}
