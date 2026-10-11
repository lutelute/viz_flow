import type { Diagram } from '../../model/diagram';

// 埋め込みモデルの中。BERT 系のエンコーダで文を 1 本のベクトルにする。
// まとめ方（平均か [CLS] か）と正規化の有無はモデルによって違うので、キャプションで両方に触れる。

export const insideEmbedding: Diagram = {
  id: 'inside-embedding',
  title: '埋め込みモデルの中',
  subtitle: '文を読み、意味の近さを測れる 1 本の数の並びにする',
  lanes: [
    { id: 'read', label: '読む', tone: 'accent1', frame: 'band' },
    { id: 'pool', label: '1 本にまとめる', tone: 'accent2', frame: 'band' },
  ],
  nodes: [
    { id: 'in', kind: 'port', label: '文やチャンク', sublabel: '外の図から入る', lane: 'read', col: 0, emphasis: 'muted' },
    { id: 'tok', kind: 'chunker', label: 'トークンに\n分ける', sublabel: '部分語を番号に', lane: 'read', col: 1 },
    { id: 'lookup', kind: 'index', label: '番号を\nベクトルに', sublabel: '位置の情報も足す', lane: 'read', col: 2 },
    { id: 'enc', kind: 'encoder', label: 'Transformer\nエンコーダ', sublabel: '前後の両方を見る', lane: 'read', col: 3, emphasis: 'new', opens: 'inside-attention' },
    { id: 'mean', kind: 'embedding', label: '平均して\n1 本に', sublabel: 'プーリング', lane: 'pool', col: 2 },
    { id: 'norm', kind: 'generic', label: '長さを 1 に', sublabel: '正規化', lane: 'pool', col: 1 },
    { id: 'out', kind: 'port', label: 'ベクトル', sublabel: '外の図へ出る', lane: 'pool', col: 0, emphasis: 'muted' },
  ],
  edges: [
    { id: 'e-in-tok', from: 'in', to: 'tok' },
    { id: 'e-tok-lookup', from: 'tok', to: 'lookup' },
    { id: 'e-lookup-enc', from: 'lookup', to: 'enc' },
    { id: 'e-enc-mean', from: 'enc', to: 'mean', fromSide: 'bottom', toSide: 'right' },
    { id: 'e-mean-norm', from: 'mean', to: 'norm', fromSide: 'left', toSide: 'right' },
    { id: 'e-norm-out', from: 'norm', to: 'out', fromSide: 'left', toSide: 'right' },
  ],
  steps: [
    {
      n: 1,
      short: '分ける',
      caption: '文を部分語のトークンに分け、語彙表の番号に置き換える',
      actions: [{ type: 'travel', particle: 's', edges: ['e-in-tok'], payload: { kind: 'text', label: '文' } }],
    },
    {
      n: 2,
      short: '引く',
      caption: '番号ごとに表からベクトルを引き、何番目の語かを表す位置の情報を足す',
      actions: [{ type: 'travel', particle: 's', edges: ['e-tok-lookup'], payload: { kind: 'tokens', label: '番号' } }],
    },
    {
      n: 3,
      short: '読む',
      caption: 'Transformer の層（例: 12 層）に通す。各トークンが前後すべてのトークンに注意を向け、文脈に合わせて意味を調整する',
      detail: 'この部品をひらくと、注意の計算の中に入れる',
      actions: [
        { type: 'travel', particle: 's', edges: ['e-lookup-enc'], payload: { kind: 'tokens', label: 'ベクトル列' } },
        { type: 'dwell', particle: 's', node: 'enc', seconds: 0.8, label: '層を通る' },
      ],
    },
    {
      n: 4,
      short: 'まとめる',
      badge: { edge: 'e-enc-mean', at: 0.3 },
      caption: 'トークンの数だけあるベクトルを平均して 1 本にする。先頭の [CLS] の位置だけを使うモデルもある',
      actions: [{ type: 'travel', particle: 's', edges: ['e-enc-mean'], payload: { kind: 'tokens', label: 'ベクトル列' } }],
    },
    {
      n: 5,
      short: 'そろえる',
      caption: '多くのモデルは最後にベクトルの長さを 1 にそろえる。こうすると内積がそのまま cosine 類似度になる',
      actions: [{ type: 'travel', particle: 's', edges: ['e-mean-norm'], payload: { kind: 'vector', label: 'ベクトル' } }],
    },
    {
      n: 6,
      short: '渡す',
      caption: '文 1 つが決まった長さの数の並び（例: 768 次元）になる。探す側の文も探される側の文も同じモデルに通すので、近さを比べられる',
      detail: '似た意味の文どうしが近くなるよう、対になった文を使って学習してある',
      actions: [
        { type: 'travel', particle: 's', edges: ['e-norm-out'], payload: { kind: 'vector', label: 'ベクトル' } },
        { type: 'end', particle: 's', mode: 'stay' },
      ],
      hold: 1.0,
    },
  ],
  sources: [
    {
      title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
      authors: 'Devlin, J., Chang, M.-W., Lee, K., Toutanova, K.',
      year: 2019,
      venue: 'NAACL 2019',
      arxiv: '1810.04805',
      note: '部分語（WordPiece）への分割、前後を両方見るエンコーダ、先頭の [CLS]',
    },
    {
      title: 'Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks',
      authors: 'Reimers, N., Gurevych, I.',
      year: 2019,
      venue: 'EMNLP-IJCNLP 2019',
      arxiv: '1908.10084',
      note: 'トークンのベクトルを平均して文のベクトルにし、cosine で比べる',
    },
    {
      title: 'Dense Passage Retrieval for Open-Domain Question Answering',
      authors: 'Karpukhin, V. ほか',
      year: 2020,
      venue: 'EMNLP 2020',
      arxiv: '2004.04906',
      note: '質問と文書を別々の BERT で読み、[CLS] のベクトルの内積で近さを測る',
    },
  ],
};
