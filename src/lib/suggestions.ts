import { CATEGORIES } from '../data/products';
import type { CartLine } from '../types';

export interface Suggestion {
  id: string;
  texte: string;
  bouton: string;
  lignes: { id: string; quantite: number }[];
}

const idsDe = (cat: string) => new Set(CATEGORIES.find((c) => c.id === cat)?.produits.map((p) => p.id) ?? []);
const PLATS = new Set([...idsDe('plateaux'), ...idsDe('sandwichs')]);
const BOISSONS = idsDe('boissons');
const DESSERTS = idsDe('desserts');
// La Formule Sandwich inclut déjà boisson + dessert
const INCLUT_TOUT = new Set(['formule-sandwich']);

/** Id de base d’une ligne panier (« plateau-shawarma:poulet » → « plateau-shawarma ») */
const base = (id: string) => id.split(':')[0]!;

/** Suggestions d’ajout : boissons et desserts manquants par rapport au nombre de repas */
export function suggestions(lines: CartLine[]): Suggestion[] {
  const somme = (set: Set<string>) => lines.filter((l) => set.has(base(l.id))).reduce((s, l) => s + l.quantite, 0);
  const repas = lines
    .filter((l) => PLATS.has(base(l.id)) && !INCLUT_TOUT.has(base(l.id)))
    .reduce((s, l) => s + l.quantite, 0);
  if (repas < 3) return [];

  const out: Suggestion[] = [];
  const manqueBoissons = repas - somme(BOISSONS);
  if (manqueBoissons > 0)
    out.push({
      id: 'boissons',
      texte: `${repas} repas mais ${manqueBoissons === repas ? 'aucune boisson' : `seulement ${repas - manqueBoissons} boisson(s)`}.`,
      bouton: `+ ${manqueBoissons} citronnade${manqueBoissons > 1 ? 's' : ''} maison`,
      lignes: [{ id: 'citronnade', quantite: manqueBoissons }],
    });
  if (somme(DESSERTS) === 0)
    out.push({
      id: 'desserts',
      texte: 'Pas encore de dessert pour finir le repas.',
      bouton: `+ ${repas} baklawa${repas > 1 ? 's' : ''}`,
      lignes: [{ id: 'baklawa', quantite: repas }],
    });
  return out;
}
