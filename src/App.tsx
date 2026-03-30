import { useState } from 'react';
import { FlowCanvas } from './components/FlowCanvas';
import { ComparisonGrid } from './components/ComparisonGrid';
import { templateList } from './templates';
import { ragArchitectures } from './templates/rag-architectures';
import { themes } from './core/themes';
import './App.css';

type View = 'single' | 'grid';

function App() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [themeKey, setThemeKey] = useState<string>('light');
  const [view, setView] = useState<View>('grid');

  const theme = themes[themeKey];
  const current = templateList[selectedIdx];
  const flow = {
    ...current.flow,
    config: { ...current.flow.config, theme: themeKey as 'dark' | 'light' },
  };

  return (
    <div className="app" style={{ background: theme.background, color: theme.textColor, backgroundImage: theme.backgroundGradient }}>
      <nav className="controls">
        {/* View toggle */}
        <div className="view-toggle">
          <button
            className={`toggle-btn ${view === 'grid' ? 'active' : ''}`}
            onClick={() => setView('grid')}
            style={{ color: view === 'grid' ? theme.textColor : theme.subtextColor }}
          >
            Grid Compare
          </button>
          <button
            className={`toggle-btn ${view === 'single' ? 'active' : ''}`}
            onClick={() => setView('single')}
            style={{ color: view === 'single' ? theme.textColor : theme.subtextColor }}
          >
            Single View
          </button>
        </div>

        {/* Template tabs (single view only) */}
        {view === 'single' && (
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
        )}

        {/* Theme */}
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
        {view === 'grid' ? (
          <div className="grid-wrapper">
            <h2 className="grid-title" style={{ color: theme.textColor }}>
              8 RAG Architectures
            </h2>
            <p className="grid-subtitle" style={{ color: theme.subtextColor }}>
              Same base structure — each variant highlights what's different
            </p>
            <ComparisonGrid
              items={ragArchitectures}
              theme={theme}
              themeKey={themeKey}
            />
          </div>
        ) : (
          <FlowCanvas flow={flow} />
        )}
      </main>
    </div>
  );
}

export default App;
