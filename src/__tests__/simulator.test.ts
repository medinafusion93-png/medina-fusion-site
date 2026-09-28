import { describe, expect, it } from 'vitest';
import { ORDERABLES } from '../data/products';
import { budgetMinimum, candidates, propose } from '../lib/simulator';

describe('simulateur budget', () => {
  it('toutes les recettes utilisent des articles du catalogue', () => {
    for (const moment of ['petit-dej', 'dejeuner', 'evenement'] as const) {
      for (const c of candidates({ personnes: 20, budget: 100, moment, vege: 3 })) {
        for (const l of c.lignes) expect(ORDERABLES.has(l.id), `${c.key} → ${l.id}`).toBe(true);
      }
    }
  });

  it('propose le menu le plus complet dans le budget, une option éco et une option premium', () => {
    const res = propose({ personnes: 15, budget: 20, moment: 'dejeuner', vege: 0 });
    const ideal = res.find((p) => p.tag === 'ideal')!;
    expect(ideal.parPersonne).toBeLessThanOrEqual(20);
    expect(res.find((p) => p.tag === 'eco')!.parPersonne).toBeLessThan(ideal.parPersonne);
    expect(res.find((p) => p.tag === 'premium')!.parPersonne).toBeGreaterThan(20);
    // Plateau Shawarma 15,90 + citronnade 4 = 19,90 €/pers
    expect(ideal.key).toBe('plateau-shawarma');
    expect(ideal.parPersonne).toBe(19.9);
  });

  it('répartit les végétariens sur l’assiette végétarienne', () => {
    const res = propose({ personnes: 10, budget: 20, moment: 'dejeuner', vege: 3 });
    const ideal = res.find((p) => p.tag === 'ideal')!;
    expect(ideal.lignes).toContainEqual({ id: 'plateau-shawarma', quantite: 7 });
    expect(ideal.lignes).toContainEqual({ id: 'assiette-vegetarienne', quantite: 3 });
  });

  it('sans gluten : plateau sans gluten et dessert sans gluten', () => {
    const res = candidates({ personnes: 10, budget: 30, moment: 'dejeuner', vege: 2, sansGluten: 3 });
    const sig = res.find((c) => c.key === 'plateau-signature')!;
    expect(sig.lignes).toContainEqual({ id: 'plateau-signature', quantite: 5 });
    expect(sig.lignes).toContainEqual({ id: 'assiette-vegetarienne', quantite: 2 });
    expect(sig.lignes).toContainEqual({ id: 'plateau-sans-gluten-viande', quantite: 3 });
    expect(sig.lignes).toContainEqual({ id: 'baklawa', quantite: 7 });
    expect(sig.lignes).toContainEqual({ id: 'salade-de-fruits', quantite: 3 });
    const formule = res.find((c) => c.key === 'formule-sandwich')!;
    expect(formule.lignes).toContainEqual({ id: 'formule-sandwich', quantite: 7 });
    expect(formule.lignes).toContainEqual({ id: 'plateau-sans-gluten-viande', quantite: 3 });
    // chaque convive a bien un plat principal
    for (const c of res.filter((c) => !c.key.startsWith('buffet'))) {
      const plats = c.lignes
        .filter((l) => /plateau|assiette|shawarma|sandwich|formule-sandwich/.test(l.id))
        .reduce((s, l) => s + l.quantite, 0);
      expect(plats, c.key).toBe(10);
    }
  });

  it('respecte le minimum de personnes des formules', () => {
    const keys = candidates({ personnes: 8, budget: 100, moment: 'evenement', vege: 0 }).map((c) => c.key);
    expect(keys).not.toContain('buffet-classique');
    expect(keys).not.toContain('buffet-prestige');
    const keys15 = candidates({ personnes: 15, budget: 100, moment: 'evenement', vege: 0 }).map((c) => c.key);
    expect(keys15).toContain('buffet-prestige');
  });

  it('budget trop bas : propose le moins cher et indique le minimum', () => {
    const res = propose({ personnes: 10, budget: 5, moment: 'petit-dej', vege: 0 });
    expect(res).toHaveLength(1);
    expect(res[0]!.tag).toBe('ideal');
    expect(res[0]!.key).toBe('petit-dej');
    expect(budgetMinimum({ personnes: 10, moment: 'petit-dej', vege: 0 })).toBe(7.9);
  });
});
