import { LegacyApp } from './LegacyApp';
import { App as NewApp } from './app/App';

const legacy = new URLSearchParams(window.location.search).get('legacy') === '1';

function App() {
  return legacy ? <LegacyApp /> : <NewApp />;
}

export default App;
