import { useState, useCallback } from 'react';
import { FlowCanvas } from './components/FlowCanvas';
import { ComparisonGrid } from './components/ComparisonGrid';
import { templateList } from './templates';
import { ragArchitectures } from './templates/rag-architectures';
import { themes } from './core/themes';
import { usePrefersReducedMotion, AnimationEnabledContext } from './core/a11y';
import './App.css';

type View = 'single' | 'grid';

function App() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [themeKey, setThemeKey] = useState<string>('light');
  const [view, setView] = useState<View>('grid');

  // アニメーション制御: OS設定を尊重 + UIトグル
  const prefersReduced = usePrefersReducedMotion();
  const [userAnimPref, setUserAnimPref] = useState<boolean | null>(null);
  const animationEnabled = userAnimPref ?? !prefersReduced;

  const toggleAnimation = useCallback(() => {
    setUserAnimPref((prev) => {
      if (prev === null) return prefersReduced ? true : false;
      return !prev;
    });
  }, [prefersReduced]);

  const theme = themes[themeKey];
  const current = templateList[selectedIdx];
  const flow = {
    ...current.flow,
    config: { ...current.flow.config, theme: themeKey as 'dark' | 'light' },
  };

  // キーボードでタブ間を矢印キーで移動
  const handleTabKeyDown = (
    e: React.KeyboardEvent,
    items: { length: number },
    currentIndex: number,
    setIndex: (i: number) => void,
  ) => {
    let next = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = (currentIndex + 1) % items.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = (currentIndex - 1 + items.length) % items.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = items.length - 1;
    } else {
      return;
    }
    setIndex(next);
  };

  const viewOptions: View[] = ['grid', 'single'];
  const viewIdx = viewOptions.indexOf(view);

  return (
    <AnimationEnabledContext.Provider value={animationEnabled}>
      <div className="app" style={{ background: theme.background, color: theme.textColor, backgroundImage: theme.backgroundGradient }}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>

        <nav className="controls" aria-label="Visualization controls">
          {/* View toggle */}
          <div className="view-toggle" role="tablist" aria-label="View mode">
            {viewOptions.map((v, i) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                tabIndex={view === v ? 0 : -1}
                className={`toggle-btn ${view === v ? 'active' : ''}`}
                onClick={() => setView(v)}
                onKeyDown={(e) => handleTabKeyDown(e, viewOptions, viewIdx, (idx) => setView(viewOptions[idx]))}
                style={{ color: view === v ? theme.textColor : theme.subtextColor }}
              >
                {v === 'grid' ? 'Grid Compare' : 'Single View'}
              </button>
            ))}
          </div>

          {/* Template tabs (single view only) */}
          {view === 'single' && (
            <div className="template-tabs" role="tablist" aria-label="Template selection">
              {templateList.map((t, i) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={i === selectedIdx}
                  tabIndex={i === selectedIdx ? 0 : -1}
                  className={`tab ${i === selectedIdx ? 'active' : ''}`}
                  onClick={() => setSelectedIdx(i)}
                  onKeyDown={(e) => handleTabKeyDown(e, templateList, selectedIdx, setSelectedIdx)}
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

          <div className="control-right">
            {/* Animation toggle */}
            <button
              className="toggle-btn anim-toggle"
              onClick={toggleAnimation}
              aria-pressed={animationEnabled}
              aria-label={animationEnabled ? 'Pause animations' : 'Play animations'}
              style={{ color: theme.subtextColor }}
              title={animationEnabled ? 'Pause animations' : 'Play animations'}
            >
              {animationEnabled ? '⏸' : '▶'}
            </button>

            {/* Theme */}
            <div className="theme-tabs" role="tablist" aria-label="Theme selection">
              {Object.keys(themes).map((k, i, arr) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={k === themeKey}
                  tabIndex={k === themeKey ? 0 : -1}
                  className={`tab tab-sm ${k === themeKey ? 'active' : ''}`}
                  onClick={() => setThemeKey(k)}
                  onKeyDown={(e) => handleTabKeyDown(e, arr, arr.indexOf(themeKey), (idx) => setThemeKey(arr[idx]))}
                  style={{
                    borderColor: k === themeKey ? theme.accentColors[0] : 'transparent',
                    color: k === themeKey ? theme.textColor : theme.subtextColor,
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <main id="main-content" className="canvas-container">
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
    </AnimationEnabledContext.Provider>
  );
}

export default App;
