import { describe, expect, it } from 'vitest';
import { ORDERABLES } from '../data/products';
import { clamp, step, toLines, totals } from '../lib/cart';

describe('panier', () => {
  it('incrémente / décrémente depuis 0', () => {
    expect(step(0, 1)).toBe(1);
    expect(step(1, -1)).toBe(0);
    expect(step(0, -1)).toBe(0);
  });

  it('applique le minimum de personnes des formules', () => {
    expect(step(0, 1, 10)).toBe(10);
    expect(step(10, 1, 10)).toBe(11);
    expect(step(11, -1, 10)).toBe(10);
    expect(step(10, -1, 10)).toBe(0);
    expect(clamp(3, 10)).toBe(10);
    expect(clamp(0, 10)).toBe(0);
    expect(clamp(Number.NaN)).toBe(0);
    expect(clamp(5000)).toBe(999);
  });

  it('calcule le total en temps réel sans erreur d’arrondi', () => {
    const lines = toLines({ 'plateau-signature': 3, 'eau-gazeuse': 3, 'buffet-standard': 10, inconnu: 4 }, ORDERABLES);
    expect(lines).toHaveLength(3);
    expect(totals(lines)).toEqual({ count: 16, total: 47.7 + 7.5 + 350 });
  });
});
