import type { CartLine, Orderable } from '../types';
import { round2 } from './format';

export type Quantities = Record<string, number>;

/**
 * Nouvelle quantité après un clic +/-.
 * Pour les articles avec minimum (formules) : 0 → min au premier "+", min → 0 au "-".
 */
export function step(current: number, delta: 1 | -1, min = 1): number {
  if (delta === 1) return current === 0 ? Math.max(min, 1) : current + 1;
  if (current <= min) return 0;
  return current - 1;
}

/** Normalise une saisie libre : 0 ou >= min, entier, borné à 999 */
export function clamp(value: number, min = 1): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(999, Math.max(Math.floor(value), min));
}

export function toLines(quantities: Quantities, catalog: Map<string, Orderable>): CartLine[] {
  const lines: CartLine[] = [];
  for (const [id, quantite] of Object.entries(quantities)) {
    const item = catalog.get(id);
    if (!item || quantite <= 0) continue;
    lines.push({ id, nom: item.nom, quantite, prix_unitaire: item.prix });
  }
  return lines;
}

export function totals(lines: CartLine[]): { count: number; total: number } {
  let count = 0;
  let total = 0;
  for (const l of lines) {
    count += l.quantite;
    total += l.quantite * l.prix_unitaire;
  }
  return { count, total: round2(total) };
}
