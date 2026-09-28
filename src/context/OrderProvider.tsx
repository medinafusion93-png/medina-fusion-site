import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ORDERABLES } from '../data/products';
import { clamp, step, toLines, totals, type Quantities } from '../lib/cart';
import { buildPayload, mailtoUrl, postToWebhook, whatsappUrl } from '../lib/order';
import { validate, type FieldErrors } from '../lib/validation';
import type { CartLine, CustomerInfo, OrderType, SubmitStatus } from '../types';

const STORAGE_KEY = 'mf-cart-v1';

const EMPTY_INFO: CustomerInfo = {
  entreprise: '',
  contact: '',
  email: '',
  tel: '',
  date: '',
  heure: '',
  adresse: '',
  parrain: '',
  notes: '',
};

export interface OrderContextValue {
  quantities: Quantities;
  lines: CartLine[];
  count: number;
  /** Montant HT */
  total: number;
  tva: number;
  ttc: number;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  setQuantity: (id: string, value: number) => void;
  clearCart: () => void;

  info: CustomerInfo;
  setField: (field: keyof CustomerInfo, value: string) => void;
  errors: FieldErrors;

  status: SubmitStatus;
  resetStatus: () => void;
  submit: (type: OrderType) => Promise<void>;
  openWhatsApp: () => void;
}

export const OrderContext = createContext<OrderContextValue | null>(null);

function loadQuantities(): Quantities {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Quantities = {};
    for (const [id, q] of Object.entries(parsed)) {
      const item = ORDERABLES.get(id);
      if (item && typeof q === 'number') {
        const v = clamp(q, item.min);
        if (v > 0) out[id] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

const FORM_ID = 'commande';

function focusForm(errors: FieldErrors) {
  const first = Object.keys(errors)[0];
  const el = first ? document.getElementById(`field-${first}`) : null;
  document.getElementById(FORM_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (el instanceof HTMLElement) setTimeout(() => el.focus({ preventScroll: true }), 400);
}

export function OrderProvider({ children }: { children: ReactNode }) {
  const [quantities, setQuantities] = useState<Quantities>(loadQuantities);
  const [info, setInfo] = useState<CustomerInfo>(EMPTY_INFO);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>({ state: 'idle' });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quantities));
    } catch {
      /* stockage indisponible : le panier reste en mémoire */
    }
  }, [quantities]);

  const update = useCallback((id: string, fn: (current: number, min?: number) => number) => {
    const item = ORDERABLES.get(id);
    if (!item) return;
    setQuantities((prev) => {
      const next = fn(prev[id] ?? 0, item.min);
      const copy = { ...prev };
      if (next > 0) copy[id] = next;
      else delete copy[id];
      return copy;
    });
  }, []);

  const increment = useCallback((id: string) => update(id, (c, min) => step(c, 1, min)), [update]);
  const decrement = useCallback((id: string) => update(id, (c, min) => step(c, -1, min)), [update]);
  const setQuantity = useCallback(
    (id: string, value: number) => update(id, (_c, min) => clamp(value, min)),
    [update],
  );
  const clearCart = useCallback(() => setQuantities({}), []);

  const lines = useMemo(() => toLines(quantities, ORDERABLES), [quantities]);
  const { count, total, tva, ttc } = useMemo(() => totals(lines), [lines]);

  const setField = useCallback((field: keyof CustomerInfo, value: string) => {
    setInfo((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  }, []);

  const submit = useCallback(
    async (type: OrderType) => {
      if (status.state === 'loading') return;
      if (type === 'commande' && lines.length === 0) {
        setStatus({ state: 'invalid', message: 'Votre panier est vide : ajoutez au moins un article.' });
        document.getElementById('carte')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      const errs = validate(info, type);
      setErrors(errs);
      if (Object.keys(errs).length > 0) {
        setStatus({
          state: 'invalid',
          message:
            type === 'degustation'
              ? 'Pour demander une dégustation, indiquez votre entreprise et un email ou un téléphone.'
              : 'Merci de compléter les champs indiqués.',
        });
        focusForm(errs);
        return;
      }

      const payload = buildPayload(info, type === 'commande' ? lines : [], type === 'commande' ? total : 0, type);
      setStatus({ state: 'loading', type });
      const ok = await postToWebhook(payload);
      if (ok) {
        setStatus({ state: 'success', type });
        if (type === 'commande') setQuantities({});
      } else {
        setStatus({ state: 'fallback', type });
        window.location.href = mailtoUrl(payload);
      }
    },
    [info, lines, total, status.state],
  );

  const openWhatsApp = useCallback(() => {
    if (lines.length === 0) {
      setStatus({ state: 'invalid', message: 'Votre panier est vide : ajoutez au moins un article.' });
      return;
    }
    const payload = buildPayload(info, lines, total, 'commande');
    window.open(whatsappUrl(payload), '_blank', 'noopener');
  }, [info, lines, total]);

  const resetStatus = useCallback(() => setStatus({ state: 'idle' }), []);

  const value = useMemo<OrderContextValue>(
    () => ({
      quantities,
      lines,
      count,
      total,
      tva,
      ttc,
      increment,
      decrement,
      setQuantity,
      clearCart,
      info,
      setField,
      errors,
      status,
      resetStatus,
      submit,
      openWhatsApp,
    }),
    [quantities, lines, count, total, tva, ttc, increment, decrement, setQuantity, clearCart, info, setField, errors, status, resetStatus, submit, openWhatsApp],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}
