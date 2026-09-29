import type { Formule, Orderable, Product, ProductCategory, ProductOption } from '../types';

/**
 * Catalogue traiteur — modifier les prix ici uniquement.
 * Les `id` servent de clé panier : ne pas les changer une fois en production.
 */

const froide = (id: string, nom: string): Product => ({ id, nom, prix: 6, unite: '200g' });
const chaude = (id: string, nom: string): Product => ({ id, nom, prix: 6.5, unite: '4 pièces' });
const sandwich = (id: string, nom: string): Product => ({ id, nom, prix: 7.5 });
const dessert = (id: string, nom: string, unite?: string): Product => ({ id, nom, prix: 4, unite });

const BEIGNETS: ProductOption = {
  label: 'Beignets',
  choix: [
    { id: 'vegetariens', nom: 'végétariens' },
    { id: 'legumes', nom: 'légumes' },
    { id: 'viande', nom: 'viande' },
    { id: 'fromage', nom: 'fromage' },
  ],
};

/** Id panier d’un produit à options : `plateau-shawarma:poulet` */
export const variantId = (productId: string, choixId: string) => `${productId}:${choixId}`;

export const CATEGORIES: ProductCategory[] = [
  {
    id: 'entrees-froides',
    titre: 'Entrées Froides',
    sousTitre: '6€ les 200g',
    icon: '🥗',
    layout: 'list',
    produits: [
      froide('houmous', 'Houmous'),
      froide('moutabel', 'Moutabel'),
      froide('labne', 'Labné'),
      froide('taboule', 'Taboulé'),
      froide('salade-chenklich', 'Salade chenklich'),
      froide('salade-tunisienne', 'Salade tunisienne'),
      froide('salade-mechouia', 'Salade mechouia'),
      froide('salade-fattouche', 'Salade fattouche'),
      froide('feuille-de-vigne', 'Feuille de vigne'),
      froide('poivrons-farcis', 'Poivrons farcis au fromage'),
    ],
  },
  {
    id: 'entrees-chaudes',
    titre: 'Entrées Chaudes',
    sousTitre: '6,50€ les 4 pièces',
    icon: '🔥',
    layout: 'list',
    produits: [
      chaude('samoussa-fromage', 'Samoussa fromage'),
      chaude('samoussa-viande', 'Samoussa viande'),
      chaude('sfiha-viande', 'Sfiha viande'),
      chaude('sfiha-fromage', 'Sfiha fromage'),
      { ...chaude('fatayer-epinards', 'Fatayer épinards'), image: '/produits/fatayer-epinards.jpg' },
      chaude('falafel-entree', 'Falafel (entrée)'),
      chaude('fricassee-tunisienne', 'Fricassée tunisienne'),
      { id: 'batata-harra', nom: 'Batata harra', prix: 6, unite: '200g' },
    ],
  },
  {
    id: 'sandwichs',
    titre: 'Sandwichs',
    sousTitre: '7,50€ — ou en formule à 13€',
    icon: '🥙',
    layout: 'list',
    produits: [
      sandwich('shawarma-viande', 'Shawarma viande'),
      sandwich('shawarma-poulet', 'Shawarma poulet'),
      sandwich('sandwich-halloumi', 'Halloumi'),
      sandwich('sandwich-falafel', 'Falafel'),
      sandwich('sandwich-aubergines', 'Aubergines-pommes de terre'),
      {
        id: 'formule-sandwich',
        nom: 'Formule Sandwich',
        prix: 13,
        description: 'Sandwich au choix + beignet + boisson + dessert',
        badge: 'Formule',
      },
    ],
  },
  {
    id: 'plateaux',
    titre: 'Plateaux Repas Individuels',
    sousTitre: 'Idéal pour vos réunions et déjeuners d’équipe',
    icon: '🍱',
    layout: 'photo',
    produits: [
      {
        id: 'plateau-signature',
        nom: 'Plateau Signature',
        prix: 15.9,
        image: '/plateaux/signature.jpg',
        badge: 'Signature',
        description:
          'Brochette kefta, brochette poulet, houmous, caviar d’aubergine, taboulé, purée d’ail, beignet au choix',
        options: BEIGNETS,
      },
      {
        id: 'plateau-shawarma',
        nom: 'Plateau Shawarma',
        prix: 15.9,
        image: '/plateaux/shawarma.jpg',
        description: 'Shawarma au choix, houmous, fromage blanc concombre, batata hara, purée d’ail',
        options: {
          label: 'Shawarma',
          prefixe: '',
          choix: [
            { id: 'viande', nom: 'Viande' },
            { id: 'poulet', nom: 'Poulet' },
          ],
        },
      },
      {
        id: 'assiette-vegetarienne',
        nom: 'Assiette Végétarienne',
        prix: 12.9,
        image: '/plateaux/vegetarienne.jpg',
        badge: 'Végétarien',
        description: 'Houmous, caviar d’aubergine, fromage blanc concombre, 3 falafels',
      },
      {
        id: 'plateau-sans-gluten-vege',
        nom: 'Plateau Sans Gluten — Végétarien',
        prix: 12.9,
        description: 'Avec falafels',
        image: '/plateaux/sans-gluten.jpg',
        badge: 'Sans gluten',
      },
      {
        id: 'plateau-sans-gluten-viande',
        nom: 'Plateau Sans Gluten — Viande',
        prix: 15.9,
        image: '/plateaux/sans-gluten.jpg',
        badge: 'Sans gluten',
      },
    ],
  },
  {
    id: 'brochettes',
    titre: 'Brochettes à la carte',
    sousTitre: '3,50€ la pièce',
    icon: '🍢',
    layout: 'list',
    produits: [
      { id: 'brochette-poulet', nom: 'Brochette Poulet', prix: 3.5, unite: 'pièce' },
      { id: 'brochette-kefta', nom: 'Brochette Kefta', prix: 3.5, unite: 'pièce' },
    ],
  },
  {
    id: 'desserts',
    titre: 'Desserts',
    sousTitre: '4€',
    icon: '🍰',
    layout: 'list',
    produits: [
      dessert('salade-de-fruits', 'Salade de fruits'),
      dessert('baklawa', 'Baklawa', '3 pièces'),
      dessert('mhalabia', 'Mhalabia'),
      dessert('tiramisu', 'Tiramisu'),
      dessert('patisseries-orientales', 'Pâtisseries orientales'),
      dessert('tartelettes-fruits', 'Mini tartelettes fruits'),
      dessert('tartelettes-chocolat', 'Mini tartelettes chocolat'),
    ],
  },
  {
    id: 'boissons',
    titre: 'Boissons',
    icon: '🥤',
    layout: 'list',
    produits: [
      { id: 'citronnade', nom: 'Citronnade maison', prix: 4 },
      { id: 'jus-de-saison', nom: 'Jus de saison', prix: 4 },
      { id: 'eau-plate', nom: 'Eau plate', prix: 2 },
      { id: 'eau-gazeuse', nom: 'Eau gazeuse', prix: 2.5 },
    ],
  },
  {
    // Vaisselle jetable en plastique interdite (loi AGEC) : bois, carton, compostable
    id: 'materiel',
    titre: 'Matériel & Accessoires',
    sousTitre: 'Tout est fourni : vous n’avez rien à acheter à côté',
    icon: '🧺',
    layout: 'list',
    produits: [
      {
        id: 'kit-buffet-complet',
        nom: 'Kit Buffet complet',
        prix: 2,
        unite: 'par pers.',
        badge: 'Tout compris',
        description:
          'Assiette compostable, couverts en bois, serviette, gobelet, nappes et ustensiles de service. Rien à prévoir de votre côté.',
      },
      {
        id: 'kit-couverts',
        nom: 'Kit couverts',
        prix: 1,
        unite: 'par pers.',
        description: 'Fourchette, couteau et cuillère en bois + serviette',
      },
      { id: 'assiette-jetable', nom: 'Assiette compostable', prix: 0.5, unite: 'pièce' },
      { id: 'gobelet-jetable', nom: 'Gobelet carton', prix: 0.3, unite: 'pièce' },
      {
        id: 'chauffe-plat',
        nom: 'Chauffe-plat (location)',
        prix: 25,
        unite: 'pièce',
        description: 'Garde brochettes et plats chauds 2 à 3 h. Combustible inclus, installé à la livraison et récupéré après.',
      },
      { id: 'nappe-buffet', nom: 'Nappe papier buffet', prix: 5, unite: 'pièce' },
    ],
  },
];

