import { LegacyApp } from './LegacyApp';

const params = new URLSearchParams(window.location.search);
const legacy = params.get('legacy') === '1';

function App() {
  if (legacy) return <LegacyApp />;
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '48px 24px', maxWidth: 640, margin: '0 auto', lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>動く図解（作り直し中）</h1>
      <p style={{ margin: 0 }}>新しい版はここに載せる。旧版は <a href="?legacy=1">?legacy=1</a> で開ける。</p>
    </main>
  );
}

export default App;
