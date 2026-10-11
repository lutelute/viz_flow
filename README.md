# viz_flow

仕組みの図解を、番号付きのステップが順に動く縦型の動画と静止画として作るための道具。RAG の 8 つの型、REFRAG との比較、計測データの流れなどのテンプレートを同梱している。元ネタにした Instagram の投稿は静止画だったが、こちらは光の粒が中身（質問、ベクトル、文書、回答）を変えながらノードを渡っていく。1 本の定義から 4 つの様式（教科書・製図・誌面・ネオン）で描き分け、4:5、9:16、1:1 の PNG と MP4 を出す。

公開版: https://lutelute.github.io/viz_flow/

## 見る

- `?t=<id>` でテンプレート、`?style=sketch|blueprint|editorial|neon` で様式、`?step=<n>` でそのステップの位置で止めて開く。例: `?t=hyde-rag&style=blueprint&step=3`
- キー: Space で再生と一時停止、左右の矢印キーでステップ、`,` `.` で 1 フレーム、1〜4 で様式、D でテーマ、E で書き出し、S で URL をコピー、? で操作一覧。
- OS で「視差効果を減らす」が有効なら自動再生せず、全ステップを 1 枚に畳んだ静止表示で開く。再生ボタンで動かせる。

## 書き出す

ローカルで Playwright と ffmpeg を使う方法。`?export=1` の素の描画ページを 1 フレームずつ撮り、libx264 の MP4 にする。

```bash
npm install
npx playwright install chromium
npm run dev                      # 別の端末で起動したまま
npm run export -- --template naive-rag --style sketch --size 4x5 --format mp4
npm run export -- --template corrective-rag --size 9x16 --format png --step 3
```

出力は `out/` に入る。MP4 は 1080×1350（4x5）、1080×1920（9x16）、1080×1080（1x1）、30fps、H.264 High 4.1、yuv420p。1 周は図によって 15〜25 秒。同じ引数で 2 回出すと PNG のハッシュが一致する。Chrome 154 と ffmpeg 9.0 で確認した（2026-10-11）。

ブラウザの中だけで MP4 を作る機能は作業中。

## テンプレートを書く

`src/content/` に 1 ファイル 1 図で置く。見た目は書かず、構造と物語だけを書く。

```ts
import type { Diagram } from '../../model/diagram';

export const myFlow: Diagram = {
  id: 'my-flow',
  title: '題名',
  subtitle: '一文で何の図か',
  lanes: [{ id: 'a', label: '上の帯', frame: 'band' }],
  nodes: [
    { id: 'in', kind: 'user', label: '入力', lane: 'a', col: 0 },
    { id: 'proc', kind: 'llm', label: '処理', sublabel: '補足', lane: 'a', col: 1 },
    { id: 'out', kind: 'answer', label: '出力', lane: 'a', col: 2 },
  ],
  edges: [
    { id: 'e1', from: 'in', to: 'proc' },
    { id: 'e2', from: 'proc', to: 'out', label: '結果' },
  ],
  steps: [
    { n: 1, short: '送る', caption: '入力を処理に送る', actions: [{ type: 'travel', particle: 'p', edges: ['e1'], payload: { kind: 'query', label: '入力' } }] },
    { n: 2, short: '返す', caption: '処理した結果を返す', actions: [{ type: 'travel', particle: 'p', edges: ['e2'], payload: { kind: 'answer', label: '結果' } }] },
  ],
  sources: [{ title: '論文名', authors: '著者', year: 2024, arxiv: '0000.00000', note: '図のどこが論文のどこか' }],
};
```

- `kind` はノードの種類（user, documents, chunker, embedding, vectordb, graphdb, retriever, reranker, grader, router, prompt, llm, answer, web, tool, agent, memory, policy, encoder, index, generic）。図記号と面の色はここから決まる。
- `col` と `row` はレーン内の列と行。座標は書かない。辺の出入りする辺を決めたいときだけ `fromSide` と `toSide` を書く。
- `steps[].actions` の `travel` は粒子が通る辺と、そのときの中身。中身が変わるとノードの中で変身する。`split` と `merge` で分岐と合流、`dwell` でノードの中の処理、`highlight` で強調だけを表す。
- `src/content/index.ts` に登録する。`npm test` が定義の整合、レイアウトの重なり、時間軸の生成を全図に対して確かめる。
- キャプションは 1 ステップ 1 文、動詞で終える。出典は著者（年）題名と arXiv 番号か DOI、図のどの部分がどの節かを 1 行。

## 様式

| id | 名前 | フォント | 特徴 |
|---|---|---|---|
| sketch | 教科書 | Klee One、Zen Kurenaido | 紙色、手描きの線、丸数字、蛍光ペンの下地 |
| blueprint | 製図 | BIZ UDGothic、M PLUS 1 Code | 方眼、藍 1 色、部品記号、表題欄 |
| editorial | 誌面 | Shippori Mincho B1、Zen Kaku Gothic New | 無地、墨と朱と藍の 3 色、罫線 |
| neon | ネオン | BIZ UDPGothic | 暗い背景、3 色、粒子だけが光る |

フォントは Google Fonts（SIL Open Font License）から読む。様式を切り替えてもノードの列と行は変わらない。

## 開発

```bash
npm run dev          # http://localhost:5173/viz_flow/
npm run check        # eslint、文言の検査、型検査、テスト
npm run shots        # 全様式 × 全テンプレートの静止画を shots/current/ に撮って一覧 HTML を作る
```

`scripts/lint-copy.ts` は em-dash、中黒で並べた題、Tailwind の既定色、Inter、ぼかし、SVG への HTML 埋め込み、描画経路の乱数と現在時刻などを行番号付きで落とす。描画の決めごとは `docs/renderer.md` にある。

## 分かっている問題（2026-10-11）

- 8 枚の一覧は 4:5 では文字が読めない。Instagram には 1 枚ずつ出す。
- 列の間が狭いので、短い辺にラベルを付けると箱に食い込む。長い辺にだけ付けている。
- ブラウザ内の書き出しは未実装。iPhone の Safari での動作は未確認。

## 出典とライセンス

各図の出典はその図の下に出る。RAG の定義は Lewis ほか（2020）、Gao ほか（2023）、Gao・Ma・Lin・Callan（2022）、Yan ほか（2024）、Edge ほか（2024）、Sarmah ほか（2024）、Jeong ほか（2024）、Singh ほか（2025）、Abootorabi ほか（2025）、Lin ほか（2025）に従った。参考にした投稿の画像は含めていない。
