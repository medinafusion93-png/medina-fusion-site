import { CONTACT } from '../data/config';

const ITEMS = [
  { icon: '⚡', label: 'Commande Instantanée' },
  { icon: '👨‍🍳', label: 'Fait Maison' },
  { icon: '🚚', label: 'Livraison Privilège' },
  { icon: '👥', label: `Dès ${CONTACT.minPersonnesLivraison} Personnes` },
];

export default function Highlights() {
  return (
    <section aria-label="Nos points forts" className="border-y border-gold/20 bg-ink-800">
      <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-px bg-gold/10 sm:grid-cols-4">
        {ITEMS.map((it) => (
          <li key={it.label} className="flex items-center justify-center gap-2 bg-ink-800 px-3 py-4 text-center">
            <span className="text-xl" aria-hidden="true">
              {it.icon}
            </span>
            <span className="text-sm font-semibold text-gold-light">{it.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
