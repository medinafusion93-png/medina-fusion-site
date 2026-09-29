import { formatPrice } from '../../lib/format';
import { useAdmin } from '../AdminApp';
import { aRacheter, dashboardStats, montants } from '../stats';
import { Card, Empty, fmtDate, PaiementBadge, StatutBadge } from '../ui';

function Tile({ label, value, sub, href, accent }: { label: string; value: string; sub?: string; href?: string; accent?: boolean }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums sm:text-2xl ${accent ? 'text-gold' : 'text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </>
  );
  const cls = 'block rounded-2xl border border-white/10 bg-ink-800 p-4 transition';
  return href ? (
    <a href={href} className={`${cls} hover:border-gold/60`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function Dashboard() {
  const { commandes, clientById, ingredients } = useAdmin();
  const courses = (ingredients ?? []).filter(aRacheter);
  const s = dashboardStats(commandes);
  const nb = (n: number) => `${n} commande${n > 1 ? 's' : ''}`;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-white">Tableau de bord</h1>

      {s.demandesATraiter > 0 && (
        <a
          href="#/commandes?statut=demande"
          className="flex items-center justify-between gap-3 rounded-2xl border border-sky-400/50 bg-sky-500/10 p-4 text-sky-100 hover:bg-sky-500/20"
        >
          <span>
            📥 <strong>{s.demandesATraiter}</strong> nouvelle{s.demandesATraiter > 1 ? 's' : ''} demande
            {s.demandesATraiter > 1 ? 's' : ''} du site à traiter
          </span>
          <span aria-hidden="true">→</span>
        </a>
      )}

      {courses.length > 0 && (
        <a
          href="#/stock"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4 text-amber-100 hover:bg-amber-500/20"
        >
          <span>
            🛒 <strong>{courses.length}</strong> ingrédient{courses.length > 1 ? 's' : ''} à racheter :{' '}
            {courses.slice(0, 4).map((i) => i.nom).join(', ')}
            {courses.length > 4 ? '…' : ''}
          </span>
          <span aria-hidden="true">→</span>
        </a>
      )}

      <section aria-label="Activité">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">Prestations confirmées (TTC)</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Aujourd’hui" value={formatPrice(s.jour.ttc)} sub={nb(s.jour.nb)} />
          <Tile label="Cette semaine" value={formatPrice(s.semaine.ttc)} sub={nb(s.semaine.nb)} />
          <Tile label="Ce mois-ci" value={formatPrice(s.mois.ttc)} sub={nb(s.mois.nb)} accent />
        </div>
      </section>

      <section aria-label="Finances" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Ventes confirmées" value={formatPrice(s.confirmeTTC)} sub="Toutes dates, TTC" />
        <Tile label="Encaissé" value={formatPrice(s.encaisse)} sub="Sur les ventes confirmées" />
        <Tile label="Reste à payer" value={formatPrice(s.resteAPayer)} sub="À relancer" accent />
        <Tile
          label="Devis en attente"
          value={String(s.devisEnAttente)}
          sub={s.devisEnAttente ? `${formatPrice(s.devisEnAttenteTTC)} TTC potentiels` : 'Aucun'}
          href="#/commandes?statut=devis_envoye"
        />
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-white">Prochaines prestations</h2>
          <a href="#/calendrier" className="text-sm text-gold underline underline-offset-2">
            Calendrier
          </a>
        </div>
        {s.prochaines.length === 0 ? (
          <Empty>Aucune prestation à venir.</Empty>
        ) : (
          <ul className="divide-y divide-white/10">
            {s.prochaines.map((c) => {
              const cl = c.client_id ? clientById.get(c.client_id) : undefined;
              return (
                <li key={c.id}>
                  <a
                    href={`#/commandes/${c.id}`}
                    className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 py-3 hover:bg-white/5 sm:grid-cols-[112px_minmax(0,1fr)_auto]"
                  >
                    <span className="text-sm font-semibold text-gold-light">
                      {fmtDate(c.date_prestation)}
                      {c.heure && <span className="block text-xs font-normal text-neutral-400">{c.heure}</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">{cl?.entreprise || cl?.nom || 'Client inconnu'}</span>
                      <span className="block truncate text-xs text-neutral-400">
                        {c.nb_personnes ? `${c.nb_personnes} pers. · ` : ''}
                        {formatPrice(montants(c).ttc)} TTC
                      </span>
                    </span>
                    <span className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:flex-col sm:items-end sm:gap-1">
                      <StatutBadge statut={c.statut} />
                      <PaiementBadge statut={c.paiement_statut} />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="text-xs text-neutral-500">
        Les demandes non validées, devis non acceptés et commandes annulées ne sont pas comptés dans les ventes.
      </p>
    </div>
  );
}
