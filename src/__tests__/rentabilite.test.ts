import { describe, expect, it } from 'vitest';
import { derniersMois, statsMois, statsPlats, verdictFoodCost } from '../admin/rentabilite';
import type { Charge, Commande, Ingredient, RecetteLigne } from '../admin/types';

const base: Commande = {
  id: 'x', created_at: '', updated_at: '', client_id: null, source: 'admin', type: 'commande', statut: 'confirmee',
  paiement_statut: 'en_attente', montant_encaisse: 0, date_prestation: null, heure: '', nb_personnes: null,
  mode: 'livraison', adresse: '', lignes: [], total_ht: 0, tva_taux: 0.1, allergies: '', notes: '', parrain: '',
  numero_devis: null, numero_facture: null,
};
const ingredients = new Map<string, Ingredient>([
  ['v', { id: 'v', created_at: '', nom: 'Viande', unite: 'kg', stock: 0, seuil: 0, prix_unitaire: 12, fournisseur: '' }],
  ['b', { id: 'b', created_at: '', nom: 'Barquette', unite: 'pièce', stock: 0, seuil: 0, prix_unitaire: 0.8, fournisseur: '' }],
]);
const recettes: RecetteLigne[] = [
  { produit: 'Plateau', ingredient_id: 'v', quantite: 0.15 }, // 1,80
  { produit: 'Plateau', ingredient_id: 'b', quantite: 1 }, // 0,80  → 2,60 / plateau
];
const charges: Charge[] = [
  { id: '1', created_at: '', libelle: 'Loyer', montant: 1000, type: 'mensuel', categorie: '' },
  { id: '2', created_at: '', libelle: 'Livraison', montant: 5, type: 'par_commande', categorie: '' },
];
const cmd = (p: Partial<Commande>): Commande => ({ ...base, id: Math.random().toString(), ...p });
const commandes = [
  cmd({ date_prestation: '2026-10-05', lignes: [{ nom: 'Plateau', quantite: 20, prix_unitaire: 15 }], total_ht: 300 }),
  cmd({ date_prestation: '2026-10-20', lignes: [{ nom: 'Plateau', quantite: 10, prix_unitaire: 15 }, { nom: 'Mystère', quantite: 2, prix_unitaire: 5 }], total_ht: 160 }),
  cmd({ date_prestation: '2026-10-21', statut: 'annulee', total_ht: 999 }),
  cmd({ date_prestation: '2026-10-22', statut: 'devis_envoye', total_ht: 999 }),
  cmd({ date_prestation: '2026-09-30', total_ht: 50 }),
];

describe('rentabilité du mois', () => {
  const s = statsMois('2026-10', commandes, recettes, ingredients, charges, new Date(2026, 9, 10));
  it('CA, coût matière, frais variables, marge et bénéfice', () => {
    expect(s.nbVentes).toBe(2);
    expect(s.ca).toBe(460);
    expect(s.coutMatiere).toBe(78); // 30 plateaux × 2,60
    expect(s.fraisVariables).toBe(10);
    expect(s.margeBrute).toBe(372);
    expect(s.chargesFixes).toBe(1000);
    expect(s.benefice).toBe(-628);
  });
  it('seuil de rentabilité et commandes nécessaires', () => {
    expect(s.seuilCA).toBeCloseTo(1236.56, 1); // 1000 / (372/460)
    expect(s.seuilCommandes).toBe(6); // marge/commande = 186 → 1000/186 = 5,4 → 6
    expect(s.progression).toBeCloseTo(0.372);
    expect(s.sansRecette).toEqual(['Mystère']);
    expect(s.aVenir).toBe(1);
  });
});

describe('rentabilité par plat', () => {
  it('coût unitaire, food cost, marge totale', () => {
    const p = statsPlats(commandes, recettes, ingredients);
    const plateau = p.find((x) => x.nom === 'Plateau')!;
    expect(plateau).toMatchObject({ quantite: 30, ca: 450, coutUnitaire: 2.6, prixMoyen: 15, margeTotale: 372 });
    expect(plateau.foodCost).toBeCloseTo(0.1733, 3);
    expect(p.find((x) => x.nom === 'Mystère')!.coutUnitaire).toBeNull();
    expect(verdictFoodCost(0.4).label).toBe('Trop cher');
  });
  it('derniers mois', () => {
    expect(derniersMois(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01']);
  });
});
