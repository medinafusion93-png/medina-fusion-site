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
  else if (info.date < todayISO()) errors.date = 'La date ne peut pas être passée.';
  if (!info.adresse.trim()) errors.adresse = 'Indiquez l’adresse de livraison.';
  return errors;
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
