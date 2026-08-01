import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { MotionProvider } from './components/motion/MotionProvider';
import { DEFAULT_COSMETIC_THEME_ID } from './data/cosmetics';
import { applyCosmeticThemeById } from './lib/cosmeticTheme';
import { queryClient } from './lib/queryClient';
import 'react-vant/lib/index.css';
import './index.css';

applyCosmeticThemeById(DEFAULT_COSMETIC_THEME_ID);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <App />
      </MotionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
