import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import './i18n';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { initAmharicHyphenHotSwap } from '@/utils/amharicPatternHotSwap';

// Fire and forget pattern hot-swap (optional, gated by localStorage flag)
initAmharicHyphenHotSwap().catch(() => { });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
