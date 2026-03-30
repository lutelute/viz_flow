# viz_flow

アニメーション付きフロー可視化テンプレート。ノード間を光の粒子が移動し、データやプロセスの流れを直感的に表現します。

## Demo

**[Live Demo](https://lutelute.github.io/viz_flow/)**

## Features

- **アイコンベースのノード** — `icon-only` / `rounded` / `cylinder` / `document` / `diamond` / `circle` の6形状
- **光の粒子アニメーション** — SVG `animateMotion` でパス上を移動、ノード通過で状態変化（色・アイコン・ラベル）
- **直線+丸角パス** — Mermaid / n8n 風のクリーンなフロー表現
- **テーマ切替** — light / dark
- **テンプレート** — Data Pipeline / RAG Pipeline / Research Process の3例を同梱
- **宣言的定義** — TypeScript でノード・エッジ・設定を記述するだけ

## Quick Start

```bash
npm install
npm run dev
```

## 新しいフローの作り方

`src/templates/` にファイルを追加:

```typescript
import type { FlowDefinition } from '../core/types';

export const myFlow: FlowDefinition = {
  nodes: [
    { id: 'a', label: 'Start', x: 100, y: 100, icon: 'play', color: '#6366f1' },
    { id: 'b', label: 'Process', x: 300, y: 100, icon: 'cpu', color: '#ec4899' },
    { id: 'c', label: 'End', x: 500, y: 100, icon: 'check-circle', color: '#10b981' },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b', particleCount: 1 },
    { id: 'e2', from: 'b', to: 'c', particleCount: 1,
      particleState: { color: '#ec4899', icon: 'sparkles', label: 'done', size: 14 } },
  ],
  config: {
    title: 'My Flow',
    width: 600,
    height: 250,
    theme: 'light',
  },
};
```

`src/templates/index.ts` の `templateList` に追加すれば表示されます。

## ノード形状

| Shape | 説明 |
|-------|------|
| `icon-only` | ボックスなし、アイコン+ラベルのみ (デフォルト) |
| `rounded` | 丸角の四角形 |
| `rect` | 直角の四角形 |
| `cylinder` | データベース風 |
| `document` | ドキュメント風 |
| `diamond` | ひし形（条件分岐） |
| `circle` | 円形 |

## パーティクル状態変化

エッジの `particleState` で光の玉の見た目を指定:

```typescript
{
  particleState: {
    color: '#ec4899',
    icon: 'sparkles',
    label: 'answer',
    size: 14,
  }
}
```

## Tech Stack

React 19 + TypeScript + Vite — SVG アニメーション (no canvas, no WebGL)
