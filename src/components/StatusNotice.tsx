import { useEffect, useRef } from 'react';
import { CONTACT } from '../data/config';
import { useCart } from '../hooks/useCart';

/** Retour utilisateur après envoi : chargement, succès, fallback mailto, champs manquants */
export default function StatusNotice() {
  const { status, resetStatus } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  const isDialog = status.state === 'success' || status.state === 'fallback';

  useEffect(() => {
    if (isDialog) closeRef.current?.focus();
    if (status.state === 'invalid') {
      const t = setTimeout(resetStatus, 6000);
      return () => clearTimeout(t);
    }
  }, [status, isDialog, resetStatus]);

  useEffect(() => {
    if (!isDialog) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && resetStatus();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDialog, resetStatus]);

  if (status.state === 'idle') return <div aria-live="polite" className="sr-only" />;

  if (status.state === 'loading' || status.state === 'invalid') {
    return (
      <div aria-live="polite" className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div
          role={status.state === 'invalid' ? 'alert' : 'status'}
          className={`flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${
            status.state === 'invalid'
              ? 'border-amber-400/60 bg-amber-950/95 text-amber-100'
              : 'border-gold/50 bg-ink-800/95 text-neutral-100'
          }`}
        >
          {status.state === 'loading' ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden="true" />
              {status.type === 'degustation' ? 'Envoi de votre demande…' : 'Envoi de votre commande…'}
            </>
          ) : (
            <>
              <span aria-hidden="true">⚠️</span>
              <span className="flex-1">{status.message}</span>
              <button type="button" onClick={resetStatus} aria-label="Fermer" className="px-1 text-lg leading-none">
                ×
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const success = status.state === 'success';
  const degustation = status.type === 'degustation';
  const title = success
    ? degustation
      ? 'Demande de dégustation envoyée !'
      : 'Commande envoyée !'
    : 'Un souci technique est survenu';
  const body = success
    ? degustation
      ? 'Merci ! Nous vous recontactons très vite pour organiser votre dégustation gratuite.'
      : 'Commande envoyée, vous recevrez une confirmation par email.'
    : 'Votre client mail va s’ouvrir à la place avec votre demande pré-remplie : il vous suffit de cliquer sur « Envoyer ».';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={resetStatus}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-title"
        aria-describedby="status-body"
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-md p-6 text-center shadow-2xl"
      >
        <div className="text-5xl" aria-hidden="true">
          {success ? '✅' : '📨'}
        </div>
        <h2 id="status-title" className="mt-3 font-display text-2xl font-bold text-gold-light">
          {title}
        </h2>
        <p id="status-body" className="mt-2 text-neutral-200">
          {body}
        </p>
        {!success && (
          <p className="mt-3 text-sm text-neutral-300">
            Rien ne s’ouvre ? Écrivez-nous à{' '}
            <a className="text-gold underline" href={`mailto:${CONTACT.email}`}>
              {CONTACT.email}
            </a>{' '}
            ou sur WhatsApp au {CONTACT.whatsappAffiche}.
          </p>
        )}
        <button ref={closeRef} type="button" onClick={resetStatus} className="btn-gold mt-6 w-full">
          Fermer
        </button>
      </div>
    </div>
  );
}
