import { useCart } from '../hooks/useCart';
import { formatPrice } from '../lib/format';
import type { Product } from '../types';
import QuantityStepper from './QuantityStepper';
import SafeImage from './SafeImage';

/** Ligne produit compacte (entrées, sandwichs, desserts, boissons…) */
export default function ProductCard({ product }: { product: Product }) {
  const { quantities } = useCart();
  const active = (quantities[product.id] ?? 0) > 0;

  return (
    <li
      className={`card flex items-center justify-between gap-3 p-3 pl-4 transition sm:p-4 ${
        active ? 'border-gold/60 bg-ink-700' : 'hover:border-white/20'
      }`}
    >
      {product.image && (
        <SafeImage src={product.image} alt={product.nom} className="h-16 w-16 shrink-0 rounded-xl sm:h-20 sm:w-20" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-white">{product.nom}</h4>
          {product.badge && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-light">
              {product.badge}
            </span>
          )}
        </div>
        {product.description && <p className="mt-0.5 text-sm text-neutral-300">{product.description}</p>}
        <p className="mt-1 text-sm">
          <span className="font-bold text-gold">{formatPrice(product.prix)}</span>
          {product.unite && <span className="text-neutral-400"> / {product.unite}</span>}
        </p>
      </div>
      <div className="shrink-0">
        <QuantityStepper id={product.id} label={product.nom} />
      </div>
    </li>
  );
}
