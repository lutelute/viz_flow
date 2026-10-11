import { LegacyApp } from './LegacyApp';
import { App as NewApp } from './app/App';
import { ExportRoute } from './app/ExportRoute';

const params = new URLSearchParams(window.location.search);

function App() {
  if (params.get('legacy') === '1') return <LegacyApp />;
  if (params.get('export') === '1') return <ExportRoute />;
  return <NewApp />;
}

export default App;
