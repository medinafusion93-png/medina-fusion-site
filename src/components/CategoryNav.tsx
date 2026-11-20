import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { CATEGORIES } from '../data/products';
import { useCart } from '../hooks/useCart';

const LINKS = [
  { id: 'simulateur', label: 'Menu selon budget' },
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.titre })),
  { id: 'formules', label: 'Formules' },
    { id: 'faq', label: 'FAQ' },
];

/** Navigation rapide entre catégories — collante, la section en cours est surlignée */
export default function CategoryNav() {
  const [actif, setActif] = useState<string | null>(null);
  const { count } = useCart();

  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter((el): el is HTMLElement => !!el);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActif(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!actif) return;
    document.getElementById(`nav-${actif}`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [actif]);

  return (
    <nav aria-label="Catégories" className="sticky top-0 z-30 border-b border-white/10 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 pr-3 sm:pr-6 lg:pr-8">
      <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2 pl-4 [scrollbar-width:none] sm:pl-6 lg:pl-8">
        {LINKS.map((l) => (
          <li key={l.id} className="shrink-0">
            <a
              id={`nav-${l.id}`}
              href={`#${l.id}`}
              aria-current={actif === l.id ? 'true' : undefined}
              className={`relative inline-flex rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                actif === l.id ? 'text-white' : 'text-neutral-300 hover:text-white'
              }`}
            >
              {actif === l.id && (
                <motion.span
                  layoutId="nav-actif"
                  className="absolute inset-0 rounded-full bg-gold"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative">{l.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <a href="#commande" className="btn-gold shrink-0 px-4 py-2 text-sm">
        Commander
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-gold-dark"
          >
            {count}
          </motion.span>
        )}
      </a>
      </div>
    </nav>
  );
}
