import { describe, expect, it } from 'vitest';
import { ORDERABLES } from '../data/products';
import { toLines } from '../lib/cart';
import { suggestions } from '../lib/suggestions';
import { dateMinISO } from '../lib/validation';

describe('suggestions panier', () => {
  it('propose boissons et desserts manquants', () => {
    const s = suggestions(toLines({ 'plateau-shawarma:poulet': 6, 'assiette-vegetarienne': 4, citronnade: 3 }, ORDERABLES));
    expect(s.map((x) => x.lignes)).toEqual([
      [{ id: 'kit-couverts', quantite: 10 }],
      [{ id: 'citronnade', quantite: 7 }],
      [{ id: 'baklawa', quantite: 10 }],
    ]);
  });
  it('propose couverts et chauffe-plats pour un buffet, sans doublon', () => {
    const s = suggestions(toLines({ 'buffet-standard': 20 }, ORDERABLES));
    expect(s.map((x) => x.lignes)).toEqual([[{ id: 'kit-couverts', quantite: 20 }], [{ id: 'chauffe-plat', quantite: 1 }]]);
    expect(suggestions(toLines({ 'buffet-standard': 20, 'kit-couverts': 20, 'chauffe-plat': 1 }, ORDERABLES))).toEqual([]);
    expect(suggestions(toLines({ 'brochette-kefta': 12 }, ORDERABLES)).map((x) => x.id)).toEqual(['chauffe-plat']);
  });
  it('chauffe-plat offert (0 €) dès 30 convives de buffet', () => {
    const s = suggestions(toLines({ 'buffet-prestige': 45 }, ORDERABLES));
    expect(s[1]!.lignes).toEqual([{ id: 'chauffe-plat-offert', quantite: 3 }]);
    expect(ORDERABLES.get('chauffe-plat-offert')?.prix).toBe(0);
    expect(suggestions(toLines({ 'buffet-prestige': 45, 'kit-couverts': 45, 'chauffe-plat-offert': 3 }, ORDERABLES))).toEqual([]);
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
