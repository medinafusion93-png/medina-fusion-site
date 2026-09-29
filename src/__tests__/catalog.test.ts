import { describe, expect, it } from 'vitest';
import { CATEGORIES, FORMULES, ORDERABLES } from '../data/products';

describe('catalogue', () => {
  const produits = CATEGORIES.flatMap((c) => c.produits);

  it('contient toutes les lignes du PRD §3.3', () => {
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.produits.length]));
    expect(counts).toEqual({
      'entrees-froides': 10,
      'entrees-chaudes': 8,
      sandwichs: 6, // 5 sandwichs + Formule Sandwich
      plateaux: 5, // Sans Gluten = 2 lignes
      brochettes: 2,
      desserts: 7,
      boissons: 4,
      materiel: 5,
    });
    expect(FORMULES).toHaveLength(5);
    const lignesPanier = produits.reduce((s, p) => s + (p.options ? p.options.choix.length : 1), 0);
    expect(ORDERABLES.size).toBe(lignesPanier + FORMULES.length);
  });

  it('crée une ligne panier par choix pour les plateaux à options', () => {
    expect(ORDERABLES.get('plateau-shawarma:poulet')?.nom).toBe('Plateau Shawarma — Poulet');
    expect(ORDERABLES.get('plateau-shawarma:viande')?.nom).toBe('Plateau Shawarma — Viande');
    expect(ORDERABLES.get('plateau-signature:fromage')?.nom).toBe('Plateau Signature — beignets fromage');
    // Assiette végétarienne : toujours falafels, pas de choix
    expect(ORDERABLES.get('assiette-vegetarienne')?.prix).toBe(12.9);
    expect(ORDERABLES.get('plateau-signature:legumes')?.prix).toBe(15.9);
    expect(ORDERABLES.has('plateau-shawarma')).toBe(false);
  });

  it('a des identifiants uniques', () => {
    const ids = [...produits.map((p) => p.id), ...FORMULES.map((f) => f.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respecte les prix clés', () => {
    const prix = (id: string) => ORDERABLES.get(id)?.prix;
    expect(prix('houmous')).toBe(6);
    expect(prix('samoussa-viande')).toBe(6.5);
    expect(prix('batata-harra')).toBe(6);
    expect(prix('shawarma-poulet')).toBe(7.5);
    expect(prix('formule-sandwich')).toBe(13);
    expect(prix('plateau-signature:viande')).toBe(15.9);
    expect(prix('assiette-vegetarienne')).toBe(12.9);
    expect(prix('plateau-sans-gluten-vege')).toBe(12.9);
    expect(prix('plateau-sans-gluten-viande')).toBe(15.9);
    expect(prix('brochette-kefta')).toBe(3.5);
    expect(prix('baklawa')).toBe(4);
    expect(prix('eau-gazeuse')).toBe(2.5);
    expect(prix('kit-couverts')).toBe(1);
    expect(prix('chauffe-plat')).toBe(25);
    expect(FORMULES.map((f) => [f.prix, f.prixBarre, f.minPersonnes])).toEqual([
      [7.9, 11, 6],
      [15, 19, 8],
      [25, 30, 10],
      [35, 42, 10],
      [45, 58, 15],
    ]);
  });
});
