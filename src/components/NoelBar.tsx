import { MENUS_FETES, MENUS_FETES_DATE_LIMITE, menusFetesActifs } from '../data/products';
import { formatPrice } from '../lib/format';

/** Bandeau de fin d'année, au-dessus de l'offre dégustation */
export default function NoelBar() {
  if (!menusFetesActifs()) return null;
  const prixMin = Math.min(...MENUS_FETES.map((m) => m.prix));
  return (
    <div className="bg-emerald-800 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5 text-center text-sm sm:px-6 lg:px-8">
        <p>
          🎄 <strong>Menus de Fêtes dès {formatPrice(prixMin)}/pers.</strong> — commandes jusqu'au {MENUS_FETES_DATE_LIMITE}
        </p>
        <a
          href="#fetes"
          className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-emerald-900 transition hover:bg-chaux"
        >
          Voir les menus
        </a>
      </div>
    </div>
  );
}
