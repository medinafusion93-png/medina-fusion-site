import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { OrderProvider } from './context/OrderProvider';
import { capturerRef } from './lib/prospection-ref';
import './index.css';

// Espace administrateur : chargé uniquement sur /admin (code séparé du site public)
const AdminApp = lazy(() => import('./admin/AdminApp'));
const Desinscription = lazy(() => import('./components/Desinscription'));
const MentionsLegales = lazy(() => import('./components/MentionsLegales'));
const chemin = window.location.pathname.replace(/\/+$/, '');
const isAdmin = chemin.startsWith('/admin');
const isDesinscription = chemin === '/desinscription';
const isLegal = chemin === '/mentions-legales';

capturerRef();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin || isDesinscription || isLegal ? (
      <Suspense fallback={null}>{isAdmin ? <AdminApp /> : isLegal ? <MentionsLegales /> : <Desinscription />}</Suspense>
    ) : (
      <OrderProvider>
        <App />
      </OrderProvider>
    )}
  </StrictMode>,
);
