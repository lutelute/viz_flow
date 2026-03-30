import { useState } from 'react';
import { FlowCanvas } from './components/FlowCanvas';
import { templateList } from './templates';
import { themes } from './core/themes';
import './App.css';

function App() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [themeKey, setThemeKey] = useState<string>('light');

  const current = templateList[selectedIdx];
  const flow = {
    ...current.flow,
    config: { ...current.flow.config, theme: themeKey as 'dark' | 'light' },
  };
  const theme = themes[themeKey];

  return (
    <div className="app" style={{ background: theme.background, color: theme.textColor }}>
      <nav className="controls">
        <div className="template-tabs">
          {templateList.map((t, i) => (
            <button
              key={t.key}
              className={`tab ${i === selectedIdx ? 'active' : ''}`}
              onClick={() => setSelectedIdx(i)}
              style={{
                borderColor: i === selectedIdx ? theme.accentColors[0] : 'transparent',
                color: i === selectedIdx ? theme.textColor : theme.subtextColor,
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="theme-tabs">
          {Object.keys(themes).map((k) => (
            <button
              key={k}
              className={`tab tab-sm ${k === themeKey ? 'active' : ''}`}
              onClick={() => setThemeKey(k)}
              style={{
                borderColor: k === themeKey ? theme.accentColors[0] : 'transparent',
                color: k === themeKey ? theme.textColor : theme.subtextColor,
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </nav>

      <main className="canvas-container">
        <FlowCanvas flow={flow} />
      </main>

      <footer className="info" style={{ color: theme.subtextColor }}>
        viz_flow — templates/ にフロー定義を追加して使う
      </footer>
    </div>
  );
}

export default App;
