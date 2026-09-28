import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { paiementInfo, statutInfo, type PaiementStatut, type Statut } from './types';

export const inputCls =
  'w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-base text-white placeholder:text-neutral-500 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold [color-scheme:dark]';

export function Field({ label, id, children, className = '' }: { label: string; id: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-neutral-300">
        {label}
      </label>
      {children}
    </div>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className ?? ''}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...p} className={`${inputCls} ${p.className ?? ''}`} />
);
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${inputCls} ${p.className ?? ''}`} />;

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-ink-800 p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function StatutBadge({ statut }: { statut: Statut }) {
  const s = statutInfo(statut);
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>{s.label}</span>;
}

export function PaiementBadge({ statut }: { statut: PaiementStatut }) {
  const p = paiementInfo(statut);
  return <span className={`whitespace-nowrap text-xs font-semibold ${p.color}`}>● {p.label}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-neutral-400">{children}</p>;
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-10 text-neutral-300">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden="true" />
      {label}
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const dateLongFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "2026-10-02" → "ven. 2 oct." */
export const fmtDate = (iso: string | null, long = false) => {
  if (!iso) return 'Date à définir';
  const [y, m, d] = iso.split('-').map(Number);
  return (long ? dateLongFmt : dateFmt).format(new Date(y!, m! - 1, d!));
};
