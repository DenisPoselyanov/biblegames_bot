import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { DEFAULT_COSMETIC_THEME_ID } from './data/cosmetics';
import { applyCosmeticThemeById } from './lib/cosmeticTheme';
import { installErrorReporter } from './lib/errorReporter';
import 'react-vant/lib/index.css';
import './index.css';

// Safe frontend error reporting (Phase 2 §20) — route + build version + code only.
installErrorReporter();

// Pre-paint default so there's no flash before the profile store hydrates and
// <CosmeticThemeSync/> applies the player's actual theme.
applyCosmeticThemeById(DEFAULT_COSMETIC_THEME_ID);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
