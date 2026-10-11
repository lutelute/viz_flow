import { describe, it, expect } from 'vitest';
import { content, eightRag, findComposition } from '../content';
import { layers } from '../content/layers';
import { diagramsOf } from '../model/diagram';
import { flat, openablesOf, parseOpen, resolveOpen } from './open-path';
import { buildSearch, readUrl } from './url-state';

describe('ひらく: 道のり', () => {
  const naive = findComposition('naive-rag');

  it('部品をひらき、さらに中の部品をひらける', () => {
    const { levels, path } = resolveOpen(naive, ['embed', 'enc']);
    expect(path).toEqual(['embed', 'enc']);
    expect(levels.map((l) => l.title)).toEqual(['基本の RAG', '埋め込みモデルの中', '自己注意の中']);
    expect(levels[2].from?.label).toBe('Transformer エンコーダ');
  });

  it('たどれない段で止め、たどれた分だけ返す', () => {
    expect(resolveOpen(naive, ['nope', 'enc']).path).toEqual([]);
    expect(resolveOpen(naive, ['user']).path).toEqual([]);
    expect(resolveOpen(naive, ['embed', 'tok']).path).toEqual(['embed']);
  });

  it('一覧ではセルの図をひらき、そこから部品へ進める', () => {
    const { levels, path } = resolveOpen(eightRag, ['hyde-rag', 'enc']);
    expect(path).toEqual(['hyde-rag', 'enc']);
    expect(levels[1].composition.kind).toBe('single');
    expect(levels[2].title).toBe('埋め込みモデルの中');
    expect(openablesOf(eightRag)).toHaveLength(8);
  });

  it('URL の open を読み書きできる。おかしな値は捨てる', () => {
    expect(parseOpen('embed/enc')).toEqual(['embed', 'enc']);
    expect(parseOpen('embed/<x>/enc')).toEqual(['embed', 'enc']);
    const search = buildSearch({ t: 'naive-rag', style: 'sketch', theme: null, step: null, debug: false, open: ['embed', 'enc'] });
    expect(search).toContain('open=embed/enc');
    expect(readUrl(search).open).toEqual(['embed', 'enc']);
  });

  it('手動改行を外すとき、英数字の隣にだけ空白を入れる', () => {
    expect(flat('埋め込み\nモデル')).toBe('埋め込みモデル');
    expect(flat('Transformer\nエンコーダ')).toBe('Transformer エンコーダ');
  });
});

describe('ひらく: 最初の版から詳しい図へ', () => {
  it('最初の版の図は、部品より先に詳しい図をひらける', () => {
    const first = findComposition('first-naive');
    const items = openablesOf(first);
    expect(items[0]).toMatchObject({ segment: 'naive-rag', detail: true });
    expect(items.filter((o) => !o.detail).map((o) => o.segment)).toEqual(['embed', 'vecdb', 'llm']);
  });

  it('詳しい図に入り、そこから部品の中へ進める。パンくずは短い名前', () => {
    const { levels, path } = resolveOpen(findComposition('first-naive'), ['naive-rag', 'embed']);
    expect(path).toEqual(['naive-rag', 'embed']);
    expect(levels.map((l) => l.crumb ?? l.title)).toEqual(['基本の RAG', '詳しい図', '埋め込みモデルの中']);
    expect(levels[1].composition.id).toBe('naive-rag');
  });

  it('最初の版の図は、どれも実在する単体の図を詳しい図に持つ', () => {
    const firsts = content.filter((e) => e.group === '最初の版');
    expect(firsts.length).toBe(10);
    for (const e of firsts) {
      const items = openablesOf(e.composition);
      expect(items.some((o) => o.detail), e.composition.id).toBe(true);
    }
  });
});

describe('ひらく: 中身の図', () => {
  const layerIds = new Set(layers.map((d) => d.id));

  it('opens はすべて実在する中身の図を指す', () => {
    for (const e of content) {
      for (const d of diagramsOf(e.composition)) {
        for (const n of d.nodes) {
          if (n.opens) expect(layerIds.has(n.opens), `${d.id}/${n.id} -> ${n.opens}`).toBe(true);
        }
      }
    }
  });

  it('基本の RAG は、質問と回答以外の部品をすべてひらける', () => {
    const ids = openablesOf(findComposition('naive-rag')).map((o) => o.segment);
    expect(ids).toEqual(['chunker', 'embed', 'vecdb', 'prompt', 'llm']);
  });

  it('中身の図には外の図との境目（port）が入口と出口の両方にあり、出典がある', () => {
    for (const d of layers) {
      const ports = d.nodes.filter((n) => n.kind === 'port');
      const hasIn = ports.some((p) => d.edges.some((e) => e.from === p.id));
      const hasOut = ports.some((p) => d.edges.some((e) => e.to === p.id));
      expect(hasIn && hasOut, d.id).toBe(true);
      expect(d.sources.length, d.id).toBeGreaterThan(0);
    }
  });

  it('一覧や比較の中の 1 枚も、id で単体として引ける', () => {
    const c = findComposition('refrag');
    expect(c.kind).toBe('single');
    expect(c.id).toBe('refrag');
  });
});
