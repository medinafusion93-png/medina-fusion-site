import { useMemo, useState } from 'react';
import { formatPrice } from '../../lib/format';
import { hashQuery, useAdmin } from '../AdminApp';
import { exportCommandes } from '../csv';
import { matches, montants, periodes } from '../stats';
import { STATUTS, type Statut } from '../types';
import { Card, Empty, fmtDate, Input, PaiementBadge, Select, StatutBadge } from '../ui';

type Filtre = Statut | 'actives' | 'toutes';
type Periode = 'tout' | 'jour' | 'semaine' | 'mois' | 'avenir' | 'passe';

export default function CommandesPage() {
  const { commandes, clientById } = useAdmin();
  const initial = (hashQuery().get('statut') as Filtre | null) ?? 'actives';
  const [filtre, setFiltre] = useState<Filtre>(initial);
  const [periode, setPeriode] = useState<Periode>('tout');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const p = periodes();
    const today = p.jour.debut;
    return commandes
      .filter((c) => {
        if (filtre === 'actives' && (c.statut === 'annulee' || c.statut === 'livree')) return false;
        if (filtre !== 'actives' && filtre !== 'toutes' && c.statut !== filtre) return false;
        const d = c.date_prestation;
        if (periode === 'avenir' && (!d || d < today)) return false;
        if (periode === 'passe' && (!d || d >= today)) return false;
        if (periode === 'jour' || periode === 'semaine' || periode === 'mois') {
          const r = p[periode];
          if (!d || d < r.debut || d > r.fin) return false;
        }
        const cl = c.client_id ? clientById.get(c.client_id) : undefined;
        return matches(q, cl?.nom, cl?.entreprise, cl?.email, cl?.telephone, c.date_prestation, c.adresse, c.numero_devis, c.numero_facture);
      })
      .sort((a, b) => {
        // Demandes à traiter en premier, puis par date de prestation (sans date → en haut)
        if ((a.statut === 'demande') !== (b.statut === 'demande')) return a.statut === 'demande' ? -1 : 1;
        return (a.date_prestation ?? '0000').localeCompare(b.date_prestation ?? '0000') * (periode === 'passe' ? -1 : 1);
      });
  }, [commandes, clientById, filtre, periode, q]);

  const chips: { id: Filtre; label: string }[] = [
    { id: 'actives', label: 'En cours' },
    ...STATUTS.map((s) => ({ id: s.id as Filtre, label: s.label })),
    { id: 'toutes', label: 'Toutes' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-white">Commandes</h1>
        <div className="flex gap-2">
          <button type="button" className="btn-outline px-3 text-xs" onClick={() => exportCommandes(list, clientById)}>
            ⬇ Exporter ({list.length})
          </button>
          <a href="#/commandes/nouvelle" className="btn-gold px-4">
            + Nouvelle
          </a>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex w-max gap-2" role="group" aria-label="Filtrer par statut">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filtre === c.id}
              onClick={() => setFiltre(c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                filtre === c.id ? 'border-gold bg-gold text-ink' : 'border-white/15 text-neutral-200 hover:border-gold'
              }`}
            >
              {c.label}
              {c.id === 'demande' && ` (${commandes.filter((x) => x.statut === 'demande').length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input
          type="search"
          placeholder="Rechercher : client, entreprise, date (12/10/2026), n° facture…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Rechercher une commande"
        />
        <Select value={periode} onChange={(e) => setPeriode(e.target.value as Periode)} aria-label="Période">
          <option value="tout">Toutes les dates</option>
          <option value="jour">Aujourd’hui</option>
          <option value="semaine">Cette semaine</option>
          <option value="mois">Ce mois-ci</option>
          <option value="avenir">À venir</option>
          <option value="passe">Passées</option>
        </Select>
      </div>

      {list.length === 0 ? (
        <Empty>Aucune commande ne correspond.</Empty>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => {
            const cl = c.client_id ? clientById.get(c.client_id) : undefined;
            const m = montants(c);
            return (
              <li key={c.id}>
                <a href={`#/commandes/${c.id}`} className="block">
                  <Card className="transition hover:border-gold/60">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {cl?.entreprise || cl?.nom || 'Client inconnu'}
                          {c.type === 'degustation' && <span className="ml-2 text-xs text-violet-300">🎁 Dégustation</span>}
                          {c.source === 'site' && <span className="ml-2 text-xs text-neutral-400">· via le site</span>}
                        </p>
                        <p className="text-sm text-neutral-300">
                          📅 {fmtDate(c.date_prestation)}
                          {c.heure && ` · ${c.heure}`}
                          {c.nb_personnes ? ` · ${c.nb_personnes} pers.` : ''}
                          {c.mode === 'retrait' ? ' · 🏪 Retrait' : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatutBadge statut={c.statut} />
                        <PaiementBadge statut={c.paiement_statut} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span className="truncate text-neutral-400">
                        {c.lignes.length ? c.lignes.map((l) => `${l.quantite}× ${l.nom}`).join(', ') : 'Aucune prestation saisie'}
                      </span>
                      <span className="font-bold tabular-nums text-gold">
                        {formatPrice(m.ttc)} TTC
                        {m.reste > 0 && m.encaisse > 0 && <span className="ml-2 text-xs font-normal text-amber-300">reste {formatPrice(m.reste)}</span>}
                      </span>
                    </div>
                    {c.allergies && <p className="mt-2 text-xs font-semibold text-red-300">⚠️ {c.allergies}</p>}
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
