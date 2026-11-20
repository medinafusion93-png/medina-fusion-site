import { useCart } from '../hooks/useCart';

/** Bande d'offre tout en haut : dégustation offerte aux entreprises */
export default function OfferBar() {
  const { submit, status } = useCart();
  const loading = status.state === 'loading' && status.type === 'degustation';
  return (
    <div className="bg-gold text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5 text-center text-sm sm:px-6 lg:px-8">
        <p>
          <strong>Dégustation offerte aux entreprises</strong> : 5 places par mois. On vient faire goûter nos plats dans vos
          locaux.
        </p>
        <button
          type="button"
          onClick={() => void submit('degustation')}
          disabled={loading}
          className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-gold-dark transition hover:bg-chaux disabled:opacity-60"
        >
          {loading ? 'Envoi…' : 'Réserver ma dégustation'}
        </button>
      </div>
    </div>
  );
}
