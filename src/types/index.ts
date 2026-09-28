export type CategoryId =
  | 'entrees-froides'
  | 'entrees-chaudes'
  | 'sandwichs'
  | 'plateaux'
  | 'brochettes'
  | 'desserts'
  | 'boissons';

export interface Product {
  id: string;
  nom: string;
  prix: number;
  /** Unité affichée à côté du prix : "200g", "4 pièces", "pièce"… */
  unite?: string;
  description?: string;
  /** Chemin relatif à /public (ex. "/plateaux/signature.jpg") */
  image?: string;
  badge?: string;
}

export interface ProductCategory {
  id: CategoryId;
  titre: string;
  sousTitre?: string;
  icon: string;
  /** "photo" = cartes visuelles larges (plateaux), "list" = lignes compactes */
  layout: 'list' | 'photo';
  produits: Product[];
}

export interface Formule {
  id: string;
  nom: string;
  icon: string;
  prix: number;
  prixBarre: number;
  minPersonnes: number;
  contenu: string[];
  badge?: string;
  highlight?: boolean;
}

/** Tout ce qui peut aller dans le panier : produit à la carte ou formule */
export interface Orderable {
  id: string;
  nom: string;
  prix: number;
  /** Quantité minimale dès qu'on commande (formules : nombre de personnes) */
  min?: number;
}

export interface CartLine {
  id: string;
  nom: string;
  quantite: number;
  prix_unitaire: number;
}

export interface CustomerInfo {
  entreprise: string;
  contact: string;
  email: string;
  tel: string;
  date: string;
  /** Heure de livraison souhaitée, format HH:MM */
  heure: string;
  adresse: string;
  parrain: string;
  notes: string;
}

export type OrderType = 'commande' | 'degustation';

export interface OrderPayload {
  entreprise: string;
  contact: string;
  email: string;
  tel: string;
  date: string;
  heure: string;
  adresse: string;
  notes: string;
  parrain?: string;
  items: { nom: string; quantite: number; prix_unitaire: number }[];
  total: number;
  type: OrderType;
}

export type SubmitStatus =
  | { state: 'idle' }
  | { state: 'loading'; type: OrderType }
  | { state: 'success'; type: OrderType }
  | { state: 'fallback'; type: OrderType }
  | { state: 'invalid'; message: string };
