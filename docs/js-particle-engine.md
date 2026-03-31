# JS Particle Engine -- 設計ドキュメント

viz_flow に NodeDash の JS パーティクルエンジンのコンセプトを統合するための設計書。

---

## 1. コンセプト: なぜ JS ベースが必要か

### SVG animateMotion の限界

viz_flow の現行 `AnimatedEdge.tsx` は SVG の `<animateMotion>` + `<animate>` で
パーティクルを動かしている。この方式には以下の構造的限界がある。

| 制約 | 詳細 |
|------|------|
| **グループ同期ができない** | 各 `<animateMotion>` は独立したタイマーで動く。複数の球が「全員到着してから再発射」というロジックを SVG 属性だけで表現できない |
| **途中で途切れる** | `keyTimes/keyPoints` でフェードイン・アウトを制御しているが、移動中に opacity=0 の区間ができやすく、始点から終点まで途切れなく見せるのが難しい |
| **終点フリーズの制御が不自然** | 到着後に `keyPoints="0;1;1"` で終点に留める hack を使っているが、次のサイクルが始まると瞬間的に消えて始点に戻るため、フリーズ→再発射の間に視覚的な断絶がある |
| **ステート依存の条件分岐ができない** | 外部データ (サーバーの ON/OFF 等) に応じて、特定のパーティクルだけ止める/色を変える/ルートを変更する、といった動的制御が不可能 |

### JS パーティクルエンジンの利点

NodeDash の `network-map.js` では `requestAnimationFrame` ループで毎フレーム座標を計算し、
SVG 要素を直接更新している。これにより:

- **グループ同期ループ**: 複数球が順番に発射 → 全球到着 → ポーズ → 再発射
- **始点〜終点まで途切れない**: 移動中は常に描画。opacity 制御不要
- **終点フリーズ**: 到着した球は次のサイクルまで終点座標に固定表示
- **動的制御**: JS 側で条件分岐が自由にできる

---

## 2. NodeDash パーティクルエンジンの構造

`network-map.js` のエンジンは以下の 4 関数で構成される。

### 2.1 `buildSegments(waypoints)`

```
入力: [{x, y}, ...] -- ウェイポイント配列
出力: { segs: [{x0,y0,x1,y1,len,cumLen}, ...], totalLen }
```

ウェイポイント間の直線セグメントを構築し、累積距離 (cumLen) を計算する。
パス全体の totalLen も保持する。

### 2.2 `posAt(route, t)`

```
入力: route (buildSegments の出力), t (0..1 の進捗率)
出力: {x, y}
```

進捗率 t に対応するパス上の座標を線形補間で返す。

### 2.3 `buildParticleGroups()`

パーティクルグループの定義を構築する。各グループは:

```js
{
  balls: [
    {
      waypoints: [...],  // 経由地点
      color, label,
      delay,             // グループ内での発射遅延 (秒)
      travel,            // 移動所要時間 (秒)
      r1, r2,            // 外殻/コアの半径
      opacity,           // 全体透明度
      route,             // buildSegments() の結果 (事前計算)
    },
    ...
  ],
  pause: 3,              // 全球到着後のポーズ時間 (秒)
  cycle,                 // 自動計算: max(delay + travel) + pause
}
```

### 2.4 `renderParticles(time)`

`requestAnimationFrame` コールバック。毎フレーム:

1. 現在時刻から各グループのサイクル内時刻を算出 (`t % cycle`)
2. 各球について:
   - 発射前 (`ballT < 0`): 描画しない
   - 移動中 (`0 <= ballT <= travel`): `posAt(route, ballT/travel)` の座標に描画
   - 到着後 (`ballT > travel`): 終点座標にフリーズ描画
3. 全球の SVG を innerHTML として一括書き込み

---

## 3. 型定義の拡張案

### 3.1 新しい型

