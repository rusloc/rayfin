import { createRoot } from 'react-dom/client';

import App from '@/App';
import { applyTheme, readTheme } from '@/components/theme';
import { AuthProvider } from '@/hooks/AuthContext';
import { bootstrapAuth } from '@/services/bootstrap';

import './main.css';

// Before the first paint (and before auth), so the remembered theme never flashes light.
applyTheme(readTheme(), false);

const authService = await bootstrapAuth();

createRoot(document.getElementById('root')!).render(
  <AuthProvider authService={authService}>
    <App />
  </AuthProvider>
);
