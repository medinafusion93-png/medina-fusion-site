import { round2 } from '../lib/format';
import { STATUTS_VENTE, type Commande, type Ligne } from './types';

export const totalHT = (lignes: Ligne[]) =>
  round2(lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix_unitaire || 0), 0));

export function montants(c: Pick<Commande, 'total_ht' | 'tva_taux' | 'montant_encaisse'>) {
  const ht = round2(Number(c.total_ht) || 0);
  const tva = round2(ht * (Number(c.tva_taux) || 0));
  const ttc = round2(ht + tva);
  const encaisse = round2(Number(c.montant_encaisse) || 0);
  return { ht, tva, ttc, encaisse, reste: round2(Math.max(0, ttc - encaisse)) };
}

export const estVente = (c: Pick<Commande, 'statut'>) => STATUTS_VENTE.includes(c.statut);

/** Date locale au format YYYY-MM-DD */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function periodes(today = new Date()) {
  const jour = isoDate(today);
  const lundi = new Date(today);
  lundi.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  const debutMois = new Date(today.getFullYear(), today.getMonth(), 1);
  const finMois = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    jour: { debut: jour, fin: jour },
    semaine: { debut: isoDate(lundi), fin: isoDate(dimanche) },
    mois: { debut: isoDate(debutMois), fin: isoDate(finMois) },
  };
}

const dans = (d: string | null, p: { debut: string; fin: string }) => !!d && d >= p.debut && d <= p.fin;

export interface PeriodeStats {
  nb: number;
  ttc: number;
}

export interface DashboardStats {
  jour: PeriodeStats;
  semaine: PeriodeStats;
  mois: PeriodeStats;
  demandesATraiter: number;
  devisEnAttente: number;
  devisEnAttenteTTC: number;
  /** Ventes confirmées (toutes dates) */
  confirmeTTC: number;
  encaisse: number;
  resteAPayer: number;
  prochaines: Commande[];
}

export function dashboardStats(commandes: Commande[], today = new Date()): DashboardStats {
  const p = periodes(today);
  const ventes = commandes.filter(estVente);
  const stat = (per: { debut: string; fin: string }): PeriodeStats => {
    const l = ventes.filter((c) => dans(c.date_prestation, per));
    return { nb: l.length, ttc: round2(l.reduce((s, c) => s + montants(c).ttc, 0)) };
  };
  const devis = commandes.filter((c) => c.statut === 'devis_envoye');
  const jour = p.jour.debut;
  return {
    jour: stat(p.jour),
    semaine: stat(p.semaine),
    mois: stat(p.mois),
    demandesATraiter: commandes.filter((c) => c.statut === 'demande').length,
    devisEnAttente: devis.length,
    devisEnAttenteTTC: round2(devis.reduce((s, c) => s + montants(c).ttc, 0)),
    confirmeTTC: round2(ventes.reduce((s, c) => s + montants(c).ttc, 0)),
    encaisse: round2(ventes.reduce((s, c) => s + montants(c).encaisse, 0)),
    resteAPayer: round2(ventes.reduce((s, c) => s + montants(c).reste, 0)),
    prochaines: commandes
      .filter((c) => c.statut !== 'annulee' && c.statut !== 'livree' && !!c.date_prestation && c.date_prestation >= jour)
      .sort((a, b) => (a.date_prestation! + a.heure).localeCompare(b.date_prestation! + b.heure))
      .slice(0, 8),
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Recherche plein texte simple (client, entreprise, date JJ/MM/AAAA ou AAAA-MM-JJ) */
export function matches(q: string, ...fields: (string | null | undefined)[]) {
  const needle = norm(q.trim());
  if (!needle) return true;
  const hay = norm(
    fields
      .filter(Boolean)
      .map((f) => {
        const s = String(f);
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s} ${s.split('-').reverse().join('/')}` : s;
      })
      .join(' '),
  );
  return needle.split(/\s+/).every((w) => hay.includes(w));
}

export const telCle = (t: string) => t.replace(/\D/g, '').slice(-9);
