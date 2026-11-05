import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setupPwa } from './pwa';
import { persistStorage } from './storage';
import { StoreProvider } from './state/store';
import { applyBoardTheme, loadBoardTheme } from './theme';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/400-italic.css';
import '@fontsource/lora/600.css';
import './styles/classical.css';
import './styles/app.css';

applyBoardTheme(loadBoardTheme());
setupPwa();
void persistStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