export const FORMULES: Formule[] = [
  {
    id: 'formule-petit-dejeuner',
    nom: 'Formule Petit-Déjeuner',
    icon: '☕',
    prix: 7.9,
    prixBarre: 11,
    minPersonnes: 6,
    contenu: ['Café / thé à volonté', 'Jus d’orange', 'Mini viennoiseries'],
  },
  {
    id: 'formule-brunch',
    nom: 'Formule Brunch',
    icon: '🥐',
    prix: 15,
    prixBarre: 19,
    minPersonnes: 8,
    contenu: [
      'Viennoiseries',
      'Œufs',
      'Entrées froides',
      'Salade de fruits',
      'Jus / café',
      'Touche sucrée',
    ],
  },
  {
    id: 'buffet-classique',
    nom: 'Buffet Classique',
    icon: '🍽️',
    prix: 25,
    prixBarre: 30,
    minPersonnes: 10,
    contenu: ['Chauffe-plat offert dès 30 pers.'],
  },
  {
    id: 'buffet-standard',
    nom: 'Buffet Standard',
    icon: '⭐',
    prix: 35,
    prixBarre: 42,
    minPersonnes: 10,
    contenu: ['Jus artisanal offert', 'Chauffe-plat offert dès 30 pers.'],
    badge: '★ MEILLEURE AFFAIRE',
    highlight: true,
  },
  {
    id: 'buffet-prestige',
    nom: 'Buffet Prestige',
    icon: '👑',
    prix: 45,
    prixBarre: 58,
    minPersonnes: 15,
    contenu: ['Boissons offertes', 'Pâtisseries offertes', 'Chauffe-plat offert dès 30 pers.'],
  },
];

/** Buffets : chauffe-plat offert à partir de ce nombre de convives, 1 par tranche de 20 (voir lib/offres.ts) */
export const CHAUFFE_PLAT_OFFERT_DES = 30;
export const BUFFETS_IDS = ['buffet-classique', 'buffet-standard', 'buffet-prestige'];

/** Index id → article commandable (produits + formules), utilisé par le panier */
export const ORDERABLES = new Map<string, Orderable>(
  [
    ...CATEGORIES.flatMap((c) =>
      c.produits.flatMap((p): Orderable[] =>
        p.options
          ? p.options.choix.map((ch) => ({
              id: variantId(p.id, ch.id),
              nom: `${p.nom} — ${[p.options!.prefixe ?? p.options!.label.toLowerCase(), ch.nom].filter(Boolean).join(' ')}`,
              prix: p.prix,
            }))
          : [{ id: p.id, nom: p.nom, prix: p.prix }],
      ),
    ),
    ...FORMULES.map((f): Orderable => ({ id: f.id, nom: `${f.nom} (par pers.)`, prix: f.prix, min: f.minPersonnes })),
  ].map((o) => [o.id, o]),
);
