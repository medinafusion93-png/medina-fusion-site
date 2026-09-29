import { CATEGORIES, CHAUFFE_PLAT_OFFERT_DES } from '../data/products';
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
const PLATEAUX = idsDe('plateaux');
const BROCHETTES = idsDe('brochettes');
// Formules servies en buffet (par personne) : couverts à prévoir, plats chauds à maintenir au chaud
const BUFFETS = new Set(['buffet-classique', 'buffet-standard', 'buffet-prestige']);
const AVEC_COUVERTS = new Set([...BUFFETS, 'formule-brunch']);
// La Formule Sandwich inclut déjà boisson + dessert
const INCLUT_TOUT = new Set(['formule-sandwich']);

/** Id de base d’une ligne panier (« plateau-shawarma:poulet » → « plateau-shawarma ») */
const base = (id: string) => id.split(':')[0]!;

/** Suggestions d’ajout : boissons et desserts manquants par rapport au nombre de repas */
export function suggestions(lines: CartLine[]): Suggestion[] {
  const somme = (set: Set<string>) => lines.filter((l) => set.has(base(l.id))).reduce((s, l) => s + l.quantite, 0);
  const couverts = lines.filter((l) => PLATEAUX.has(base(l.id)) || AVEC_COUVERTS.has(l.id)).reduce((s, l) => s + l.quantite, 0);
  const convivesBuffet = somme(BUFFETS);
  const brochettes = somme(BROCHETTES);
  const repas = lines
    .filter((l) => PLATS.has(base(l.id)) && !INCLUT_TOUT.has(base(l.id)))
    .reduce((s, l) => s + l.quantite, 0);
  const out: Suggestion[] = [];

  // Matériel : couverts et chauffe-plats (utile aussi pour un buffet seul)
  const manqueKits = couverts - somme(new Set(['kit-couverts']));
  if (couverts >= 3 && manqueKits > 0)
    out.push({
      id: 'couverts',
      texte: `Couverts et serviettes pour ${couverts} personne${couverts > 1 ? 's' : ''} ?`,
      bouton: `+ ${manqueKits} kit${manqueKits > 1 ? 's' : ''} couverts`,
      lignes: [{ id: 'kit-couverts', quantite: manqueKits }],
    });
  if ((convivesBuffet > 0 || brochettes >= 10) && somme(new Set(['chauffe-plat', 'chauffe-plat-offert'])) === 0) {
    const n = Math.max(1, Math.ceil(convivesBuffet / 20));
    const offert = convivesBuffet >= CHAUFFE_PLAT_OFFERT_DES;
    out.push({
      id: 'chauffe-plat',
      texte: offert
        ? `Buffet de ${convivesBuffet} personnes : chauffe-plat offert pour garder les plats chauds.`
        : 'Pour garder brochettes et plats chauds pendant le service.',
      bouton: `+ ${n} chauffe-plat${n > 1 ? 's' : ''}${offert ? ` offert${n > 1 ? 's' : ''}` : ''}`,
      lignes: [{ id: offert ? 'chauffe-plat-offert' : 'chauffe-plat', quantite: n }],
    });
  }

  if (repas < 3) return out;

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
