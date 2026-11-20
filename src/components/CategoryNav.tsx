import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { CATEGORIES } from '../data/products';

const LINKS = [
  { id: 'simulateur', label: 'Menu selon budget' },
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.titre })),
  { id: 'formules', label: 'Formules' },
  { id: 'commande', label: 'Commander' },
  { id: 'faq', label: 'FAQ' },
];

/** Navigation rapide entre catégories — collante, la section en cours est surlignée */
export default function CategoryNav() {
  const [actif, setActif] = useState<string | null>(null);

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
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 lg:px-8">
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
    </nav>
  );
}
