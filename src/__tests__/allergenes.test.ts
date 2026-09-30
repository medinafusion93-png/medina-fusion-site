import { describe, expect, it } from 'vitest';
import { ALLERGENES, ALLERGENES_14, texteAllergenes } from '../data/allergenes';
import { ORDERABLES } from '../data/products';

describe('allergènes', () => {
  it('ne référence que des produits existants et des allergènes officiels', () => {
    for (const [id, liste] of Object.entries(ALLERGENES)) {
      expect(ORDERABLES.has(id), id).toBe(true);
      for (const a of liste) expect(ALLERGENES_14).toContain(a);
    }
  });
  it('affiche le texte selon le cas (renseigné, aucun, inconnu, non alimentaire)', () => {
    expect(texteAllergenes('baklawa')).toBe('Allergènes : Gluten, Lait, Fruits à coque, Sésame');
    expect(texteAllergenes('falafel-entree')).toBe('Aucun des 14 allergènes majeurs');
    expect(texteAllergenes('samoussa-viande')).toBe('Allergènes : nous consulter');
    expect(texteAllergenes('kit-buffet-complet')).toBeNull();
  });
});
