import { FlowCanvas } from './FlowCanvas';
import type { FlowDefinition } from '../core/types';
import type { Theme } from '../core/themes';

interface Props {
  items: { name: string; key: string; flow: FlowDefinition }[];
  theme: Theme;
  themeKey: string;
}

/**
 * 全フローを2x4グリッドで一覧表示
 * 各カードは同じサイズにスケーリング
 */
export function ComparisonGrid({ items, theme, themeKey }: Props) {
  return (
    <div className="comparison-grid">
      {items.map((item) => {
        const flow: FlowDefinition = {
          ...item.flow,
          config: {
            ...item.flow.config,
            theme: themeKey as 'dark' | 'light',
          },
        };

        // グリッド用にスケーリング
        const scale = 0.85;
        const w = flow.config.width * scale;
        const h = flow.config.height * scale;

        return (
          <div key={item.key} className="comparison-card" style={{ borderColor: theme.nodeBorder }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: flow.config.width, height: flow.config.height }}>
              <FlowCanvas flow={flow} />
            </div>
            <div className="card-overlay" style={{ width: w, height: h }} />
          </div>
        );
      })}
    </div>
  );
}
