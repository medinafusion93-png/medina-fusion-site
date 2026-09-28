import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { OrderProvider } from './context/OrderProvider';
import './index.css';

// Espace administrateur : chargé uniquement sur /admin (code séparé du site public)
const AdminApp = lazy(() => import('./admin/AdminApp'));
const isAdmin = window.location.pathname.replace(/\/+$/, '').startsWith('/admin');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <OrderProvider>
        <App />
      </OrderProvider>
    )}
  </StrictMode>,
);
