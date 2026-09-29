import { BUFFETS_IDS, CATEGORIES } from '../data/products';
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
const BUFFETS = new Set(BUFFETS_IDS);
const AVEC_COUVERTS = new Set([...BUFFETS, 'formule-brunch']);
// La Formule Sandwich inclut déjà boisson + dessert
const INCLUT_TOUT = new Set(['formule-sandwich']);

/** Id de base d’une ligne panier (« plateau-shawarma:poulet » → « plateau-shawarma ») */
const base = (id: string) => id.split(':')[0]!;

/** Suggestions d’ajout : boissons et desserts manquants par rapport au nombre de repas */
export function suggestions(lines: CartLine[]): Suggestion[] {
  const somme = (set: Set<string>) => lines.filter((l) => set.has(base(l.id))).reduce((s, l) => s + l.quantite, 0);
  // Buffets et brunch : kit complet (vaisselle + nappes + service) ; plateaux individuels : kit couverts
  const convivesService = somme(AVEC_COUVERTS);
  const nbPlateaux = somme(PLATEAUX);
  const kitsBuffet = somme(new Set(['kit-buffet-complet']));
  const kitsCouverts = somme(new Set(['kit-couverts']));
  const convivesBuffet = somme(BUFFETS);
  const brochettes = somme(BROCHETTES);
  const repas = lines
    .filter((l) => PLATS.has(base(l.id)) && !INCLUT_TOUT.has(base(l.id)))
    .reduce((s, l) => s + l.quantite, 0);
  const out: Suggestion[] = [];

  // Matériel : le client ne doit rien avoir à acheter ailleurs
  const manqueBuffet = convivesService - kitsBuffet;
  if (convivesService >= 3 && manqueBuffet > 0)
    out.push({
      id: 'kit-buffet',
      texte: `Kit Buffet complet pour ${convivesService} personnes : vaisselle, couverts, serviettes, gobelets, nappes et ustensiles de service. Rien à acheter à côté.`,
      bouton: `+ ${manqueBuffet} kit${manqueBuffet > 1 ? 's' : ''} buffet complet`,
      lignes: [{ id: 'kit-buffet-complet', quantite: manqueBuffet }],
    });
  const manqueCouverts = nbPlateaux - kitsCouverts - Math.max(0, kitsBuffet - convivesService);
  if (nbPlateaux >= 3 && manqueCouverts > 0)
    out.push({
      id: 'couverts',
      texte: `Couverts et serviettes pour ${nbPlateaux} plateau${nbPlateaux > 1 ? 'x' : ''} ?`,
      bouton: `+ ${manqueCouverts} kit${manqueCouverts > 1 ? 's' : ''} couverts`,
      lignes: [{ id: 'kit-couverts', quantite: manqueCouverts }],
    });
  // Dès 30 convives de buffet, le chauffe-plat est offert automatiquement (lib/offres.ts) : rien à proposer
  if ((convivesBuffet > 0 || brochettes >= 10) && somme(new Set(['chauffe-plat', 'chauffe-plat-offert'])) === 0) {
    const n = Math.max(1, Math.ceil(convivesBuffet / 20));
    out.push({
      id: 'chauffe-plat',
      texte: 'Pour garder brochettes et plats chauds pendant le service (offert dès 30 personnes en buffet).',
      bouton: `+ ${n} chauffe-plat${n > 1 ? 's' : ''}`,
      lignes: [{ id: 'chauffe-plat', quantite: n }],
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
