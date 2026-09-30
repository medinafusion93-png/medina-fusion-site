/** Icônes au trait (remplacent les emojis pour un rendu plus sobre) */
const PATHS = {
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2 M9 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z M17 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
  mail: 'M4 6h16v12H4z M4 7l8 6 8-6',
  chat: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6l1-8Z',
  chef: 'M7 14h10v6H7z M7 14a4 4 0 1 1 1.3-7.8A4 4 0 0 1 15.7 6.2 4 4 0 1 1 17 14',
  truck: 'M3 6h11v9H3z M14 9h4l3 3v3h-7 M7 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M17 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.5a3.5 3.5 0 0 1 0 6.6 M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  check: 'M4 12.5 9.5 18 20 6.5',
  alert: 'M12 4 2.5 20h19L12 4Z M12 10v4.5 M12 17.2v.3',
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name].split(' M').map((d, i) => (
        <path key={i} d={i ? `M${d}` : d} />
      ))}
    </svg>
  );
}
