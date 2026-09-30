import { CATEGORIES } from './products';

/**
 * Allergènes (règlement INCO, 14 allergènes majeurs) — repris du tableau affiché au restaurant.
 * Un produit absent de cette table n’a pas encore été renseigné : le site affiche alors
 * « Allergènes : nous consulter ». Ne jamais deviner : compléter uniquement à partir des fiches.
 */
export const ALLERGENES_14 = [
  'Gluten', 'Crustacés', 'Œufs', 'Poisson', 'Arachide', 'Soja', 'Lait', 'Fruits à coque',
  'Céleri', 'Moutarde', 'Sésame', 'Sulfites', 'Lupin', 'Mollusques',
] as const;
export type Allergene = (typeof ALLERGENES_14)[number];

/** id produit → allergènes présents ([] = aucun des 14 allergènes majeurs) */
export const ALLERGENES: Record<string, Allergene[]> = {
  houmous: ['Sésame'],
  moutabel: ['Lait', 'Sésame'],
  taboule: ['Gluten'],
  'salade-fattouche': ['Gluten'],
  'falafel-entree': [],
  'shawarma-viande': ['Gluten', 'Lait', 'Sésame'],
  'shawarma-poulet': ['Gluten', 'Lait', 'Sésame'],
  baklawa: ['Gluten', 'Lait', 'Fruits à coque', 'Sésame'],
  mhalabia: ['Lait'],
  'eau-plate': [],
  'eau-gazeuse': [],
};

/** Articles non alimentaires : pas de mention d’allergènes */
const NON_ALIMENTAIRE = new Set(CATEGORIES.find((c) => c.id === 'materiel')?.produits.map((p) => p.id) ?? []);

export function texteAllergenes(productId: string): string | null {
  if (NON_ALIMENTAIRE.has(productId)) return null;
  const a = ALLERGENES[productId];
  if (!a) return 'Allergènes : nous consulter';
  return a.length ? `Allergènes : ${a.join(', ')}` : 'Aucun des 14 allergènes majeurs';
}

/** Origine des viandes (affichage obligatoire en restauration) */
export const ORIGINE_VIANDES: { viande: string; origine: string }[] = [
  { viande: 'Bœuf', origine: 'France (né, élevé et abattu en France)' },
  { viande: 'Volaille', origine: 'Union européenne' },
  { viande: 'Agneau', origine: 'Union européenne' },
];
