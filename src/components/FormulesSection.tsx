import { FORMULES } from '../data/products';
import { useReveal } from '../hooks/useReveal';
import FormuleCard from './FormuleCard';

export default function FormulesSection() {
  const reveal = useReveal<HTMLElement>();
  return (
    <section id="formules" ref={reveal.ref} aria-labelledby="formules-titre" className={`scroll-mt-20 ${reveal.className}`}>
      <div className="mb-8 text-center">
        <h3 id="formules-titre" className="section-title">
          <span aria-hidden="true" className="mr-2">
            🎉
          </span>
          Nos Formules
        </h3>
        <p className="mt-2 text-neutral-300">Petit-déjeuner, brunch et buffets — prix par personne.</p>
      </div>
      <ul className="grid gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-3">
        {FORMULES.map((f) => (
          <FormuleCard key={f.id} formule={f} />
        ))}
      </ul>
    </section>
  );
}
