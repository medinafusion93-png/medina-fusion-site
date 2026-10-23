import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DossierStatus, QuoteStatus, SequenceState, StepStatus } from './types';
import { NEED_LABEL, type Need } from '../supabase/functions/_shared/logic.ts';

export const D_LABEL: Record<DossierStatus, string> = {
  nouvelle: 'Nouvelle', attente_infos: 'Infos manquantes', a_chiffrer: 'À chiffrer', devis_envoye: 'Devis envoyé',
  gagne: 'Devis accepté', perdu: 'Perdu', clos: 'Clos',
};
const D_TONE: Record<DossierStatus, string> = { nouvelle: 'blue', attente_infos: 'warn', a_chiffrer: '', devis_envoye: 'sim', gagne: 'ok', perdu: '', clos: '' };
export const Q_LABEL: Record<QuoteStatus, string> = {
  a_preparer: 'À préparer', envoye: 'Envoyé', en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé', expire: 'Expiré',
};
const Q_TONE: Record<QuoteStatus, string> = { a_preparer: '', envoye: 'blue', en_attente: 'warn', accepte: 'ok', refuse: 'crit', expire: '' };
export const Q_OPEN: QuoteStatus[] = ['envoye', 'en_attente'];
export const STEP_LABEL: Record<StepStatus, string> = {
  a_valider: 'À valider', programmee: 'Programmée', envoi: 'Envoi en cours', envoyee: 'Envoyée', annulee: 'Annulée', echec: 'Échec',
};
const SEQ: Record<SequenceState, [string, string]> = { active: ['Active', 'blue'], suspendue: ['Suspendue', 'warn'], arretee: ['Arrêtée', ''], terminee: ['Terminée', 'ok'] };
export const ROLE_LABEL = { admin: 'Administrateur', gestion: 'Gestion', lecture: 'Lecture seule' } as const;

export const DPill = ({ s }: { s: DossierStatus }) => <span className={`pill ${D_TONE[s]}`}>{D_LABEL[s]}</span>;
export const QPill = ({ s }: { s: QuoteStatus }) => <span className={`pill ${Q_TONE[s]}`}>{Q_LABEL[s]}</span>;
export const SeqPill = ({ s }: { s: SequenceState }) => <span className={`pill ${SEQ[s][1]}`}>{SEQ[s][0]}</span>;
export const NeedChip = ({ n }: { n: Need | '' }) => <span className="chip">{n ? NEED_LABEL[n] : 'À qualifier'}</span>;

export const eur = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
export const fDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fDT = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
export const dur = (ms: number) => {
  const h = ms / 3600e3;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))} min`;
  if (h < 48) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${hh} h${mm ? ` ${String(mm).padStart(2, '0')}` : ''}`; }
  return `${Math.round(h / 24)} j`;
};
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const daysLeft = (iso: string) => Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86400e3);

export function Modal({ title, children, footer, onClose }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h"><h2>{title}</h2><button className="btn ghost sm" onClick={onClose} aria-label="Fermer">✕</button></div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

interface ToastItem { id: number; msg: string; err?: boolean }
const ToastCtx = createContext<(msg: string, err?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((msg: string, err?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, msg, err }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast${t.err ? ' err' : ''}`}>{t.msg}</div>)}</div>
    </ToastCtx.Provider>
  );
}

/** Exécute une action et affiche le résultat ou l'erreur */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e) { toast(e instanceof Error ? e.message : String(e), true); return false; } finally { setBusy(false); }
  }, [toast]);
  return { busy, run };
}

const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
  requests: 'M4 4h16v12H5.2L4 17.2zM8 9h8M8 12h5',
  quotes: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h7M9 17h7',
  followups: 'M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  flame: 'M12 22c4 0 7-3 7-7 0-3-2-5.5-3.5-7.5-.5 2-1.5 3-3 3.5C13 7.5 12 4.5 9.5 2 9.5 6 5 9 5 15c0 4 3 7 7 7z',
  plus: 'M12 5v14M5 12h14',
  chev: 'm9 6 6 6-6 6',
};
export const Icon = ({ n, s = 18 }: { n: keyof typeof ICONS | string; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[n] ?? ''} />
  </svg>
);
