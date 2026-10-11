# viz_flow

仕組みの図解を、番号付きのステップが順に動く縦型の動画と静止画として作るための道具。RAG の 8 つの型、REFRAG との比較、計測データの流れなどのテンプレートを同梱している。元ネタにした Instagram の投稿は静止画だったが、こちらは光の粒が中身（質問、ベクトル、文書、回答）を変えながらノードを渡っていく。1 本の定義から 5 つの様式（教科書・製図・誌面・ネオン・略図）で描き分け、4:5、9:16、1:1 の PNG と MP4 を出す。図の中の部品は「ひらく」で一段下の仕組みの図に入れるので、全体の流れから部品の中身まで順に降りて学べる。

公開版: https://lutelute.github.io/viz_flow/

## 見る

- `?t=<id>` でテンプレート、`?style=sketch|blueprint|editorial|neon|plain` で様式、`?step=<n>` でそのステップの位置で止めて開く。例: `?t=hyde-rag&style=blueprint&step=3`
- キー: Space で再生と一時停止、左右の矢印キーでステップ、`,` `.` で 1 フレーム、1〜5 で様式、D でテーマ、E で書き出し、S で URL をコピー、? で操作一覧。Enter で選んだ部品をひらき、Esc か Backspace でひとつ上へ戻る。
- OS で「視差効果を減らす」が有効なら自動再生せず、全ステップを 1 枚に畳んだ静止表示で開く。再生ボタンで動かせる。

## ひらく

右下の角が折れている部品は、押すと中の仕組みの図に入れる。Tab で選んで Enter でもよい。右の欄の「ひらける部品」からも選べる。中の図の両端にある「外の図から入る」「外の図へ出る」は、外の図でその部品に入るものと出ていくものに合わせてある。上の段へはパンくず、「ひとつ上へ」、Esc、Backspace、ブラウザの戻るで戻れる。

- 段は重ねられる。基本の RAG の埋め込みモデルをひらき、その中の Transformer エンコーダをひらくと自己注意の計算に入る。LLM の中のデコーダからも同じ自己注意に入る。違いは「後ろを隠すかどうか」だけで、その手順を図の中で示している。
- 8 つの RAG の一覧では、1 枚がそのまま 1 つの部品になる。押すとその RAG の図に入り、さらに部品をひらける。
- URL は `?t=naive-rag&open=embed/enc` のように、ひらいた部品の id を `/` でつなぐ。この URL を共有すると同じ段で開く。
- 同じ部品はどの図からひらいても同じ中身につながる。HyDE の埋め込みモデルも HybridRAG のベクトル DB も、基本の RAG と同じ図に入る。一度学べば別の図でも使える。
- 中の図もふつうの図なので、ステップ、粒子、出典、書き出しはそのまま使える。ひらく印と当たり判定は画面だけに出し、書き出しには出さない。

| 中の図 | ひらける部品の例 | 出典 |
|---|---|---|
| チャンク分割の中 | チャンク分割 | Karpukhin ほか（2020）、Gao ほか（2023） |
| 埋め込みモデルの中 | 埋め込みモデル、HyDE のエンコーダ | Devlin ほか（2019）、Reimers・Gurevych（2019）、Karpukhin ほか（2020） |
| 自己注意の中 | 埋め込みモデルの中の Transformer、LLM の中のデコーダ | Vaswani ほか（2017） |
| ベクトル DB の中 | ベクトル DB、ベクトル索引 | Malkov・Yashunin（2020） |
| プロンプトテンプレートの中 | プロンプトテンプレート | Ram ほか（2023）、Liu ほか（2024） |
| LLM の中 | LLM、生成器、下書き器、通常の RAG のデコーダ | Vaswani ほか（2017）、Brown ほか（2020） |
| RRF の中 | RRF で融合 | Cormack ほか（2009） |

部品の種類（kind）が同じでも中身が同じとは限らないので、ひらける部品は図ごとに手で指定している。たとえば CLIP のテキストエンコーダは前のトークンしか見ないので、埋め込みモデルの中（前後を見る）にはつないでいない。

## 書き出す

画面右上の「書き出し」から、ブラウザの中だけで PNG と MP4 を作れる。形式、サイズ（4:5、9:16、1:1）、静止画の時刻かステップ、動画の周回数と画質を選んで「書き出す」を押すと、進捗が出て、終わるとダウンロードできる。対応端末では「写真に保存」から共有シートが開く。

