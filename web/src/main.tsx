import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource-variable/sora';
import './styles.css';
import { App } from './App';
import { queryClient } from './lib/query';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/toast';

// La démo statique (GitHub Pages) utilise un routage par ancre : aucun serveur requis.
const Router = import.meta.env.VITE_DEMO === '1' ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