```typescript
// src/core/types.ts に追加

/** ウェイポイント: ノードID参照 or 絶対座標 */
export type Waypoint = string | { x: number; y: number };

/** グループ内の1つのパーティクル (球) */
export interface GroupParticleBall {
  /** 経由ウェイポイント。string はノードIDとして解決 */
  waypoints: Waypoint[];
  color: string;
  label?: string;
  icon?: string;
  /** グループ内での発射遅延 (秒) */
  delay?: number;
  /** 移動所要時間 (秒)。default: 自動計算 */
  travel?: number;
  /** 外殻半径 */
  outerRadius?: number;
  /** コア半径 */
  coreRadius?: number;
  /** 全体透明度 (0..1) */
  opacity?: number;
}

/** パーティクルグループ: 同期ループする球の集合 */
export interface ParticleGroup {
  id: string;
  balls: GroupParticleBall[];
  /** 全球到着後のポーズ時間 (秒) */
  pauseDuration?: number;
}

/** FlowEdge の拡張: animationMode を追加 */
// 既存の FlowEdge.particleState はそのまま残す (SVG 方式用)
```

### 3.2 FlowDefinition の拡張

```typescript
export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
  zones?: FlowZone[];
  /** JS パーティクルエンジン用のグループ定義 */
  particleGroups?: ParticleGroup[];
  config: FlowConfig;
}
```

### 3.3 FlowConfig の拡張

```typescript
export interface FlowConfig {
  // ... 既存フィールド ...
  /** パーティクルアニメーション方式。default: 'svg' */
  particleMode?: 'svg' | 'js';
}
```

`particleMode: 'svg'` (デフォルト) で既存の animateMotion 方式を維持し、
`particleMode: 'js'` で新エンジンに切り替える。
`particleGroups` が定義されていれば暗黙的に `'js'` として扱う設計でもよい。

---

## 4. アーキテクチャ: 既存コンポーネントとの統合

### 4.1 方針: 新コンポーネント `ParticleEngine.tsx` を追加

`AnimatedEdge.tsx` を拡張するのではなく、**独立した新コンポーネント**として実装する。
理由:

1. AnimatedEdge は「1エッジ = 1パーティクル」の SVG 方式と密結合している
2. JS パーティクルエンジンは「グループ単位」で動作し、エッジの概念と一致しない
3. 単一の rAF ループで全グループを描画する必要がある (エッジごとに分離できない)

### 4.2 コンポーネント構成

```
FlowCanvas.tsx
  +-- <svg>
  |     +-- FlowZoneComponent (各ゾーン)
  |     +-- AnimatedEdge (particleMode='svg' のとき、既存のまま)
  |     +-- FlowNodeComponent (各ノード)
  |     +-- <g id="particle-layer" />   ← JS エンジンの描画先
  +-- ParticleEngine (particleMode='js' のとき)
        - useRef で <g id="particle-layer"> を取得
        - useEffect 内で rAF ループを開始/停止
        - particleGroups + nodeMap を受け取り描画
```

### 4.3 FlowCanvas.tsx の変更イメージ

```tsx
// FlowCanvas.tsx (変更箇所のみ)

import { ParticleEngine } from './ParticleEngine';

export function FlowCanvas({ flow }: Props) {
  const particleLayerRef = useRef<SVGGElement>(null);
  const useJsParticles = flow.config.particleMode === 'js'
    || (flow.particleGroups && flow.particleGroups.length > 0);

  return (
    <div className="flow-canvas" ...>
      <svg ...>
        {/* ゾーン */}
        {flow.zones?.map(...)}

        {/* エッジ: JS モードでも線だけは描画 (パーティクルなし) */}
        {edgePaths.map(({ edge, path }) => (
          useJsParticles
            ? <StaticEdge edge={edge} path={path} theme={theme} />
            : <AnimatedEdge edge={edge} path={path} theme={theme} speed={speed} />
        ))}

        {/* ノード */}
        {nodes.map(...)}

        {/* JS パーティクル描画先 */}
        <g ref={particleLayerRef} />
      </svg>

      {/* JS パーティクルエンジン (DOM 外、rAF のみ) */}
      {useJsParticles && flow.particleGroups && (
        <ParticleEngine
          groups={flow.particleGroups}
          nodeMap={nodeMap}
          layerRef={particleLayerRef}
          theme={theme}
          speed={speed}
        />
      )}
    </div>
  );
}
```

### 4.4 ParticleEngine.tsx の骨格

