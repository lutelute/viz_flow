import { describe, it, expect } from 'vitest';
import { validateDiagram } from './validate';
import { naiveRag } from '../content/rag/naive';
import type { Diagram } from './diagram';

describe('validateDiagram', () => {
  it('基本の RAG は問題なし', () => {
    expect(validateDiagram(naiveRag)).toEqual([]);
  });

  it('粒子が現在地と違うエッジから出ると不連続を報告する', () => {
    const d: Diagram = {
      ...naiveRag,
      steps: [
        { n: 1, caption: 'a', actions: [{ type: 'travel', particle: 'x', edges: ['e-docs-chunk'], payload: { kind: 'text' } }] },
        { n: 2, caption: 'b', actions: [{ type: 'travel', particle: 'x', edges: ['e-prompt-llm'], payload: { kind: 'text' } }] },
      ],
    };
    const codes = validateDiagram(d).map((i) => i.code);
    expect(codes).toContain('particle-discontinuity');
  });

  it('同じセルに 2 ノードあると衝突を報告する', () => {
    const d: Diagram = {
      ...naiveRag,
      nodes: [...naiveRag.nodes, { id: 'dup', kind: 'generic', label: 'x', lane: 'index', col: 0 }],
    };
    expect(validateDiagram(d).some((i) => i.code === 'cell-collision')).toBe(true);
  });

  it('参照切れを報告する', () => {
    const d: Diagram = { ...naiveRag, edges: [...naiveRag.edges, { id: 'bad', from: 'nope', to: 'docs' }] };
    expect(validateDiagram(d).some((i) => i.code === 'missing-node')).toBe(true);
  });
});
