import { ORDERABLES, variantId } from '../data/products';
import { round2 } from './format';

/**
 * Simulateur « budget par personne » : à partir du nombre de convives, du budget HT
 * par personne et du type de moment, propose des menus complets prêts à ajouter au panier.
 * Les prix sont lus dans le catalogue (products.ts) : aucune donnée à maintenir ici.
 */

export type Moment = 'petit-dej' | 'dejeuner' | 'evenement';

export interface SimulatorInput {
  personnes: number;
  /** Budget HT par personne */
  budget: number;
  moment: Moment;
  /** Nombre de convives végétariens (0..personnes) */
  vege: number;
  /** Nombre de convives sans gluten (0..personnes − vege) — déjeuner uniquement */
  sansGluten?: number;
}

export interface ProposalLine {
  id: string;
  quantite: number;
}

export type ProposalTag = 'eco' | 'ideal' | 'premium';

export interface Proposal {
  key: string;
  titre: string;
  description: string;
  lignes: ProposalLine[];
  totalHT: number;
  parPersonne: number;
  tag: ProposalTag;
}

interface Ctx {
  n: number;
  vege: number;
  /** Convives sans gluten : plateau sans gluten + dessert sans gluten */
  sg: number;
  /** Convives « classiques » : n − vege − sg */
  viande: number;
}

interface Recipe {
  key: string;
  titre: string;
  description: string;
  moments: Moment[];
  /** Minimum de convives (formules) */
  min?: number;
  build: (c: Ctx) => ProposalLine[];
}

/** Une portion à partager (200 g ou 4 pièces) pour `per` personnes */
const partage = (n: number, per: number) => Math.max(1, Math.ceil(n / per));
/** Répartit la partie « viande » moitié poulet / moitié viande */
const split = (n: number): [number, number] => [Math.ceil(n / 2), Math.floor(n / 2)];
/** Plat principal des convives sans gluten */
const sgPlat = (sg: number): ProposalLine => ({ id: 'plateau-sans-gluten-viande', quantite: sg });
/** Dessert : `id` pour tous, salade de fruits (sans gluten) pour les convives sans gluten */
const desserts = (id: string, n: number, sg: number): ProposalLine[] => [
  { id, quantite: n - sg },
  { id: 'salade-de-fruits', quantite: sg },
];
/** Plateaux à options : valeurs par défaut (modifiables ensuite au panier) */
const assietteVege = (q: number): ProposalLine => ({ id: variantId('assiette-vegetarienne', 'vegetariens'), quantite: q });
const signature = (q: number): ProposalLine => ({ id: variantId('plateau-signature', 'vegetariens'), quantite: q });
const shawarmaPlateaux = (q: number): ProposalLine[] => {
  const [viande, poulet] = split(q);
  return [
    { id: variantId('plateau-shawarma', 'viande'), quantite: viande },
    { id: variantId('plateau-shawarma', 'poulet'), quantite: poulet },
  ];
};

