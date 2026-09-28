import { useCart } from '../hooks/useCart';
import { formatPrice } from '../lib/format';

/** Barre panier flottante (bas d’écran) — visible dès qu’un article est ajouté */
export default function CartBar() {
  const { count, total, ttc, submit, openWhatsApp, status } = useCart();
  const loading = status.state === 'loading' && status.type === 'commande';

  return (
    <>
      {/* Espace réservé pour que la barre ne masque pas le footer */}
      <div aria-hidden="true" className={count > 0 ? 'h-24' : 'h-0'} />
      <div
        className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-300 sm:px-6 ${
          count > 0 ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}
        aria-hidden={count === 0}
      >
        <div
          role="region"
          aria-label="Panier"
          className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-gold/50 bg-ink-800/95 p-3 shadow-2xl shadow-black/60 backdrop-blur sm:p-4"
        >
          <a href="#commande" className="flex min-w-0 flex-1 items-center gap-3" tabIndex={count ? 0 : -1}>
            <span className="relative text-2xl" aria-hidden="true">
              🛒
              <span className="absolute -right-2 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-ink">
                {count}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-neutral-300" aria-live="polite">
                {count} article{count > 1 ? 's' : ''}
              </span>
              <span className="block text-lg font-extrabold tabular-nums text-gold">
                {formatPrice(ttc)} <span className="text-xs font-semibold">TTC</span>
              </span>
              <span className="block text-xs tabular-nums text-neutral-400">{formatPrice(total)} HT</span>
            </span>
          </a>
          <button
            type="button"
            onClick={() => void submit('commande')}
            disabled={loading}
            tabIndex={count ? 0 : -1}
            className="btn-gold px-4"
          >
            <span aria-hidden="true">📧</span>
            <span className="hidden sm:inline">{loading ? 'Envoi…' : 'Email'}</span>
            <span className="sr-only sm:hidden">Envoyer la commande par email</span>
          </button>
          <button type="button" onClick={openWhatsApp} tabIndex={count ? 0 : -1} className="btn-whatsapp px-4">
            <span aria-hidden="true">💬</span>
            <span className="hidden sm:inline">WhatsApp</span>
            <span className="sr-only sm:hidden">Commander par WhatsApp</span>
          </button>
        </div>
      </div>
    </>
  );
}
