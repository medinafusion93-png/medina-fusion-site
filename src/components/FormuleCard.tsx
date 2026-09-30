import { useCart } from '../hooks/useCart';
import { formatPrice } from '../lib/format';
import type { Formule } from '../types';
import QuantityStepper from './QuantityStepper';

export default function FormuleCard({ formule }: { formule: Formule }) {
  const { quantities } = useCart();
  const persons = quantities[formule.id] ?? 0;
  const economie = formule.prixBarre - formule.prix;

  return (
    <li
      className={`relative flex flex-col rounded-2xl border p-5 transition ${
        formule.highlight
          ? 'border-gold bg-gradient-to-b from-gold/15 to-ink-800 shadow-xl shadow-gold/15'
          : 'border-white/10 bg-ink-800 hover:border-white/20'
      } ${persons > 0 ? 'ring-1 ring-gold' : ''}`}
    >
      {formule.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-3 py-1 text-xs font-extrabold text-ink">
          {formule.badge}
        </span>
      )}
      <h4 className="mt-1 font-display text-xl font-bold text-white">{formule.nom}</h4>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-gold">{formatPrice(formule.prix)}</span>
        <span className="text-sm text-neutral-300">HT /pers.</span>
        <s className="text-sm text-neutral-400" aria-label={`au lieu de ${formatPrice(formule.prixBarre)}`}>
          {formatPrice(formule.prixBarre)}
        </s>
      </div>
      <p className="mt-1 text-sm font-semibold text-emerald-400">
        Vous économisez {formatPrice(economie)} par personne
      </p>
      <p className="mt-1 text-xs uppercase tracking-wider text-neutral-300">
        Minimum {formule.minPersonnes} personnes
      </p>

      {formule.contenu.length > 0 && (
        <ul className="mt-4 flex-1 space-y-1.5 text-sm text-neutral-200">
          {formule.contenu.map((c) => (
            <li key={c} className="flex gap-2">
              <span className="text-gold" aria-hidden="true">
                ✓
              </span>
              {c}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <span className="text-sm text-neutral-300">
          {persons > 0 ? (
            <>
              <strong className="text-white">{persons} pers.</strong> · {formatPrice(persons * formule.prix)} HT
            </>
          ) : (
            'Nombre de personnes'
          )}
        </span>
        <QuantityStepper id={formule.id} label={formule.nom} unit="personnes" />
      </div>
    </li>
  );
}
