import { useCart } from '../hooks/useCart';
import { suggestions } from '../lib/suggestions';

/** Suggestions d’ajout dans le récapitulatif (boissons, desserts) */
export default function CartSuggestions() {
  const { lines, addMany } = useCart();
  const list = suggestions(lines);
  if (list.length === 0) return null;
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-gold/30 bg-gold/5 p-3" aria-label="Suggestions">
      <p className="text-xs font-semibold uppercase tracking-wider text-gold-light">Pensez-y</p>
      {list.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-neutral-200">{s.texte}</span>
          <button type="button" onClick={() => addMany(s.lignes)} className="btn-outline min-h-0 px-3 py-1.5 text-xs">
            {s.bouton}
          </button>
        </div>
      ))}
    </div>
  );
}
