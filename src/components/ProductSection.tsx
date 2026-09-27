import { useReveal } from '../hooks/useReveal';
import type { ProductCategory } from '../types';
import PhotoDishCard from './PhotoDishCard';
import ProductCard from './ProductCard';

export default function ProductSection({ category }: { category: ProductCategory }) {
  const reveal = useReveal<HTMLElement>();
  const headingId = `${category.id}-titre`;

  return (
    <section id={category.id} ref={reveal.ref} aria-labelledby={headingId} className={`scroll-mt-20 ${reveal.className}`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-gold/20 pb-3">
        <h3 id={headingId} className="section-title">
          <span aria-hidden="true" className="mr-2">
            {category.icon}
          </span>
          {category.titre}
        </h3>
        {category.sousTitre && <p className="text-sm font-medium text-gold-light/90">{category.sousTitre}</p>}
      </div>

      {category.layout === 'photo' ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {category.produits.map((p) => (
            <PhotoDishCard key={p.id} product={p} />
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {category.produits.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ul>
      )}
    </section>
  );
}
