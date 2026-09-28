import { describe, expect, it } from 'vitest';
import { ORDERABLES } from '../data/products';
import { toLines } from '../lib/cart';
import { suggestions } from '../lib/suggestions';
import { dateMinISO } from '../lib/validation';

describe('suggestions panier', () => {
  it('propose boissons et desserts manquants', () => {
    const s = suggestions(toLines({ 'plateau-shawarma:poulet': 6, 'assiette-vegetarienne': 4, citronnade: 3 }, ORDERABLES));
    expect(s.map((x) => x.lignes)).toEqual([[{ id: 'citronnade', quantite: 7 }], [{ id: 'baklawa', quantite: 10 }]]);
  });
  it('rien sous 3 repas, ni pour la formule sandwich (tout compris)', () => {
    expect(suggestions(toLines({ 'plateau-shawarma:viande': 2 }, ORDERABLES))).toEqual([]);
    expect(suggestions(toLines({ 'formule-sandwich': 10 }, ORDERABLES))).toEqual([]);
  });
});

describe('délai minimum', () => {
  it('date min = aujourd’hui + 2 jours', () => {
    expect(dateMinISO(new Date(2026, 9, 30))).toBe('2026-11-01');
  });
});