- 仕組み: 任意の時刻の図を SVG 文字列にし、使う文字ぶんだけ Google Fonts の woff2 を埋め込み、canvas に描いて H.264 の MP4 にする（mediabunny）。H.264 が作れないブラウザでは VP9 の WebM に落ちる。
- 確認済み（2026-10-11）: Chrome 154 で 1080×1350、30fps、18 秒の MP4 が約 15 秒で出る。画面との画素差は 0.4%。Playwright の WebKit でも MP4 が出た。本物の Safari、iPhone、Firefox は未確認。
- フォントの取得に失敗したときは「代替書体のまま書き出す」を選べる。

端末で ffmpeg を使う方法もある。`?export=1` の素の描画ページを Playwright で 1 フレームずつ撮り、libx264 でまとめる。色空間を bt709 に揃えたいときや、全テンプレートを一括で出すときはこちら。

```bash
npm install
npx playwright install chromium
npm run dev                      # 別の端末で起動したまま
npm run export -- --template naive-rag --style sketch --size 4x5 --format mp4
npm run export -- --template corrective-rag --size 9x16 --format png --step 3
```

出力は `out/` に入る。MP4 は 1080×1350（4x5）、1080×1920（9x16）、1080×1080（1x1）、30fps、H.264 High、yuv420p。1 周は図によって 15〜28 秒。同じ引数で 2 回出すと PNG のハッシュが一致する。

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

- `kind` はノードの種類（user, documents, chunker, embedding, vectordb, graphdb, retriever, reranker, grader, router, prompt, llm, answer, web, tool, agent, memory, policy, encoder, index, image, port, generic）。図記号と面の色はここから決まる。`port` は中の図の両端に置く「外の図との境目」。
- 部品をひらけるようにするには、ノードに `opens: 'inside-embedding'` のように中の図の id を書く。中の図は `src/content/layers/` に置き、`layers` に登録する。中の図の両端には `port` のノードを置き、外の図でその部品に出入りするものと同じ名前にする。
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
| plain | 略図 | Zen Maru Gothic | 丸の中に図記号、下に名前だけ。補足と番号横の語は省く。差し色は藍・錆・緑 |

フォントは Google Fonts（SIL Open Font License）から読む。様式を切り替えてもノードの列と行は変わらない。

## 開発

```bash
npm run dev          # http://localhost:5173/viz_flow/
npm run check        # eslint、文言の検査、型検査、テスト
npm run shots        # 全様式 × 全テンプレートの静止画を shots/current/ に撮って一覧 HTML を作る
```

`scripts/lint-copy.ts` は em-dash、中黒で並べた題、Tailwind の既定色、Inter、ぼかし、SVG への HTML 埋め込み、描画経路の乱数と現在時刻などを行番号付きで落とす。描画の決めごとは `docs/renderer.md` にある。

## 分かっている問題（2026-10-11）

- 8 枚の一覧は 4:5 では文字が読めない。Instagram には 1 枚ずつ出す。画面では横 4 列で並べ、1 枚を押すとその図に入る。
- 列の間が狭いので、短い辺にラベルを付けると箱に食い込む。長い辺にだけ付けている。
- ブラウザ内の書き出しは Chrome で確認した。Safari と iPhone の「写真に保存」、Firefox の WebM への切り替えは未確認。
- レーンの見出しの上を、下のレーンから上に抜ける破線が横切ることがある（基本の RAG の「同じモデルで」）。
- 辺のラベルは、後から引かれる別の線との重なりを避けない。CRAG の「正しい」に「誤り」の線がかかる。
- 動画では、粒子が通る一瞬だけ粒子のラベルが番号バッジを隠すことがある。静止表示では起きない。
- 略図では「あいまい」と「誤り」が同じ錆色になる。粒子のラベルで見分ける。

## 出典とライセンス

各図の出典はその図の下に出る。RAG の定義は Lewis ほか（2020）、Gao ほか（2023）、Gao・Ma・Lin・Callan（2022）、Yan ほか（2024）、Edge ほか（2024）、Sarmah ほか（2024）、Jeong ほか（2024）、Singh ほか（2025）、Abootorabi ほか（2025）、Lin ほか（2025）に従った。参考にした投稿の画像は含めていない。
