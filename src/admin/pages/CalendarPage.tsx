import { useMemo, useState } from 'react';
import { useAdmin } from '../AdminApp';
import { isoDate } from '../stats';
import { statutInfo, type Commande } from '../types';
import { Card, Empty, fmtDate } from '../ui';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const moisFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

export default function CalendarPage() {
  const { commandes, clientById } = useAdmin();
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [annulees, setAnnulees] = useState(false);

  const parJour = useMemo(() => {
    const m = new Map<string, Commande[]>();
    for (const c of commandes) {
      if (!c.date_prestation || (!annulees && c.statut === 'annulee')) continue;
      m.set(c.date_prestation, [...(m.get(c.date_prestation) ?? []), c]);
    }
    for (const l of m.values()) l.sort((a, b) => a.heure.localeCompare(b.heure));
    return m;
  }, [commandes, annulees]);

  const jours = useMemo(() => {
    const debut = new Date(ref);
    debut.setDate(1 - ((ref.getDay() + 6) % 7)); // lundi de la 1re semaine
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(debut);
      d.setDate(debut.getDate() + i);
      return d;
    });
  }, [ref]);

  const today = isoDate(new Date());
  const moisIso = isoDate(ref).slice(0, 7);
  const duMois = [...parJour.entries()].filter(([d]) => d.startsWith(moisIso)).sort(([a], [b]) => a.localeCompare(b));
  const nom = (c: Commande) => {
    const cl = c.client_id ? clientById.get(c.client_id) : undefined;
    return cl?.entreprise || cl?.nom || 'Client';
  };
  const decal = (n: number) => setRef((r) => new Date(r.getFullYear(), r.getMonth() + n, 1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-2xl font-bold capitalize text-white">{moisFmt.format(ref)}</h1>
        <button type="button" className="btn-outline px-3" onClick={() => decal(-1)} aria-label="Mois précédent">
          ←
        </button>
        <button
          type="button"
          className="btn-outline px-3 text-xs"
          onClick={() => setRef(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
        >
          Aujourd’hui
        </button>
        <button type="button" className="btn-outline px-3" onClick={() => decal(1)} aria-label="Mois suivant">
          →
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={annulees} onChange={(e) => setAnnulees(e.target.checked)} className="accent-[#d4af37]" />
        Afficher les commandes annulées
      </label>

      {/* Grille (tablette / ordinateur) */}
      <div className="hidden overflow-hidden rounded-2xl border border-white/10 md:block">
        <div className="grid grid-cols-7 bg-ink-700 text-center text-xs font-semibold uppercase text-neutral-400">
          {JOURS.map((j) => (
            <div key={j} className="py-2">
              {j}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {jours.map((d) => {
            const iso = isoDate(d);
            const list = parJour.get(iso) ?? [];
            const autreMois = d.getMonth() !== ref.getMonth();
            return (
              <div key={iso} className={`min-h-[110px] border-r border-t border-white/5 p-1.5 ${autreMois ? 'bg-ink/60 opacity-50' : 'bg-ink-800'}`}>
                <p className={`mb-1 text-right text-xs ${iso === today ? 'font-bold text-gold' : 'text-neutral-400'}`}>
                  {iso === today ? <span className="rounded-full bg-gold px-1.5 text-ink">{d.getDate()}</span> : d.getDate()}
                </p>
                <ul className="space-y-1">
                  {list.map((c) => (
                    <li key={c.id}>
                      <a href={`#/commandes/${c.id}`} className={`block truncate rounded border px-1.5 py-0.5 text-[11px] ${statutInfo(c.statut).color}`} title={`${c.heure} ${nom(c)}`}>
                        {c.heure && <strong>{c.heure} </strong>}
                        {nom(c)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste (téléphone) */}
      <div className="space-y-3 md:hidden">
        {duMois.length === 0 ? (
          <Empty>Aucune prestation ce mois-ci.</Empty>
        ) : (
          duMois.map(([iso, list]) => (
            <Card key={iso} className={iso === today ? 'border-gold/60' : ''}>
              <p className="mb-2 font-semibold capitalize text-gold-light">{fmtDate(iso, true)}</p>
              <ul className="space-y-2">
                {list.map((c) => (
                  <li key={c.id}>
                    <a href={`#/commandes/${c.id}`} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${statutInfo(c.statut).color}`}>
                      <span className="truncate">
                        <strong>{c.heure || '--:--'}</strong> · {nom(c)}
                        {c.nb_personnes ? ` · ${c.nb_personnes} pers.` : ''}
                      </span>
                      <span className="shrink-0 text-xs">{statutInfo(c.statut).label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
