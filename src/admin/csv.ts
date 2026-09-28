import { montants } from './stats';
import { paiementInfo, statutInfo, type Client, type Commande } from './types';

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const num = (n: number) => n.toFixed(2).replace('.', ',');

/** CSV séparé par « ; » avec BOM : s’ouvre directement dans Excel en français */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportClients(clients: Client[]) {
  download(
    `medina-fusion-clients-${stamp()}.csv`,
    toCsv([
      ['Nom', 'Entreprise', 'Téléphone', 'Email', 'Adresse', 'Notes', 'Créé le'],
      ...clients.map((c) => [c.nom, c.entreprise, c.telephone, c.email, c.adresse, c.notes, c.created_at.slice(0, 10)]),
    ]),
  );
}

export function exportCommandes(commandes: Commande[], clientById: Map<string, Client>) {
  download(
    `medina-fusion-commandes-${stamp()}.csv`,
    toCsv([
      ['Date', 'Heure', 'Client', 'Entreprise', 'Type', 'Statut', 'Paiement', 'Personnes', 'Mode', 'Adresse', 'Détail',
        'Total HT', 'TVA', 'Total TTC', 'Encaissé', 'Reste', 'Allergies', 'Notes', 'N° devis', 'N° facture', 'Source'],
      ...commandes.map((c) => {
        const cl = c.client_id ? clientById.get(c.client_id) : undefined;
        const m = montants(c);
        return [
          c.date_prestation, c.heure, cl?.nom, cl?.entreprise, c.type, statutInfo(c.statut).label, paiementInfo(c.paiement_statut).label,
          c.nb_personnes, c.mode, c.adresse, c.lignes.map((l) => `${l.quantite} x ${l.nom}`).join(' | '),
          num(m.ht), num(m.tva), num(m.ttc), num(m.encaisse), num(m.reste), c.allergies, c.notes, c.numero_devis, c.numero_facture, c.source,
        ];
      }),
    ]),
  );
}

/** Sauvegarde complète (JSON) : réimportable, à garder une fois par semaine */
export function exportSauvegarde(clients: Client[], commandes: Commande[]) {
  download(
    `medina-fusion-sauvegarde-${stamp()}.json`,
    JSON.stringify({ exporte_le: new Date().toISOString(), clients, commandes }, null, 2),
    'application/json',
  );
}
