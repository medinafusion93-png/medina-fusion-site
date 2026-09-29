import { round2 } from '../lib/format';
import { coutMatiere, estVente, isoDate } from './stats';
import type { Charge, Commande, Ingredient, RecetteLigne } from './types';

export interface MoisStats {
  /** « 2026-10 » */
  mois: string;
  nbVentes: number;
  ca: number;
  coutMatiere: number;
  fraisVariables: number;
  margeBrute: number;
  chargesFixes: number;
  benefice: number;
  /** Marge après matière et frais variables, en % du CA */
  tauxMarge: number;
  panierMoyen: number;
  /** CA HT nécessaire pour couvrir les charges fixes */
  seuilCA: number | null;
  /** Nombre de commandes nécessaire (au panier moyen) */
  seuilCommandes: number | null;
  /** Progression vers le seuil (0–1+) */
  progression: number;
  /** Produits vendus sans recette : leur coût matière n’est pas compté */
  sansRecette: string[];
  /** Commandes confirmées du mois encore à venir (déjà comptées) */
  aVenir: number;
}

export const moisDe = (iso: string | null) => (iso ? iso.slice(0, 7) : '');

export function totalCharges(charges: Charge[]) {
  const fixes = round2(charges.filter((c) => c.type === 'mensuel').reduce((s, c) => s + c.montant, 0));
  const parCommande = round2(charges.filter((c) => c.type === 'par_commande').reduce((s, c) => s + c.montant, 0));
  return { fixes, parCommande };
}

/**
 * Rentabilité d’un mois (date de prestation), sur les ventes confirmées / en préparation / livrées.
 * Montants HT. Le coût matière utilise les recettes et prix d’achat actuels.
 */
export function statsMois(
  mois: string,
  commandes: Commande[],
  recettes: RecetteLigne[],
  ingredients: Map<string, Ingredient>,
  charges: Charge[],
  today = new Date(),
): MoisStats {
  const ventes = commandes.filter((c) => estVente(c) && moisDe(c.date_prestation) === mois);
  const { fixes, parCommande } = totalCharges(charges);
  let ca = 0;
  let cout = 0;
  const sansRecette = new Set<string>();
  for (const c of ventes) {
    ca += Number(c.total_ht) || 0;
    const cm = coutMatiere(c.lignes, recettes, ingredients);
    cout += cm.cout;
    cm.sansRecette.forEach((n) => sansRecette.add(n));
  }
  ca = round2(ca);
  cout = round2(cout);
  const fraisVariables = round2(parCommande * ventes.length);
  const margeBrute = round2(ca - cout - fraisVariables);
  const tauxMarge = ca > 0 ? margeBrute / ca : 0;
  const panierMoyen = ventes.length ? round2(ca / ventes.length) : 0;
  const seuilCA = tauxMarge > 0 ? round2(fixes / tauxMarge) : null;
  const margeParCommande = panierMoyen * tauxMarge;
  const seuilCommandes = margeParCommande > 0 ? Math.ceil(fixes / margeParCommande) : null;
  const jour = isoDate(today);
  return {
    mois,
    nbVentes: ventes.length,
    ca,
    coutMatiere: cout,
    fraisVariables,
    margeBrute,
    chargesFixes: fixes,
    benefice: round2(margeBrute - fixes),
    tauxMarge,
    panierMoyen,
    seuilCA,
    seuilCommandes,
    progression: fixes > 0 ? margeBrute / fixes : margeBrute > 0 ? 1 : 0,
    sansRecette: [...sansRecette],
    aVenir: ventes.filter((c) => (c.date_prestation ?? '') > jour).length,
  };
}

/** Les n derniers mois (le plus récent en dernier) */
export function derniersMois(n: number, today = new Date()): string[] {
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (n - 1 - k), 1);
    return isoDate(d).slice(0, 7);
  });
}

export interface PlatStats {
  nom: string;
  quantite: number;
  ca: number;
  coutUnitaire: number | null;
  prixMoyen: number;
  /** Coût matière en % du prix de vente HT */
  foodCost: number | null;
  margeTotale: number | null;
}

/** Rentabilité par plat sur une période (ventes uniquement), triée par marge totale */
export function statsPlats(
  commandes: Commande[],
  recettes: RecetteLigne[],
  ingredients: Map<string, Ingredient>,
  filtre: (c: Commande) => boolean = () => true,
): PlatStats[] {
  const agg = new Map<string, { q: number; ca: number }>();
  for (const c of commandes.filter((x) => estVente(x) && filtre(x)))
    for (const l of c.lignes) {
      const a = agg.get(l.nom) ?? { q: 0, ca: 0 };
      a.q += l.quantite;
      a.ca += l.quantite * l.prix_unitaire;
      agg.set(l.nom, a);
    }
  return [...agg.entries()]
    .map(([nom, a]) => {
      const rs = recettes.filter((r) => r.produit === nom);
      const coutUnitaire = rs.length ? round2(rs.reduce((s, r) => s + r.quantite * (ingredients.get(r.ingredient_id)?.prix_unitaire ?? 0), 0)) : null;
      const prixMoyen = a.q ? round2(a.ca / a.q) : 0;
      return {
        nom,
        quantite: a.q,
        ca: round2(a.ca),
        coutUnitaire,
        prixMoyen,
        foodCost: coutUnitaire !== null && prixMoyen > 0 ? coutUnitaire / prixMoyen : null,
        margeTotale: coutUnitaire !== null ? round2(a.ca - coutUnitaire * a.q) : null,
      };
    })
    .sort((x, y) => (y.margeTotale ?? -Infinity) - (x.margeTotale ?? -Infinity));
}

/** Seuils de lecture du coût matière (food cost) en traiteur */
export const verdictFoodCost = (fc: number | null) =>
  fc === null ? { label: 'Recette manquante', color: 'text-neutral-400' }
  : fc < 0.3 ? { label: 'Très bien', color: 'text-emerald-300' }
  : fc <= 0.35 ? { label: 'Correct', color: 'text-sky-300' }
  : { label: 'Trop cher', color: 'text-red-300' };