const RECIPES: Recipe[] = [
  // ---------- Petit-déjeuner ----------
  {
    key: 'petit-dej',
    titre: 'Petit-déjeuner',
    description: 'Café / thé à volonté, jus d’orange, mini viennoiseries',
    moments: ['petit-dej'],
    min: 6,
    build: ({ n }) => [{ id: 'formule-petit-dejeuner', quantite: n }],
  },
  {
    key: 'petit-dej-plus',
    titre: 'Petit-déjeuner gourmand',
    description: 'Formule petit-déjeuner + salade de fruits',
    moments: ['petit-dej'],
    min: 6,
    build: ({ n }) => [
      { id: 'formule-petit-dejeuner', quantite: n },
      { id: 'salade-de-fruits', quantite: n },
    ],
  },
  {
    key: 'brunch',
    titre: 'Brunch',
    description: 'Viennoiseries, œufs, entrées froides, salade de fruits, jus / café, touche sucrée',
    moments: ['petit-dej'],
    min: 8,
    build: ({ n }) => [{ id: 'formule-brunch', quantite: n }],
  },
  {
    key: 'brunch-plus',
    titre: 'Brunch + citronnade maison',
    description: 'Formule brunch complète avec une citronnade maison par personne',
    moments: ['petit-dej'],
    min: 8,
    build: ({ n }) => [
      { id: 'formule-brunch', quantite: n },
      { id: 'citronnade', quantite: n },
    ],
  },

  // ---------- Déjeuner / réunion ----------
  {
    key: 'sandwich-eau',
    titre: 'Sandwich + boisson',
    description: 'Shawarma poulet / viande (falafel pour les végétariens) et une eau',
    moments: ['dejeuner'],
    build: ({ n, vege, sg, viande }) => {
      const [poulet, boeuf] = split(viande);
      return [
        { id: 'shawarma-poulet', quantite: poulet },
        { id: 'shawarma-viande', quantite: boeuf },
        { id: 'sandwich-falafel', quantite: vege },
        sgPlat(sg),
        { id: 'eau-plate', quantite: n },
      ];
    },
  },
  {
    key: 'formule-sandwich',
    titre: 'Formule Sandwich',
    description: 'Sandwich au choix + beignet + boisson + dessert',
    moments: ['dejeuner'],
    build: ({ n, sg }) => [
      { id: 'formule-sandwich', quantite: n - sg },
      sgPlat(sg),
      { id: 'eau-plate', quantite: sg },
      { id: 'salade-de-fruits', quantite: sg },
    ],
  },
  {
    key: 'formule-sandwich-entrees',
    titre: 'Formule Sandwich + entrées à partager',
    description: 'Formule complète + houmous et taboulé à partager',
    moments: ['dejeuner'],
    build: ({ n, sg }) => [
      { id: 'formule-sandwich', quantite: n - sg },
      sgPlat(sg),
      { id: 'eau-plate', quantite: sg },
      { id: 'salade-de-fruits', quantite: sg },
      { id: 'houmous', quantite: partage(n, 6) },
      { id: 'taboule', quantite: partage(n, 6) },
    ],
  },
  {
    key: 'plateau-shawarma',
    titre: 'Plateau Shawarma + boisson',
    description: 'Plateau repas individuel + citronnade maison',
    moments: ['dejeuner'],
    build: ({ n, vege, sg, viande }) => [
      ...shawarmaPlateaux(viande),
      assietteVege(vege),
      sgPlat(sg),
      { id: 'citronnade', quantite: n },
    ],
  },
  {
    key: 'plateau-signature',
    titre: 'Plateau Signature complet',
    description: 'Notre plateau signature + citronnade maison + dessert',
    moments: ['dejeuner'],
    build: ({ n, vege, sg, viande }) => [
      signature(viande),
      assietteVege(vege),
      sgPlat(sg),
      { id: 'citronnade', quantite: n },
      ...desserts('baklawa', n, sg),
    ],
  },
  {
    key: 'plateau-signature-entrees',
    titre: 'Plateau Signature + entrées chaudes',
    description: 'Plateau signature, samoussas et fatayers à partager, citronnade maison, dessert',
    moments: ['dejeuner'],
    build: ({ n, vege, sg, viande }) => [
      signature(viande),
      assietteVege(vege),
      sgPlat(sg),
      { id: 'samoussa-fromage', quantite: partage(n, 4) },
      { id: 'fatayer-epinards', quantite: partage(n, 4) },
      { id: 'citronnade', quantite: n },
      ...desserts('patisseries-orientales', n, sg),
    ],
  },

  // ---------- Cocktail / événement ----------
  {
    key: 'cocktail',
    titre: 'Cocktail dînatoire',
    description: 'Entrées chaudes et froides à partager, citronnade maison, pâtisseries orientales',
    moments: ['evenement'],
    build: ({ n }) => [
      { id: 'samoussa-viande', quantite: partage(n, 4) },
      { id: 'samoussa-fromage', quantite: partage(n, 4) },
      { id: 'falafel-entree', quantite: partage(n, 4) },
      { id: 'fatayer-epinards', quantite: partage(n, 4) },
      { id: 'houmous', quantite: partage(n, 5) },
      { id: 'moutabel', quantite: partage(n, 5) },
      { id: 'feuille-de-vigne', quantite: partage(n, 5) },
      { id: 'citronnade', quantite: n },
      { id: 'patisseries-orientales', quantite: n },
    ],
  },
  {
    key: 'buffet-classique',
    titre: 'Buffet Classique',
    description: 'Notre buffet traiteur complet',
    moments: ['evenement', 'dejeuner'],
    min: 10,
    build: ({ n }) => [{ id: 'buffet-classique', quantite: n }],
  },
  {
    key: 'buffet-standard',
    titre: 'Buffet Standard',
    description: 'Le plus choisi — jus artisanal offert',
    moments: ['evenement', 'dejeuner'],
    min: 10,
    build: ({ n }) => [{ id: 'buffet-standard', quantite: n }],
  },
  {
    key: 'buffet-prestige',
    titre: 'Buffet Prestige',
    description: 'Notre offre haut de gamme — boissons et pâtisseries offertes',
    moments: ['evenement'],
    min: 15,
    build: ({ n }) => [{ id: 'buffet-prestige', quantite: n }],
  },
];

