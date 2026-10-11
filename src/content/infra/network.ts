import type { Diagram } from '../../model/diagram';

// 手元の端末から VPN を通って研究室のサーバーに順に入る。粒子は「鍵」が「つながった通路（セッション）」に変わる。

export const network: Diagram = {
  id: 'network',
  title: '研究室のサーバーに入るまで',
  subtitle: '手元の端末は VPN の中継を通り、鍵認証でサーバーごとに通路を開く',
  lanes: [
    { id: 'local', label: '手元', tone: 'accent2', frame: 'band' },
    { id: 'lab', label: '研究室側', tone: 'accent1', frame: 'band' },
  ],
  nodes: [
    { id: 'laptop', kind: 'user', label: '端末', sublabel: 'ノート PC。秘密鍵を持つ', lane: 'local', col: 0 },
    { id: 'vpn', kind: 'tool', label: 'VPN の中継', sublabel: '暗号化した通路をつなぐ', lane: 'lab', col: 1, row: 1, emphasis: 'new' },
    { id: 'srv-a', kind: 'index', label: 'サーバー A', sublabel: '計算用', lane: 'lab', col: 2, row: 0 },
    { id: 'srv-b', kind: 'index', label: 'サーバー B', sublabel: 'GPU', lane: 'lab', col: 2, row: 1 },
    { id: 'srv-c', kind: 'index', label: 'サーバー C', sublabel: 'ファイル置き場', lane: 'lab', col: 2, row: 2 },
  ],
  edges: [
    { id: 'e-laptop-vpn', from: 'laptop', to: 'vpn', label: '公開鍵を登録済み', fromSide: 'bottom', toSide: 'left' },
    { id: 'e-vpn-a', from: 'vpn', to: 'srv-a', role: 'branch', branch: { group: 's', option: 'a' } },
    { id: 'e-vpn-b', from: 'vpn', to: 'srv-b', role: 'branch', branch: { group: 's', option: 'b' } },
    { id: 'e-vpn-c', from: 'vpn', to: 'srv-c', role: 'branch', branch: { group: 's', option: 'c' } },
  ],
  steps: [
    {
      n: 1,
      short: '鍵で入る',
      caption: '端末が秘密鍵で名乗り、VPN の中継につながる。パスワードは流れない',
      actions: [
        { type: 'travel', particle: 'k', edges: ['e-laptop-vpn'], payload: { kind: 'generic', label: '鍵' } },
        { type: 'dwell', particle: 'k', node: 'vpn', seconds: 0.6, label: '照合中' },
        {
          type: 'split',
          particle: 'k',
          at: 'vpn',
          into: [
            { particle: 'a', payload: { kind: 'plan', label: '通路', tone: 'accent1' } },
            { particle: 'b', payload: { kind: 'plan', label: '通路', tone: 'accent1' } },
            { particle: 'c', payload: { kind: 'plan', label: '通路', tone: 'accent1' } },
          ],
        },
      ],
    },
    {
      n: 2,
      short: 'A',
      caption: '中継がサーバー A への通路を開く',
      actions: [{ type: 'travel', particle: 'a', edges: ['e-vpn-a'], payload: { kind: 'plan', label: 'SSH', tone: 'accent1' } }],
    },
    {
      n: 3,
      short: 'B',
      caption: '続けてサーバー B にも。1 本の VPN 接続の上に通路は何本でも張れる',
      actions: [{ type: 'travel', particle: 'b', edges: ['e-vpn-b'], payload: { kind: 'plan', label: 'SSH', tone: 'accent1' } }],
    },
    {
      n: 4,
      short: 'C',
      caption: 'サーバー C にも。開いた通路はそのまま残る',
      actions: [
        { type: 'travel', particle: 'c', edges: ['e-vpn-c'], payload: { kind: 'plan', label: 'SSH', tone: 'accent1' } },
        { type: 'end', particle: 'a', mode: 'stay' },
        { type: 'end', particle: 'b', mode: 'stay' },
        { type: 'end', particle: 'c', mode: 'stay' },
      ],
      hold: 1.2,
    },
  ],
  sources: [],
};
