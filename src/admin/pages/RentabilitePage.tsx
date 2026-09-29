import { useId, useMemo, useState, type FormEvent } from 'react';
import { formatPrice, round2 } from '../../lib/format';
import { useAdmin } from '../AdminApp';
import { derniersMois, moisDe, statsMois, statsPlats, totalCharges, verdictFoodCost, type MoisStats } from '../rentabilite';
import type { Charge, ChargeInput } from '../types';
import { estVente } from '../stats';
import { Card, Empty, Field, Input, Select } from '../ui';

const moisFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const moisCourt = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const libMois = (m: string, court = false) => {
  const [y, mo] = m.split('-').map(Number);
  return (court ? moisCourt : moisFmt).format(new Date(y!, mo! - 1, 1));
};
const pct = (x: number) => `${Math.round(x * 100)} %`;

// ---------------------------------------------------------------------------
function Resume({ s }: { s: MoisStats }) {
  const positif = s.benefice >= 0;
  const manque = s.seuilCA !== null ? round2(Math.max(0, s.seuilCA - s.ca)) : null;
  const commandesManquantes = s.seuilCommandes !== null ? Math.max(0, s.seuilCommandes - s.nbVentes) : null;
  const barre = Math.min(1, Math.max(0, s.progression));

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Card className={positif ? 'border-emerald-400/50' : 'border-red-400/50'}>
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Bénéfice estimé du mois</p>
        <p className={`mt-1 text-4xl font-extrabold tabular-nums ${positif ? 'text-emerald-300' : 'text-red-300'}`}>
          {positif ? '+' : ''}
          {formatPrice(s.benefice)}
        </p>
        <p className="mt-1 text-sm text-neutral-300">
          {positif ? '✅ Vous gagnez de l’argent ce mois-ci.' : '⚠️ Les charges ne sont pas encore couvertes.'}
        </p>

        <div className="mt-5">
          <div className="mb-1 flex justify-between text-xs text-neutral-400">
            <span>Couverture des charges fixes</span>
            <span>{pct(Math.max(0, s.progression))}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(barre * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full ${barre >= 1 ? 'bg-emerald-400' : 'bg-gold'}`} style={{ width: `${barre * 100}%` }} />
          </div>
          {s.seuilCA !== null ? (
            <p className="mt-2 text-sm text-neutral-300">
              Seuil de rentabilité : <strong className="text-white">{formatPrice(s.seuilCA)} HT</strong>
              {s.seuilCommandes !== null && <> ≈ <strong className="text-white">{s.seuilCommandes} commandes</strong></>} / mois.
              {manque !== null && manque > 0 && (
                <span className="block text-amber-300">
                  Il manque {formatPrice(manque)} HT{commandesManquantes ? ` ≈ ${commandesManquantes} commande${commandesManquantes > 1 ? 's' : ''}` : ''}.
                </span>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm text-neutral-400">Le seuil s’affichera dès la première vente du mois.</p>
          )}
        </div>
      </Card>

      <Card>
        <dl className="space-y-2 text-sm">
          {(
            [
              ['Chiffre d’affaires HT', s.ca, 'text-white', `${s.nbVentes} vente${s.nbVentes > 1 ? 's' : ''} · panier moyen ${formatPrice(s.panierMoyen)}`],
              ['− Coût matière', -s.coutMatiere, 'text-red-200', s.ca ? `${pct(s.coutMatiere / s.ca)} du CA` : ''],
              ['− Frais par commande', -s.fraisVariables, 'text-red-200', ''],
              ['= Marge brute', s.margeBrute, 'text-gold', s.ca ? `${pct(s.tauxMarge)} du CA` : ''],
              ['− Charges fixes', -s.chargesFixes, 'text-red-200', ''],
            ] as const
          ).map(([label, v, color, sub]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2">
              <dt className="text-neutral-300">
                {label}
                {sub && <span className="block text-xs text-neutral-500">{sub}</span>}
              </dt>
              <dd className={`font-semibold tabular-nums ${color}`}>{formatPrice(v)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 pt-1 text-base">
            <dt className="font-bold text-white">= Bénéfice</dt>
            <dd className={`text-xl font-extrabold tabular-nums ${s.benefice >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatPrice(s.benefice)}</dd>
          </div>
        </dl>
        {s.aVenir > 0 && <p className="mt-3 text-xs text-sky-300">📅 Inclut {s.aVenir} prestation(s) confirmée(s) encore à venir ce mois-ci.</p>}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Conseils({ s, platsTropChers }: { s: MoisStats; platsTropChers: string[] }) {
  const conseils: string[] = [];
  if (s.sansRecette.length)
    conseils.push(`Ajoutez la recette de ${s.sansRecette.slice(0, 3).join(', ')}${s.sansRecette.length > 3 ? '…' : ''} dans Stock → Recettes : leur coût n’est pas encore compté, le bénéfice affiché est donc trop optimiste.`);
  if (platsTropChers.length)
    conseils.push(`Coût matière trop élevé (> 35 %) sur ${platsTropChers.slice(0, 3).join(', ')} : augmentez le prix, réduisez la portion ou négociez avec le fournisseur.`);
  if (s.ca > 0 && s.coutMatiere / s.ca > 0.35) conseils.push('Votre coût matière global dépasse 35 % du chiffre d’affaires : visez 25 à 30 %.');
  if (s.benefice < 0 && s.seuilCommandes !== null)
    conseils.push(`Objectif du mois : ${s.seuilCommandes} commandes pour couvrir vos charges. Relancez vos clients fidèles et proposez la dégustation gratuite aux entreprises proches.`);
  if (s.panierMoyen > 0 && s.panierMoyen < 250) conseils.push('Panier moyen sous 250 € HT : mettez en avant les buffets et formules (simulateur « Premium ») pour l’augmenter.');
  if (s.chargesFixes === 0) conseils.push('Renseignez vos charges fixes (loyer, salaires…) ci-dessous pour obtenir votre vrai bénéfice.');
  if (conseils.length === 0) conseils.push('Tout est au vert 👏 Continuez à suivre vos prix d’achat pour garder vos marges.');
  return (
    <Card className="border-gold/40">
      <h2 className="mb-2 font-semibold text-gold-light">💡 Conseils automatiques</h2>
      <ul className="space-y-2 text-sm text-neutral-200">
        {conseils.map((c) => (
          <li key={c} className="flex gap-2">
            <span aria-hidden="true">→</span>
            {c}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function Simulation({ s }: { s: MoisStats }) {
  const uid = useId();
  const [hausse, setHausse] = useState(0);
  const [extra, setExtra] = useState(0);
  // Hausse de prix : le CA augmente, les coûts restent identiques.
  // Commandes en plus : au panier moyen (augmenté) avec les coûts actuels → marge = panier × (taux de marge + hausse)
  const h = hausse / 100;
  const caHausse = s.ca * h;
  const margeExtra = extra * s.panierMoyen * (s.tauxMarge + h);
  const benefice = round2(s.benefice + caHausse + margeExtra);
  const gain = round2(benefice - s.benefice);
  return (
    <Card>
      <h2 className="mb-1 font-semibold text-white">🔮 Et si… ?</h2>
      <p className="mb-4 text-sm text-neutral-400">Simulez l’effet d’une hausse de prix ou de commandes en plus sur ce mois.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Hausse des prix : +${hausse} %`} id={`${uid}-h`}>
          <input id={`${uid}-h`} type="range" min={0} max={20} value={hausse} onChange={(e) => setHausse(Number(e.target.value))} className="w-full accent-[#d4af37]" />
        </Field>
        <Field label={`Commandes en plus : +${extra}`} id={`${uid}-e`}>
          <input id={`${uid}-e`} type="range" min={0} max={30} value={extra} onChange={(e) => setExtra(Number(e.target.value))} className="w-full accent-[#d4af37]" />
        </Field>
      </div>
      <p className="mt-4 text-sm text-neutral-300">
        Bénéfice simulé : <strong className={`text-xl ${benefice >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatPrice(benefice)}</strong>
        {gain !== 0 && <span className="ml-2 text-emerald-300">(+{formatPrice(gain)})</span>}
      </p>
      {s.nbVentes === 0 && <p className="mt-1 text-xs text-neutral-500">La simulation utilise le panier moyen du mois : disponible après la première vente.</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
function Historique({ lignes }: { lignes: MoisStats[] }) {
  const max = Math.max(1, ...lignes.map((l) => Math.abs(l.benefice)), ...lignes.map((l) => l.ca));
  return (
    <Card>
      <h2 className="mb-3 font-semibold text-white">📈 6 derniers mois</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-400">
              <th className="py-2">Mois</th>
              <th className="py-2 text-right">Ventes</th>
              <th className="py-2 text-right">CA HT</th>
              <th className="py-2 text-right">Marge brute</th>
              <th className="py-2 text-right">Bénéfice</th>
              <th className="w-32 py-2 pl-3" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.mois} className="border-t border-white/5">
                <td className="py-2 capitalize text-neutral-200">{libMois(l.mois)}</td>
                <td className="py-2 text-right tabular-nums">{l.nbVentes}</td>
                <td className="py-2 text-right tabular-nums">{formatPrice(l.ca)}</td>
                <td className="py-2 text-right tabular-nums text-gold">{formatPrice(l.margeBrute)}</td>
                <td className={`py-2 text-right font-semibold tabular-nums ${l.benefice >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatPrice(l.benefice)}</td>
                <td className="py-2 pl-3">
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gold" style={{ width: `${(l.ca / max) * 100}%` }} title={`CA ${formatPrice(l.ca)}`} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function Charges() {
  const { charges, api, reload } = useAdmin();
  const uid = useId();
  const [f, setF] = useState<ChargeInput>({ libelle: '', montant: 0, type: 'mensuel', categorie: '' });
  const [err, setErr] = useState('');
  if (!charges) return null;
  const { fixes, parCommande } = totalCharges(charges);

  const ajouter = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.libelle.trim() || !(f.montant > 0)) return setErr('Indiquez un libellé et un montant.');
    setErr('');
    await api.saveCharge({ ...f, libelle: f.libelle.trim() });
    setF({ libelle: '', montant: 0, type: f.type, categorie: '' });
    await reload();
  };
  const maj = async (c: Charge, montant: number) => {
    await api.saveCharge({ id: c.id, libelle: c.libelle, montant, type: c.type, categorie: c.categorie });
    await reload();
  };
  const suppr = async (c: Charge) => {
    if (!window.confirm(`Supprimer « ${c.libelle} » ?`)) return;
    await api.deleteCharge(c.id);
    await reload();
  };

  return (
    <Card>
      <h2 className="font-semibold text-white">🧾 Mes charges</h2>
      <p className="mb-4 text-sm text-neutral-400">
        Montants HT. Charges fixes : <strong className="text-white">{formatPrice(fixes)} / mois</strong> · Frais par commande :{' '}
        <strong className="text-white">{formatPrice(parCommande)}</strong>
      </p>
      {charges.length === 0 ? (
        <Empty>Ajoutez votre loyer, vos salaires, l’énergie, l’assurance… et vos frais de livraison par commande.</Empty>
      ) : (
        <ul className="divide-y divide-white/10">
          {charges.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 text-neutral-200">
                {c.libelle}
                <span className="block text-xs text-neutral-500">{c.type === 'mensuel' ? 'par mois' : 'par commande'}</span>
              </span>
              <div className="w-28 shrink-0">
              <Input
                aria-label={`Montant ${c.libelle}`}
                type="number"
                min={0}
                step="0.01"
                defaultValue={c.montant}
                onBlur={(e) => Number(e.target.value) !== c.montant && void maj(c, Number(e.target.value) || 0)}
                className="py-1.5 text-right"
              />
              </div>
              <button type="button" aria-label={`Supprimer ${c.libelle}`} onClick={() => void suppr(c)} className="h-9 w-9 rounded-full border border-white/15 text-red-300">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={ajouter} className="mt-4 grid gap-2 sm:grid-cols-2 sm:items-end">
        <Field label="Nouvelle charge" id={`${uid}-l`}>
          <Input id={`${uid}-l`} value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} placeholder="Ex. Loyer, Salaires, Emballages…" />
        </Field>
        <Field label="Montant HT" id={`${uid}-m`}>
          <Input id={`${uid}-m`} type="number" min={0} step="0.01" value={f.montant || ''} onChange={(e) => setF({ ...f, montant: Number(e.target.value) })} />
        </Field>
        <Field label="Fréquence" id={`${uid}-t`}>
          <Select id={`${uid}-t`} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Charge['type'] })}>
            <option value="mensuel">Par mois</option>
            <option value="par_commande">Par commande</option>
          </Select>
        </Field>
        <button type="submit" className="btn-gold">
          Ajouter
        </button>
      </form>
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
export default function RentabilitePage() {
  const { commandes, recettes, ingredientById, charges, ingredients } = useAdmin();
  const moisDispo = useMemo(() => {
    const set = new Set(derniersMois(12));
    commandes.forEach((c) => c.date_prestation && set.add(moisDe(c.date_prestation)));
    return [...set].sort().reverse();
  }, [commandes]);
  const [mois, setMois] = useState(derniersMois(1)[0]!);

  if (charges === null)
    return (
      <Card>
        <h1 className="font-display text-2xl font-bold text-white">💰 Rentabilité</h1>
        <p className="mt-3 text-neutral-300">
          Le module rentabilité n’est pas encore installé dans votre base de données. Exécutez le fichier{' '}
          <code className="text-gold">supabase/finance.sql</code> dans Supabase → SQL Editor, puis rechargez la page.
        </p>
      </Card>
    );

  const s = statsMois(mois, commandes, recettes, ingredientById, charges);
  // Historique à partir du mois de la première vente (pas de mois « vides » avant le démarrage)
  const premier = commandes.filter((c) => estVente(c) && c.date_prestation).map((c) => moisDe(c.date_prestation)).sort()[0];
  const historique = derniersMois(6)
    .filter((m) => !premier || m >= premier)
    .map((m) => statsMois(m, commandes, recettes, ingredientById, charges));
  const plats = statsPlats(commandes, recettes, ingredientById, (c) => moisDe(c.date_prestation) === mois);
  const tropChers = plats.filter((p) => (p.foodCost ?? 0) > 0.35).map((p) => p.nom);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-display text-2xl font-bold text-white">💰 Rentabilité</h1>
        <div className="w-56">
        <Select value={mois} onChange={(e) => setMois(e.target.value)} aria-label="Mois" className="capitalize">
          {moisDispo.map((m) => (
            <option key={m} value={m} className="capitalize">
              {libMois(m)}
            </option>
          ))}
        </Select>
        </div>
      </div>
      {!ingredients && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-950/50 p-3 text-sm text-amber-100">
          Module stock non installé : le coût matière n’est pas calculé (exécutez supabase/stock.sql).
        </p>
      )}

      <Resume s={s} />
      <Conseils s={s} platsTropChers={tropChers} />

      <Card>
        <h2 className="mb-3 font-semibold text-white">🍽️ Rentabilité par plat — {libMois(mois)}</h2>
        {plats.length === 0 ? (
          <Empty>Aucune vente confirmée ce mois-ci.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-neutral-400">
                  <th className="py-2">Plat</th>
                  <th className="py-2 text-right">Vendus</th>
                  <th className="py-2 text-right">Prix HT</th>
                  <th className="py-2 text-right">Coût / portion</th>
                  <th className="py-2 text-right">Coût matière</th>
                  <th className="py-2 text-right">Marge totale</th>
                </tr>
              </thead>
              <tbody>
                {plats.map((p) => {
                  const v = verdictFoodCost(p.foodCost);
                  return (
                    <tr key={p.nom} className="border-t border-white/5">
                      <td className="py-2 text-neutral-100">{p.nom}</td>
                      <td className="py-2 text-right tabular-nums">{p.quantite}</td>
                      <td className="py-2 text-right tabular-nums">{formatPrice(p.prixMoyen)}</td>
                      <td className="py-2 text-right tabular-nums">{p.coutUnitaire !== null ? formatPrice(p.coutUnitaire) : '—'}</td>
                      <td className={`py-2 text-right tabular-nums ${v.color}`}>
                        {p.foodCost !== null ? pct(p.foodCost) : ''} <span className="text-xs">{v.label}</span>
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums text-gold">{p.margeTotale !== null ? formatPrice(p.margeTotale) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-neutral-500">Repères traiteur : coût matière &lt; 30 % très bien · 30–35 % correct · &gt; 35 % trop cher.</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Simulation s={s} />
        <Charges />
      </div>
      <Historique lignes={historique} />
      <p className="text-xs text-neutral-500">
        Estimations HT sur les ventes confirmées, en préparation ou livrées (date de prestation). Le coût matière utilise vos recettes
        et prix d’achat actuels. Ce tableau ne remplace pas votre comptabilité.
      </p>
    </div>
  );
}