function price(lignes: ProposalLine[]): number {
  return round2(lignes.reduce((s, l) => s + (ORDERABLES.get(l.id)?.prix ?? 0) * l.quantite, 0));
}

/** Tous les menus possibles pour ce moment et ce nombre de convives, du moins cher au plus cher */
export function candidates(input: SimulatorInput): Omit<Proposal, 'tag'>[] {
  const n = Math.max(1, Math.floor(input.personnes));
  const vege = Math.min(n, Math.max(0, Math.floor(input.vege)));
  const sg = Math.min(n - vege, Math.max(0, Math.floor(input.sansGluten ?? 0)));
  const ctx: Ctx = { n, vege, sg, viande: n - vege - sg };
  return RECIPES.filter((r) => r.moments.includes(input.moment) && n >= (r.min ?? 1))
    .map((r) => {
      const lignes = r.build(ctx).filter((l) => l.quantite > 0 && ORDERABLES.has(l.id));
      const totalHT = price(lignes);
      return {
        key: r.key,
        titre: r.titre,
        description: r.description,
        lignes,
        totalHT,
        parPersonne: round2(totalHT / n),
      };
    })
    .sort((a, b) => a.parPersonne - b.parPersonne);
}

/**
 * Jusqu’à 3 propositions :
 * - « ideal » : le menu le plus complet qui tient dans le budget
 * - « eco »   : une option moins chère
 * - « premium » : la montée en gamme la plus proche au-dessus du budget (≤ +50 %)
 * Si rien ne tient dans le budget, le menu le moins cher est proposé en « ideal ».
 */
export function propose(input: SimulatorInput): Proposal[] {
  const list = candidates(input);
  if (list.length === 0) return [];

  const within = list.filter((c) => c.parPersonne <= input.budget + 0.001);
  const above = list.filter((c) => c.parPersonne > input.budget + 0.001);

  const ideal = within.at(-1) ?? list[0]!;
  const out: Proposal[] = [];

  const eco = within.length >= 2 ? within[0] : undefined;
  if (eco && eco.key !== ideal.key) out.push({ ...eco, tag: 'eco' });
  out.push({ ...ideal, tag: 'ideal' });

  const premium = above.find((c) => c.key !== ideal.key && c.parPersonne <= input.budget * 1.5);
  if (premium) out.push({ ...premium, tag: 'premium' });

  return out;
}

/** Budget minimum pour obtenir au moins une proposition */
export function budgetMinimum(input: Omit<SimulatorInput, 'budget'>): number | null {
  const list = candidates({ ...input, budget: 0 });
  return list[0]?.parPersonne ?? null;
}