```tsx
// src/components/ParticleEngine.tsx

import { useEffect, useRef, useMemo } from 'react';
import type { ParticleGroup, FlowNode } from '../core/types';
import type { Theme } from '../core/themes';

interface Props {
  groups: ParticleGroup[];
  nodeMap: Map<string, FlowNode>;
  layerRef: React.RefObject<SVGGElement | null>;
  theme: Theme;
  speed: number;
}

// --- 純粋関数 (NodeDash からほぼそのまま移植) ---

interface Segment { x0: number; y0: number; x1: number; y1: number; len: number; cumLen: number }
interface Route { segs: Segment[]; totalLen: number }

function buildSegments(waypoints: { x: number; y: number }[]): Route {
  // NodeDash の buildSegments をそのまま移植
}

function posAt(route: Route, t: number): { x: number; y: number } {
  // NodeDash の posAt をそのまま移植
}

// --- React コンポーネント ---

export function ParticleEngine({ groups, nodeMap, layerRef, theme, speed }: Props) {
  const compiledRef = useRef<CompiledGroup[]>([]);

  // ウェイポイントのノードID解決 + ルート事前計算
  const compiled = useMemo(() => {
    return groups.map(g => {
      const balls = g.balls.map(b => {
        const resolved = b.waypoints.map(wp =>
          typeof wp === 'string'
            ? (() => { const n = nodeMap.get(wp); return n ? { x: n.x, y: n.y } : { x: 0, y: 0 }; })()
            : wp
        );
        const route = buildSegments(resolved);
        const travel = b.travel ?? route.totalLen / (150 * speed);  // 自動計算
        return { ...b, route, travel, delay: b.delay ?? 0 };
      });
      const maxEnd = Math.max(...balls.map(b => b.delay + b.travel));
      const cycle = maxEnd + (g.pauseDuration ?? 3);
      return { balls, cycle };
    });
  }, [groups, nodeMap, speed]);

  useEffect(() => {
    compiledRef.current = compiled;
  }, [compiled]);

  // rAF ループ
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    let frameId: number;

    function render(time: number) {
      const t = time / 1000;
      let html = '';

      for (const g of compiledRef.current) {
        const cycleT = t % g.cycle;
        for (const b of g.balls) {
          const ballT = cycleT - b.delay;
          if (ballT < 0) continue;
          const progress = Math.min(ballT / b.travel, 1);
          const pos = posAt(b.route, progress);
          // SVG 文字列を構築 (NodeDash と同じパターン)
          html += `<circle cx="${pos.x}" cy="${pos.y}" .../>`;
        }
      }

      layer.innerHTML = html;
      frameId = requestAnimationFrame(render);
    }

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
  }, [layerRef]);

  return null; // DOM は出力しない。SVG <g> を直接操作
}
```

---

## 5. NodeDash からの移植ポイント

### 5.1 そのまま移植できる部分

| 関数 | 移植方法 |
|------|---------|
| `buildSegments()` | 型注釈を追加するだけ。ロジックは完全移植 |
| `posAt()` | 同上 |
| `renderParticles()` の描画ロジック | SVG 文字列組み立て部分はそのまま使える。`innerHTML` パターンも React の rAF useEffect 内であれば問題ない |

### 5.2 React 化が必要な部分

| NodeDash の機能 | React での対応 |
|----------------|---------------|
| `buildParticleGroups()` | テンプレート定義 (FlowDefinition.particleGroups) として宣言的に記述。ノードID参照をウェイポイントに使い、useMemo で座標解決 |
| `startParticles()` / `stopParticles()` | useEffect のクリーンアップで自動管理 |
| `document.getElementById('nm-particles')` | useRef でSVG `<g>` 要素を参照 |
| グローバル変数 `particleGroups`, `animFrame` | useRef で保持 |
| ノード座標のハードコード | `nodeMap` から動的解決。テンプレート側ではノードID文字列を指定するだけ |

### 5.3 拡張すべき部分

| 項目 | 説明 |
|------|------|
| **テーマ対応** | NodeDash はハードコードされた色を使用。viz_flow では Theme オブジェクトからデフォルト色を取得し、球ごとの color 指定で上書きする |
| **アイコン付きパーティクル** | NodeDash は circle + text のみ。viz_flow の既存 `ParticleState.icon` の描画ロジック (AnimatedEdge の StatefulParticle) を rAF レンダラーに統合 |
| **速度の正規化** | NodeDash は travel を秒数で直接指定。viz_flow では `config.animationSpeed` との統合が必要。travel を省略した場合は `totalLen / (baseSpeed * animationSpeed)` で自動算出 |
| **到着パルスとの連動** | 現行の ArrivalPulse.tsx はサイクルタイマーベース。JS エンジンでは「全球到着」のイベントを検知してパルスを発火できる |

