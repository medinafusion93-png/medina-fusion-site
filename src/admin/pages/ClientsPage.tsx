import { useMemo, useState } from 'react';
import { formatPrice } from '../../lib/format';
import { useAdmin } from '../AdminApp';
import { exportClients, exportSauvegarde } from '../csv';
import { estVente, matches, montants } from '../stats';
import { Card, Empty, Input } from '../ui';

export default function ClientsPage() {
  const { clients, commandes } = useAdmin();
  const [q, setQ] = useState('');

  const parClient = useMemo(() => {
    const map = new Map<string, { nb: number; ca: number; derniere: string | null }>();
    for (const c of commandes) {
      if (!c.client_id) continue;
      const s = map.get(c.client_id) ?? { nb: 0, ca: 0, derniere: null };
      s.nb += 1;
      if (estVente(c)) s.ca += montants(c).ttc;
      if (c.date_prestation && (!s.derniere || c.date_prestation > s.derniere)) s.derniere = c.date_prestation;
      map.set(c.client_id, s);
    }
    return map;
  }, [commandes]);

  const list = clients
    .filter((c) => matches(q, c.nom, c.entreprise, c.email, c.telephone, c.adresse))
    .sort((a, b) => (a.entreprise || a.nom).localeCompare(b.entreprise || b.nom, 'fr'));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-white">Clients ({clients.length})</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline px-3 text-xs" onClick={() => exportClients(clients)}>
            ⬇ Export Excel
          </button>
          <button type="button" className="btn-outline px-3 text-xs" onClick={() => exportSauvegarde(clients, commandes)} title="Clients + commandes, format JSON">
            💾 Sauvegarde complète
          </button>
          <a href="#/clients/nouveau" className="btn-gold px-4">
            + Nouveau client
          </a>
        </div>
      </div>
      <Input type="search" placeholder="Rechercher : nom, entreprise, téléphone, email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un client" />
      {list.length === 0 ? (
        <Empty>Aucun client.</Empty>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {list.map((c) => {
            const s = parClient.get(c.id);
            return (
              <li key={c.id}>
                <a href={`#/clients/${c.id}`} className="block h-full">
                  <Card className="h-full transition hover:border-gold/60">
                    <p className="font-semibold text-white">{c.entreprise || c.nom}</p>
                    {c.entreprise && <p className="text-sm text-neutral-300">{c.nom}</p>}
                    <p className="mt-1 text-sm text-neutral-400">
                      {[c.telephone, c.email].filter(Boolean).join(' · ') || 'Pas de coordonnées'}
                    </p>
                    <p className="mt-2 text-xs text-neutral-400">
                      {s ? `${s.nb} commande${s.nb > 1 ? 's' : ''} · ${formatPrice(s.ca)} TTC` : 'Aucune commande'}
                    </p>
                  </Card>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
