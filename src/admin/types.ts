export type Statut = 'demande' | 'devis_envoye' | 'confirmee' | 'en_preparation' | 'livree' | 'annulee';
export type PaiementStatut = 'en_attente' | 'acompte' | 'paye';
export type Mode = 'livraison' | 'retrait';

export interface Client {
  id: string;
  created_at: string;
  nom: string;
  entreprise: string;
  telephone: string;
  email: string;
  adresse: string;
  notes: string;
}

export interface Ligne {
  nom: string;
  quantite: number;
  /** Prix unitaire HT */
  prix_unitaire: number;
}

export interface Commande {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string | null;
  source: 'site' | 'admin';
  type: 'commande' | 'degustation';
  statut: Statut;
  paiement_statut: PaiementStatut;
  montant_encaisse: number;
  /** YYYY-MM-DD */
  date_prestation: string | null;
  heure: string;
  nb_personnes: number | null;
  mode: Mode;
  adresse: string;
  lignes: Ligne[];
  total_ht: number;
  tva_taux: number;
  allergies: string;
  notes: string;
  parrain: string;
  numero_devis: string | null;
  numero_facture: string | null;
}

export type ClientInput = Omit<Client, 'id' | 'created_at'> & { id?: string };
export type CommandeInput = Omit<Commande, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export const STATUTS: { id: Statut; label: string; color: string }[] = [
  { id: 'demande', label: 'Demande reçue', color: 'bg-sky-500/20 text-sky-200 border-sky-400/40' },
  { id: 'devis_envoye', label: 'Devis envoyé', color: 'bg-violet-500/20 text-violet-200 border-violet-400/40' },
  { id: 'confirmee', label: 'Confirmée', color: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
  { id: 'en_preparation', label: 'En préparation', color: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
  { id: 'livree', label: 'Livrée', color: 'bg-neutral-500/30 text-neutral-100 border-neutral-400/40' },
  { id: 'annulee', label: 'Annulée', color: 'bg-red-500/20 text-red-200 border-red-400/40' },
];

export const PAIEMENTS: { id: PaiementStatut; label: string; color: string }[] = [
  { id: 'en_attente', label: 'Paiement en attente', color: 'text-amber-300' },
  { id: 'acompte', label: 'Acompte reçu', color: 'text-sky-300' },
  { id: 'paye', label: 'Payé', color: 'text-emerald-300' },
];

export const statutInfo = (s: Statut) => STATUTS.find((x) => x.id === s) ?? STATUTS[0]!;
export const paiementInfo = (p: PaiementStatut) => PAIEMENTS.find((x) => x.id === p) ?? PAIEMENTS[0]!;

/** Statuts comptés dans les ventes (ni devis non accepté, ni annulée) */
export const STATUTS_VENTE: Statut[] = ['confirmee', 'en_preparation', 'livree'];

// ---------------- Stock ----------------
export interface Ingredient {
  id: string;
  created_at: string;
  nom: string;
  unite: string;
  stock: number;
  seuil: number;
  prix_unitaire: number;
  fournisseur: string;
}
export type IngredientInput = Omit<Ingredient, 'id' | 'created_at' | 'stock'> & { id?: string };

/** Quantité d’un ingrédient pour UNE portion d’un produit (libellé exact de ligne de commande) */
export interface RecetteLigne {
  id?: string;
  produit: string;
  ingredient_id: string;
  quantite: number;
}

export interface Mouvement {
  id: string;
  created_at: string;
  ingredient_id: string;
  type: 'entree' | 'sortie' | 'ajustement';
  quantite: number;
  commande_id: string | null;
  note: string;
}

export const UNITES = ['kg', 'g', 'L', 'cl', 'pièce', 'botte', 'boîte'];

// ---------------- Rentabilité ----------------
export interface Charge {
  id: string;
  created_at: string;
  libelle: string;
  /** Montant HT : par mois (type mensuel) ou par commande vendue */
  montant: number;
  type: 'mensuel' | 'par_commande';
  categorie: string;
}
export type ChargeInput = Omit<Charge, 'id' | 'created_at'> & { id?: string };
