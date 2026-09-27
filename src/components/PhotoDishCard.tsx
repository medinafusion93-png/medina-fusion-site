import { useCart } from '../hooks/useCart';
import { formatPrice } from '../lib/format';
import type { Product } from '../types';
import QuantityStepper from './QuantityStepper';
import SafeImage from './SafeImage';

/** Carte visuelle avec photo (plateaux repas) */
export default function PhotoDishCard({ product }: { product: Product }) {
  const { quantities } = useCart();
  const active = (quantities[product.id] ?? 0) > 0;

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
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h4 className="font-display text-lg font-bold text-white">{product.nom}</h4>
        {product.description && (
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-neutral-300">{product.description}</p>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xl font-bold text-gold">{formatPrice(product.prix)}</span>
          <QuantityStepper id={product.id} label={product.nom} size="lg" />
        </div>
      </div>
    </li>
  );
}