---

## 6. テンプレート定義の例

```typescript
// templates/network-infra.ts
import type { FlowDefinition } from '../core/types';

export const networkInfra: FlowDefinition = {
  nodes: [
    { id: 'client',    label: 'Client',     x: 100, y: 200, icon: 'terminal',  color: '#818cf8' },
    { id: 'vpn',       label: 'VPN Hub',    x: 300, y: 200, icon: 'shield',    color: '#a78bfa' },
    { id: 'server-a',  label: 'Server A',   x: 550, y: 100, icon: 'server',    color: '#34d399' },
    { id: 'server-b',  label: 'Server B',   x: 550, y: 200, icon: 'cpu',       color: '#22d3ee' },
    { id: 'server-c',  label: 'Server C',   x: 550, y: 300, icon: 'cpu',       color: '#fbbf24' },
  ],
  edges: [
    { id: 'e1', from: 'client',   to: 'vpn',      color: '#a78bfa' },
    { id: 'e2', from: 'vpn',      to: 'server-a',  color: '#34d399' },
    { id: 'e3', from: 'vpn',      to: 'server-b',  color: '#22d3ee' },
    { id: 'e4', from: 'vpn',      to: 'server-c',  color: '#fbbf24' },
  ],
  particleGroups: [
    {
      id: 'compute-cluster',
      pauseDuration: 3,
      balls: [
        {
          waypoints: ['client', 'vpn', { x: 400, y: 60 }, 'server-a'],
          color: '#34d399', label: 'SSH', delay: 0,
        },
        {
          waypoints: ['client', 'vpn', 'server-b'],
          color: '#22d3ee', label: 'SSH', delay: 1.5,
        },
        {
          waypoints: ['client', 'vpn', { x: 400, y: 340 }, 'server-c'],
          color: '#fbbf24', label: 'SSH', delay: 3.0,
        },
      ],
    },
  ],
  config: {
    title: 'Network Infrastructure',
    width: 700, height: 400,
    theme: 'dark',
    particleMode: 'js',
  },
};
```

---

## 7. 実装ステップ (推奨順序)

1. **型定義の追加**: `types.ts` に `Waypoint`, `GroupParticleBall`, `ParticleGroup` を追加。`FlowDefinition` と `FlowConfig` を拡張
2. **純粋関数の移植**: `buildSegments`, `posAt` を `src/core/particle-math.ts` に配置 (テスト可能)
3. **ParticleEngine.tsx の実装**: rAF ループ + innerHTML パターン
4. **FlowCanvas.tsx の分岐追加**: `particleMode` に応じて AnimatedEdge / StaticEdge を切り替え、`<g ref>` + ParticleEngine を追加
5. **テンプレート作成**: `particleGroups` を使ったサンプルテンプレートで動作確認
6. **到着パルスの連動** (オプション): JS エンジンから「全球到着」コールバックを発火

---

## 8. パフォーマンス考慮

- **innerHTML パターン**: NodeDash と同じく、毎フレーム SVG 文字列を組み立てて `innerHTML` で一括書き込み。React の仮想 DOM を経由しないため高速。球の数が数十程度なら問題ない
- **React レンダリングとの分離**: ParticleEngine は `return null` で DOM を出力しない。SVG `<g>` を ref 経由で直接操作するため、React の再レンダリングサイクルとは独立
- **useMemo でのルート事前計算**: ウェイポイント→セグメント変換はフレームごとではなく、定義変更時のみ実行

---

## 9. 既存方式との共存

`particleMode: 'svg'` (デフォルト) では現行の AnimatedEdge がそのまま動作する。
`particleMode: 'js'` を指定した場合のみ ParticleEngine が有効になる。

1つの FlowDefinition 内で両方式を混在させる必要はない。
エッジ単位の `particleState` (SVG 方式) と `particleGroups` (JS 方式) は排他的に使う。
