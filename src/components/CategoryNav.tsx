import { CATEGORIES } from '../data/products';

const LINKS = [
  ...CATEGORIES.map((c) => ({ href: `#${c.id}`, label: c.titre, icon: c.icon })),
  { href: '#formules', label: 'Formules', icon: '🎉' },
  { href: '#commande', label: 'Commander', icon: '📝' },
];

/** Navigation rapide entre catégories — collante, défilement horizontal sur mobile */
export default function CategoryNav() {
  return (
    <nav aria-label="Catégories" className="sticky top-0 z-30 border-b border-white/10 bg-ink/90 backdrop-blur">
      <ul className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6 lg:px-8 [&>li:first-child]:ml-auto [&>li:last-child]:mr-auto">
        {LINKS.map((l) => (
          <li key={l.href} className="shrink-0">
            <a
              href={l.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-sm text-neutral-200 transition hover:border-gold hover:text-gold-light"
            >
              <span aria-hidden="true">{l.icon}</span>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
