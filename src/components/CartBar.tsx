import { AnimatePresence, animate, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '../hooks/useCart';
import { formatPrice } from '../lib/format';
import Icon from './Icon';

/** Montant qui défile jusqu’à sa nouvelle valeur */
function AnimatedPrice({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v * 100) / 100),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return <>{formatPrice(shown)}</>;
}

/** Barre panier flottante (bas d’écran) — visible dès qu’un article est ajouté */
export default function CartBar() {
  const { count, total, ttc, submit, openWhatsApp, status } = useCart();
  const loading = status.state === 'loading' && status.type === 'commande';

  return (
    <>
      {/* Espace réservé pour que la barre ne masque pas le footer */}
      <div aria-hidden="true" className={count > 0 ? 'h-24' : 'h-0'} />
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            key="cartbar"
            className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
            initial={{ y: '120%' }}
            animate={{ y: 0 }}
            exit={{ y: '120%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div
              role="region"
              aria-label="Panier"
              className="mx-auto flex max-w-3xl items-center gap-3 rounded-full border border-gold bg-ink-800/95 p-2 pl-5 shadow-2xl shadow-black/60 backdrop-blur"
            >
              <a href="#commande" className="flex min-w-0 flex-1 items-center gap-3">
                <span className="relative text-gold" aria-hidden="true">
                  <Icon name="cart" className="h-7 w-7" />
                  <motion.span
                    key={count}
                    initial={{ scale: 1.6 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-2 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-xs font-bold text-white"
                  >
                    {count}
                  </motion.span>
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-2xl font-extrabold leading-none tabular-nums text-gold">
                    <AnimatedPrice value={ttc} /> <span className="font-sans text-xs font-semibold">TTC</span>
                  </span>
                  <span className="block text-xs tabular-nums text-neutral-400" aria-live="polite">
                    {count} article{count > 1 ? 's' : ''}, {formatPrice(total)} HT
                  </span>
                </span>
              </a>
              <button type="button" onClick={() => void submit('commande')} disabled={loading} className="btn-gold px-4">
                <Icon name="mail" />
                <span className="hidden sm:inline">{loading ? 'Envoi…' : 'Commander'}</span>
                <span className="sr-only sm:hidden">Envoyer la commande par email</span>
              </button>
              <button type="button" onClick={openWhatsApp} className="btn-whatsapp px-4">
                <Icon name="chat" />
                <span className="hidden sm:inline">WhatsApp</span>
                <span className="sr-only sm:hidden">Commander par WhatsApp</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
