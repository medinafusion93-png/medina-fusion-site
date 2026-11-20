import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../hooks/useCart';

interface Props {
  id: string;
  label: string;
  /** Unité lue par les lecteurs d’écran (ex. "personnes") */
  unit?: string;
  size?: 'md' | 'lg';
}

/** « Ajouter », puis sélecteur −/+ animé avec saisie directe */
export default function QuantityStepper({ id, label, unit, size = 'md' }: Props) {
  const { quantities, increment, decrement, setQuantity } = useCart();
  const qty = quantities[id] ?? 0;
  const btn = size === 'lg' ? 'h-11 w-11 text-xl' : 'h-10 w-10 text-lg';

  return (
    <div className="flex min-h-11 items-center justify-end" role="group" aria-label={`Quantité — ${label}`}>
      <AnimatePresence initial={false} mode="popLayout">
        {qty === 0 ? (
          <motion.button
            key="ajouter"
            type="button"
            onClick={() => increment(id)}
            aria-label={`Ajouter ${label}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            whileTap={{ scale: 0.94 }}
            className="h-10 rounded-full border-2 border-gold px-5 text-sm font-bold text-gold-light transition-colors hover:bg-gold hover:text-white"
          >
            Ajouter
          </motion.button>
        ) : (
          <motion.div
            key="qty"
            className="flex items-center gap-1 rounded-full bg-gold p-1"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => decrement(id)}
              aria-label={`Retirer ${label}`}
              className={`${btn} flex items-center justify-center rounded-full font-bold text-white transition-colors hover:bg-white/20`}
            >
              −
            </motion.button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={qty}
              onChange={(e) => setQuantity(id, Number(e.target.value))}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={`Quantité ${label}${unit ? ` (${unit})` : ''}`}
              className="w-10 bg-transparent text-center text-base font-bold tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => increment(id)}
              aria-label={`Ajouter un de plus : ${label}`}
              className={`${btn} flex items-center justify-center rounded-full bg-white font-bold text-gold-dark transition-colors hover:bg-chaux`}
            >
              +
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
