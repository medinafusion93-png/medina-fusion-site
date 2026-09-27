const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** 6.5 → "6,50 €" */
export const formatPrice = (value: number): string => eur.format(value);

/** Arrondi monétaire au centime */
export const round2 = (value: number): number => Math.round(value * 100) / 100;
