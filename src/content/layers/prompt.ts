import type { Diagram } from '../../model/diagram';

// プロンプトテンプレートの中。RAG の LLM は検索結果を「入力の文章」として読むだけ。
// 指示・資料・質問を 1 本にし、長さの上限に合わせて資料を削る。

export const insidePrompt: Diagram = {
  id: 'inside-prompt',
  title: 'プロンプトテンプレートの中',
  subtitle: '指示と資料と質問を、LLM が読む 1 本の文章に組み立てる',
  lanes: [{ id: 'build', label: '組み立てる', tone: 'accent1', frame: 'band' }],
  nodes: [
    { id: 'rule', kind: 'policy', label: '指示文', sublabel: '資料だけを根拠に', lane: 'build', col: 1, row: 0 },
    { id: 'in-c', kind: 'port', label: '上位 K 件', sublabel: '外の図から入る', lane: 'build', col: 0, row: 1, emphasis: 'muted' },
    { id: 'number', kind: 'documents', label: '番号と\n出どころ', sublabel: '[1] [2] と振る', lane: 'build', col: 1, row: 1 },
    { id: 'fill', kind: 'prompt', label: '差し込む', sublabel: '指示、資料、質問の順', lane: 'build', col: 2, row: 1, emphasis: 'new' },
    { id: 'fit', kind: 'policy', label: '長さを\n確かめる', sublabel: '超えたら下位を落とす', lane: 'build', col: 3, row: 1 },
    { id: 'in-q', kind: 'port', label: '質問', sublabel: '外の図から入る', lane: 'build', col: 0, row: 2, emphasis: 'muted' },
    { id: 'out', kind: 'port', label: 'プロンプト', sublabel: '外の図へ出る', lane: 'build', col: 3, row: 2, emphasis: 'muted' },
  ],
  edges: [
    { id: 'e-c-number', from: 'in-c', to: 'number' },
    { id: 'e-number-fill', from: 'number', to: 'fill' },
    { id: 'e-rule-fill', from: 'rule', to: 'fill', fromSide: 'right', toSide: 'top' },
    { id: 'e-q-fill', from: 'in-q', to: 'fill', fromSide: 'right', toSide: 'bottom' },
    { id: 'e-fill-fit', from: 'fill', to: 'fit' },
    { id: 'e-fit-out', from: 'fit', to: 'out', fromSide: 'bottom', toSide: 'top' },
  ],
  steps: [
    {
      n: 1,
      short: '並べる',
      caption: '取り出したチャンクに [1] [2] と番号を振り、出どころを添えて並べる',
      actions: [{ type: 'travel', particle: 'c', edges: ['e-c-number'], payload: { kind: 'chunks', label: '上位 K 件', count: 3 } }],
    },
    {
      n: 2,
      short: '指示',
      caption: '先頭に置く指示文を用意する。「資料だけを根拠に答え、無ければ分からないと書く。引用番号を付ける」など',
      actions: [{ type: 'travel', particle: 'r', edges: ['e-rule-fill'], payload: { kind: 'text', label: '指示文' } }],
    },
    {
      n: 3,
      short: '差し込む',
      caption: '指示、資料、質問の順に差し込み、1 本の文章にする',
      actions: [
        { type: 'travel', particle: 'c', edges: ['e-number-fill'], payload: { kind: 'chunks', label: '資料', count: 3 } },
        { type: 'travel', particle: 'q', edges: ['e-q-fill'], payload: { kind: 'query', label: '質問' } },
        { type: 'merge', particles: ['r', 'c', 'q'], at: 'fill', into: { particle: 'p', payload: { kind: 'prompt', label: 'プロンプト' } } },
      ],
    },
    {
      n: 4,
      short: '長さ',
      caption: 'トークン数を数え、上限を超えるなら順位の低い資料から落とす。長い入力の真ん中にある資料は読み落とされやすい',
      actions: [{ type: 'travel', particle: 'p', edges: ['e-fill-fit'], payload: { kind: 'prompt', label: 'プロンプト' } }],
    },
    {
      n: 5,
      short: '渡す',
      caption: 'できたプロンプトを LLM に渡す。LLM 自体は何も変えず、検索結果を入力の文章として読むだけ',
      actions: [
        { type: 'travel', particle: 'p', edges: ['e-fit-out'], payload: { kind: 'prompt', label: 'プロンプト' } },
        { type: 'end', particle: 'p', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'In-Context Retrieval-Augmented Language Models',
      authors: 'Ram, O. ほか',
      year: 2023,
      venue: 'TACL 2023',
      arxiv: '2302.00083',
      note: '取り出した文書を入力の前に足すだけで、言語モデル自体は変えない',
    },
    {
      title: 'Lost in the Middle: How Language Models Use Long Contexts',
      authors: 'Liu, N. F. ほか',
      year: 2024,
      venue: 'TACL 2024',
      arxiv: '2307.03172',
      note: '必要な資料が長い入力の真ん中にあると、先頭や末尾にあるときより正答率が下がる',
    },
  ],
};
