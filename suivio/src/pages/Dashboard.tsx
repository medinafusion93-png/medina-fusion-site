import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { loadOverview } from '../data';
import { metrics, todos } from '../stats';
import { DPill, dur, eur, Icon } from '../ui';

type Data = Awaited<ReturnType<typeof loadOverview>>;

export default function Dashboard() {
  const { company, go } = useApp();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { loadOverview(company.id).then(setData).catch((e: Error) => setError(e.message)); }, [company.id]);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="spinner">Chargement…</p>;
  const m = metrics(data.dossiers, data.quotes, data.sequences, data.steps);
  const td = todos(data.dossiers, data.quotes, data.sequences, data.steps, company.zone);
  const formUrl = `${location.origin}/f/${company.form_token}`;

  const kpi = (v: string | number, t: string, n: string, onClick: () => void) => (
    <button className="kpi" onClick={onClick}><span className="v">{v}</span><span className="t">{t}</span><span className="n">{n}</span></button>
  );
  return (
    <>
      <div className="head">
        <div><h1>Tableau de bord</h1><p className="sub">{company.name}</p></div>
        <div className="row"><button className="btn" onClick={() => go('requests')}>Toutes les demandes</button>
          <a className="btn primary" href={formUrl} target="_blank" rel="noreferrer"><Icon n="plus" s={16} /> Formulaire client</a></div>
      </div>
      <section className="kpis" aria-label="Indicateurs">
        {kpi(m.nouv, 'Nouvelles demandes', 'Sans première réponse', () => go('requests', undefined, 'nouvelle'))}
        {kpi(m.info, "En attente d'informations", 'Le client doit compléter', () => go('requests', undefined, 'attente_infos'))}
        {kpi(m.pending, 'Devis en attente de réponse', 'Envoyés ou en attente', () => go('quotes', undefined, 'open'))}
        {kpi(m.validate, 'Relances à valider', 'Rien ne part sans validation', () => go('followups'))}
        {kpi(m.accepted, 'Devis acceptés', `${eur(m.acceptedAmount)} HT signés. Indicatif, pas du chiffre d'affaires encaissé.`, () => go('quotes', undefined, 'accepte'))}
        {kpi(m.firstResp == null ? '—' : dur(m.firstResp), 'Délai de première réponse', `Médiane sur ${m.firstRespN} dossiers (60 j)`, () => go('requests'))}
      </section>
      <section className="panel">
        <div className="panel-h"><h2>À traiter maintenant</h2><span className="faint">{td.length} élément{td.length > 1 ? 's' : ''}</span></div>
        <div>
          {td.length ? td.slice(0, 15).map((x, i) => (
            <div className="todo" key={i}><span className={`bar ${x.sev}`} />
              <div className="body"><div className="row"><span className="mono faint">{x.dossier.ref}</span>
                <b>{x.dossier.kind === 'entreprise' && x.dossier.company_name ? x.dossier.company_name : x.dossier.name}</b><DPill s={x.dossier.status} /></div>
                <span className="muted" style={{ fontSize: '.86rem' }}>{x.why}</span></div>
              <button className="btn sm" onClick={() => (x.page ? go(x.page) : go('dossier', x.dossier.id))}>{x.page ? 'Voir' : 'Ouvrir'}</button>
            </div>
          )) : (
            <p className="muted">{data.dossiers.length ? 'Rien en attente.' : <>Aucune demande pour l'instant. Partagez le formulaire client : <span className="mono">{formUrl}</span></>}</p>
          )}
        </div>
      </section>
    </>
  );
}
