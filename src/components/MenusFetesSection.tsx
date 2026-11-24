import { MENUS_FETES, MENUS_FETES_DATE_LIMITE, menusFetesActifs } from '../data/products';
import { useReveal } from '../hooks/useReveal';
import FormuleCard from './FormuleCard';

/** Menus de fin d'année — particuliers et entreprises */
export default function MenusFetesSection() {
  const reveal = useReveal<HTMLElement>();
  if (!menusFetesActifs()) return null;
  return (
    <section id="fetes" ref={reveal.ref} aria-labelledby="fetes-titre" className={`scroll-mt-20 ${reveal.className}`}>
      <div className="mb-8 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-gold">Noël &amp; Réveillon</p>
        <h3 id="fetes-titre" className="section-title">
          Nos Menus de Fêtes
        </h3>
        <p className="mt-2 text-neutral-300">
          Pour vos repas de fin d'année, en famille ou entre collègues — prix par personne. Commandes jusqu'au{' '}
          <strong className="text-white">{MENUS_FETES_DATE_LIMITE}</strong>.
        </p>
      </div>
      <ul className="mx-auto grid max-w-4xl gap-6 pt-3 sm:grid-cols-2">
        {MENUS_FETES.map((f) => (
          <FormuleCard key={f.id} formule={f} />
        ))}
      </ul>
    </section>
  );
}
