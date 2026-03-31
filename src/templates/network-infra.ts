import type { FlowDefinition } from '../core/types';

/**
 * JS パーティクルエンジンのデモテンプレート
 * ネットワークインフラ: Client → VPN → 3サーバーに順番にSSH接続
 */
export const networkInfra: FlowDefinition = {
  nodes: [
    { id: 'client',   label: 'Client',   x: 80,  y: 200, icon: 'terminal', color: '#818cf8', width: 28 },
    { id: 'vpn',      label: 'VPN Hub',  x: 250, y: 200, icon: 'lock',     color: '#a78bfa', width: 26 },
    { id: 'server-a', label: 'Server A', x: 450, y: 80,  icon: 'server',   color: '#34d399', width: 24 },
    { id: 'server-b', label: 'Server B', x: 450, y: 200, icon: 'cpu',      color: '#22d3ee', width: 24 },
    { id: 'server-c', label: 'Server C', x: 450, y: 320, icon: 'database', color: '#fbbf24', width: 24 },
  ],
  edges: [
    { id: 'e1', from: 'client', to: 'vpn',      color: '#a78bfa' },
    { id: 'e2', from: 'vpn',    to: 'server-a', color: '#34d399' },
    { id: 'e3', from: 'vpn',    to: 'server-b', color: '#22d3ee' },
    { id: 'e4', from: 'vpn',    to: 'server-c', color: '#fbbf24' },
  ],
  particleGroups: [
    {
      id: 'ssh-connections',
      pauseDuration: 3,
      balls: [
        {
          waypoints: ['client', 'vpn', 'server-a'],
          color: '#34d399', label: 'SSH', delay: 0, travel: 2,
          coreRadius: 5, outerRadius: 12,
        },
        {
          waypoints: ['client', 'vpn', 'server-b'],
          color: '#22d3ee', label: 'SSH', delay: 1.2, travel: 1.5,
          coreRadius: 5, outerRadius: 12,
        },
        {
          waypoints: ['client', 'vpn', 'server-c'],
          color: '#fbbf24', label: 'SSH', delay: 2.4, travel: 2,
          coreRadius: 5, outerRadius: 12,
        },
      ],
    },
  ],
  config: {
    title: 'Network Infrastructure',
    subtitle: 'Client → VPN → Compute Cluster',
    width: 560,
    height: 400,
    theme: 'dark',
    particleMode: 'js',
    showLabels: true,
  },
};
