import type { Formule, Orderable, Product, ProductCategory } from '../types';

/**
 * Catalogue traiteur — modifier les prix ici uniquement.
 * Les `id` servent de clé panier : ne pas les changer une fois en production.
 */

const froide = (id: string, nom: string): Product => ({ id, nom, prix: 6, unite: '200g' });
const chaude = (id: string, nom: string): Product => ({ id, nom, prix: 6.5, unite: '4 pièces' });
const sandwich = (id: string, nom: string): Product => ({ id, nom, prix: 7.5 });
const dessert = (id: string, nom: string, unite?: string): Product => ({ id, nom, prix: 4, unite });

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
      chaude('fatayer-epinards', 'Fatayer épinards'),
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
      },
      {
        id: 'plateau-shawarma',
        nom: 'Plateau Shawarma',
        prix: 15.9,
        image: '/plateaux/shawarma.jpg',
        description: 'Houmous, fromage blanc concombre, batata hara, purée d’ail',
      },
      {
        id: 'assiette-vegetarienne',
        nom: 'Assiette Végétarienne',
        prix: 12.9,
        image: '/plateaux/vegetarienne.jpg',
        badge: 'Végétarien',
        description: 'Houmous, caviar d’aubergine, fromage blanc concombre, 3 beignets végétariens',
      },
      {
        id: 'plateau-sans-gluten-vege',
        nom: 'Plateau Sans Gluten — Végétarien',
        prix: 12.9,
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
    contenu: [],
  },
  {
    id: 'buffet-standard',
    nom: 'Buffet Standard',
    icon: '⭐',
    prix: 35,
    prixBarre: 42,
    minPersonnes: 10,
    contenu: ['Jus artisanal offert'],
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
    contenu: ['Boissons offertes', 'Pâtisseries offertes'],
  },
];

/** Index id → article commandable (produits + formules), utilisé par le panier */
export const ORDERABLES = new Map<string, Orderable>(
  [
    ...CATEGORIES.flatMap((c) => c.produits.map((p): Orderable => ({ id: p.id, nom: p.nom, prix: p.prix }))),
    ...FORMULES.map((f): Orderable => ({ id: f.id, nom: `${f.nom} (par pers.)`, prix: f.prix, min: f.minPersonnes })),
  ].map((o) => [o.id, o]),
);
