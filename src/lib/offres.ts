import { BUFFETS_IDS, CHAUFFE_PLAT_OFFERT_DES } from '../data/products';
import type { CartLine } from '../types';

export const CHAUFFE_PLAT_OFFERT_ID = 'chauffe-plat-offert';

/**
 * Lignes offertes calculées automatiquement à partir du panier (jamais saisies par le client) :
 * chauffe-plat offert dès 30 convives de buffet, 1 par tranche de 20.
 * Recalculé à chaque modification : ajouté, ajusté ou retiré selon le nombre de personnes.
 */
export function appliquerOffres(lines: CartLine[]): CartLine[] {
  const base = lines.filter((l) => l.id !== CHAUFFE_PLAT_OFFERT_ID);
  const convives = base.filter((l) => BUFFETS_IDS.includes(l.id)).reduce((s, l) => s + l.quantite, 0);
  if (convives < CHAUFFE_PLAT_OFFERT_DES) return base;
  return [
    ...base,
    { id: CHAUFFE_PLAT_OFFERT_ID, nom: 'Chauffe-plat (offert, buffet 30 pers. et +)', quantite: Math.ceil(convives / 20), prix_unitaire: 0, offert: true },
  ];
}
