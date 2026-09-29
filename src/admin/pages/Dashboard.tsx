import { formatPrice } from '../../lib/format';
import { useAdmin } from '../AdminApp';
import { CONTACT } from '../../data/config';
import { derniersMois, statsMois } from '../rentabilite';
import { aRacheter, clientsARelancer, dashboardStats, montants, paiementsEnRetard } from '../stats';
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
  const { commandes, clientById, ingredients, recettes, ingredientById, charges } = useAdmin();
  const rent = charges ? statsMois(derniersMois(1)[0]!, commandes, recettes, ingredientById, charges) : null;
  const relances = clientsARelancer(commandes).slice(0, 6);
  const retards = paiementsEnRetard(commandes).slice(0, 6);
  const nomClient = (id: string | null) => {
    const cl = id ? clientById.get(id) : undefined;
    return cl?.entreprise || cl?.nom || 'Client';
  };
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

      {rent && (
        <a href="#/rentabilite" className={`block rounded-2xl border p-4 transition hover:brightness-110 ${rent.benefice >= 0 ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-red-400/50 bg-red-500/10'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-neutral-200">💰 Bénéfice estimé ce mois-ci</span>
            <span className={`text-2xl font-extrabold tabular-nums ${rent.benefice >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {rent.benefice >= 0 ? '+' : ''}
              {formatPrice(rent.benefice)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, Math.max(0, rent.progression * 100))}%` }} />
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {rent.progression >= 1 ? 'Charges du mois couvertes ✅' : `Charges couvertes à ${Math.round(Math.max(0, rent.progression) * 100)} %`}
            {rent.seuilCommandes !== null && ` · seuil ≈ ${rent.seuilCommandes} commandes / mois`} · voir le détail →
          </p>
        </a>
      )}

      {(retards.length > 0 || relances.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {retards.length > 0 && (
            <Card className="border-amber-400/40">
              <h2 className="mb-2 font-semibold text-amber-200">⏰ Paiements en retard</h2>
              <ul className="divide-y divide-white/10 text-sm">
                {retards.map((c) => (
                  <li key={c.id}>
                    <a href={`#/commandes/${c.id}`} className="flex justify-between gap-3 py-2 hover:bg-white/5">
                      <span className="truncate">
                        {nomClient(c.client_id)} <span className="text-neutral-500">· {fmtDate(c.date_prestation)}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-amber-300">{formatPrice(montants(c).reste)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {relances.length > 0 && (
            <Card>
              <h2 className="mb-1 font-semibold text-white">🔁 Clients à relancer</h2>
              <p className="mb-2 text-xs text-neutral-400">Pas de commande depuis plus de 45 jours.</p>
              <ul className="divide-y divide-white/10 text-sm">
                {relances.map((r) => {
                  const cl = clientById.get(r.client_id);
                  const msg = encodeURIComponent(
                    `Bonjour${cl?.nom ? ` ${cl.nom}` : ''}, c’est Medina Fusion ! Cela fait un moment : avez-vous un prochain déjeuner ou événement d’équipe ? Nos plateaux et buffets sont commandables en ligne en 2 minutes. À bientôt !`,
                  );
                  const tel = cl?.telephone.replace(/\D/g, '').replace(/^0/, '33') ?? '';
                  return (
                    <li key={r.client_id} className="flex items-center justify-between gap-2 py-2">
                      <a href={`#/clients/${r.client_id}`} className="min-w-0 truncate hover:text-gold">
                        {nomClient(r.client_id)} <span className="text-neutral-500">· {fmtDate(r.derniere_date)}</span>
                      </a>
                      <span className="flex shrink-0 gap-1">
                        {tel && (
                          <a className="btn-whatsapp min-h-0 px-2.5 py-1 text-xs" href={`https://wa.me/${tel}?text=${msg}`} target="_blank" rel="noreferrer">
                            WhatsApp
                          </a>
                        )}
                        {cl?.email && (
                          <a className="btn-outline min-h-0 px-2.5 py-1 text-xs" href={`mailto:${cl.email}?subject=${encodeURIComponent(`${CONTACT.nom} — votre prochain événement`)}&body=${msg}`}>
                            Email
                          </a>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}

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
