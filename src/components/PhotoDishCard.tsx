import { variantId } from '../data/products';
import { useCart } from '../hooks/useCart';
import { formatPrice } from '../lib/format';
import type { Product } from '../types';
import QuantityStepper from './QuantityStepper';
import SafeImage from './SafeImage';

/** Carte visuelle avec photo (plateaux repas), avec choix optionnel (viande / poulet, beignets…) */
export default function PhotoDishCard({ product }: { product: Product }) {
  const { quantities } = useCart();
  const ids = product.options ? product.options.choix.map((c) => variantId(product.id, c.id)) : [product.id];
  const totalQty = ids.reduce((s, id) => s + (quantities[id] ?? 0), 0);
  const active = totalQty > 0;

  return (
    <li
      className={`card flex flex-col overflow-hidden transition ${
        active ? 'border-gold/60 shadow-lg shadow-gold/10' : 'hover:border-white/20'
      }`}
    >
      <div className="relative">
        <SafeImage src={product.image} alt={product.nom} fallbackIcon="🍱" className="aspect-[4/3] w-full" />
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-ink/85 px-3 py-1 text-xs font-bold text-gold-light backdrop-blur">
            {product.badge}
          </span>
        )}
        {active && product.options && (
          <span className="absolute right-3 top-3 rounded-full bg-gold px-3 py-1 text-xs font-bold text-ink">
            {totalQty} au panier
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h4 className="font-display text-lg font-bold text-white">{product.nom}</h4>
        {product.description && (
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-neutral-300">{product.description}</p>
        )}

        {product.options ? (
          <>
            <p className="mt-4 text-xl font-bold text-gold">
              {formatPrice(product.prix)} <span className="text-xs font-medium text-neutral-400">HT</span>
            </p>
            <fieldset className="mt-3 rounded-xl border border-white/10 bg-ink/40 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gold-light">
                {product.options.label} au choix
              </legend>
              <ul className="space-y-2">
                {product.options.choix.map((c) => {
                  const id = variantId(product.id, c.id);
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3">
                      <span className={`text-sm ${quantities[id] ? 'font-semibold text-white' : 'text-neutral-200'}`}>
                        {c.nom.charAt(0).toUpperCase() + c.nom.slice(1)}
                      </span>
                      <QuantityStepper id={id} label={`${product.nom} ${c.nom}`} />
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          </>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xl font-bold text-gold">
              {formatPrice(product.prix)} <span className="text-xs font-medium text-neutral-400">HT</span>
            </span>
            <QuantityStepper id={product.id} label={product.nom} size="lg" />
          </div>
        )}
      </div>
    </li>
  );
}
