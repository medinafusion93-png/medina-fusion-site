import { useCart } from '../hooks/useCart';

interface Props {
  id: string;
  label: string;
  /** Unité lue par les lecteurs d’écran (ex. "personnes") */
  unit?: string;
  size?: 'md' | 'lg';
}

/** Sélecteur +/- accessible au clavier, avec saisie directe */
export default function QuantityStepper({ id, label, unit, size = 'md' }: Props) {
  const { quantities, increment, decrement, setQuantity } = useCart();
  const qty = quantities[id] ?? 0;
  const btn =
    size === 'lg'
      ? 'h-11 w-11 text-xl'
      : 'h-10 w-10 text-lg';

  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Quantité — ${label}`}>
      <button
        type="button"
        onClick={() => decrement(id)}
        disabled={qty === 0}
        aria-label={`Retirer ${label}`}
        className={`${btn} flex items-center justify-center rounded-full border border-white/20 font-bold text-neutral-100 transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-30`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={999}
        value={qty}
        onChange={(e) => setQuantity(id, Number(e.target.value))}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={`Quantité ${label}${unit ? ` (${unit})` : ''}`}
        className={`w-12 rounded-lg border bg-transparent py-1 text-center text-base font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          qty > 0 ? 'border-gold text-gold-light' : 'border-transparent text-neutral-400'
        }`}
      />
      <button
        type="button"
        onClick={() => increment(id)}
        aria-label={`Ajouter ${label}`}
        className={`${btn} flex items-center justify-center rounded-full bg-gold font-bold text-ink transition hover:bg-gold-light`}
      >
        +
      </button>
    </div>
  );
}
