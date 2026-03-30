export interface Theme {
  background: string;
  backgroundGradient?: string;
  nodeBackground: string;
  nodeBorder: string;
  nodeShadow: string;
  edgeColor: string;
  particleColor: string;
  textColor: string;
  subtextColor: string;
  arrowColor: string;
  accentColors: string[];
  /** ノードの背景にblur効果を使うか */
  glass: boolean;
}

export const themes: Record<string, Theme> = {
  light: {
    background: '#f8f9fc',
    backgroundGradient: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(236,72,153,0.05) 0%, transparent 60%)',
    nodeBackground: 'rgba(255,255,255,0.85)',
    nodeBorder: 'rgba(0,0,0,0.08)',
    nodeShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
    edgeColor: '#cbd5e1',
    particleColor: '#6366f1',
    textColor: '#0f172a',
    subtextColor: '#94a3b8',
    arrowColor: '#94a3b8',
    accentColors: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'],
    glass: true,
  },
  dark: {
    background: '#0c0c14',
    backgroundGradient: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(236,72,153,0.06) 0%, transparent 60%)',
    nodeBackground: 'rgba(30,30,50,0.75)',
    nodeBorder: 'rgba(255,255,255,0.08)',
    nodeShadow: '0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)',
    edgeColor: '#334155',
    particleColor: '#818cf8',
    textColor: '#f1f5f9',
    subtextColor: '#64748b',
    arrowColor: '#475569',
    accentColors: ['#818cf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#22d3ee'],
    glass: true,
  },
};
