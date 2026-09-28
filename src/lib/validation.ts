import { CONTACT } from '../data/config';
import type { CustomerInfo, OrderType } from '../types';

export type FieldErrors = Partial<Record<keyof CustomerInfo, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isEmail = (v: string): boolean => EMAIL_RE.test(v.trim());

/** Numéro FR ou international : au moins 10 chiffres, caractères autorisés + espace . - ( ) */
export const isPhone = (v: string): boolean =>
  /^[+\d\s.\-()]+$/.test(v.trim()) && v.replace(/\D/g, '').length >= 10;

export function validate(info: CustomerInfo, type: OrderType): FieldErrors {
  const errors: FieldErrors = {};
  const email = info.email.trim();
  const tel = info.tel.trim();

  if (!info.entreprise.trim()) errors.entreprise = 'Indiquez le nom de votre entreprise.';
  if (email && !isEmail(email)) errors.email = 'Adresse email invalide.';
  if (tel && !isPhone(tel)) errors.tel = 'Numéro de téléphone invalide.';

  if (type === 'degustation') {
    if (!email && !tel) errors.email = 'Renseignez un email ou un téléphone pour être recontacté.';
    return errors;
  }

  if (!info.contact.trim()) errors.contact = 'Indiquez le nom du contact.';
  if (!email) errors.email = 'L’email est requis pour recevoir la confirmation.';
  if (!tel) errors.tel = 'Le téléphone est requis.';
  if (!info.date) errors.date = 'Choisissez une date de livraison.';
  else if (info.date < dateMinISO())
    errors.date = `Commande à passer au moins ${CONTACT.delaiMinJours * 24} h à l’avance (à partir du ${dateMinISO().split('-').reverse().join('/')}).`;
  if (!info.heure) errors.heure = 'Choisissez une heure de livraison.';
  else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(info.heure)) errors.heure = 'Heure invalide.';
  if (!info.adresse.trim()) errors.adresse = 'Indiquez l’adresse de livraison.';
  return errors;
}

/** Première date de livraison possible (aujourd’hui + délai minimum) */
export function dateMinISO(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + CONTACT.delaiMinJours);
  return todayISO(d);
}

export function todayISO(from = new Date()): string {
  const d = from;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
