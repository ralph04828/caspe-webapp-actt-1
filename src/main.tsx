import { createRoot } from 'react-dom/client';
import { initPwaUpdater } from './utils/pwaUpdate';
import App from './App.tsx';
import './index.css';

initPwaUpdater();

createRoot(document.getElementById('root')!).render(<App />);
