import { App as Shell } from './app/App';
import { ExportRoute } from './app/ExportRoute';

const params = new URLSearchParams(window.location.search);

function App() {
  if (params.get('export') === '1') return <ExportRoute />;
  return <Shell />;
}

export default App;
