import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { loadOverview } from '../data';
import { must, supabase } from '../supabase';
import type { Quote, QuoteStatus } from '../types';
import { QuoteModal, ScheduleModal } from '../quote-ui';
import { daysLeft, eur, fDate, Q_LABEL, Q_OPEN, SeqPill, useAction } from '../ui';

type Data = Awaited<ReturnType<typeof loadOverview>>;

export default function Quotes() {
  const { company, filter, go, canEdit } = useApp();
  const [data, setData] = useState<Data | null>(null);
  const [f, setF] = useState(filter || 'all');
  const [edit, setEdit] = useState<Quote | 'new' | null>(null);
  const [schedule, setSchedule] = useState<Quote | null>(null);
  const { run } = useAction();
  const reload = useCallback(() => loadOverview(company.id).then(setData), [company.id]);
  useEffect(() => { void reload(); }, [reload]);
  if (!data) return <p className="spinner">Chargement…</p>;

  const byId = new Map(data.dossiers.map((d) => [d.id, d]));
  const list = data.quotes.filter((q) => f === 'all' || (f === 'open' ? Q_OPEN.includes(q.status) : q.status === f));
  const cnt = (s: QuoteStatus) => data.quotes.filter((q) => q.status === s).length;
  const setStatus = (q: Quote, s: string) => run(async () => { must(await supabase.from('quotes').update({ status: s }).eq('id', q.id)); await reload(); }, `Devis ${q.ref} : ${Q_LABEL[s as QuoteStatus]}`);

  return (
    <>
      <div className="head"><div><h1>Devis</h1><p className="sub">Suivi des devis établis dans votre logiciel habituel.</p></div>
        {canEdit && <button className="btn primary" onClick={() => setEdit('new')}>+ Associer un devis</button>}</div>
      <div className="filters">
        <button className="fchip" aria-pressed={f === 'all'} onClick={() => setF('all')}>Tous<span className="c">{data.quotes.length}</span></button>
        <button className="fchip" aria-pressed={f === 'open'} onClick={() => setF('open')}>En cours<span className="c">{data.quotes.filter((q) => Q_OPEN.includes(q.status)).length}</span></button>
        {(Object.keys(Q_LABEL) as QuoteStatus[]).map((s) => <button key={s} className="fchip" aria-pressed={f === s} onClick={() => setF(s)}>{Q_LABEL[s]}<span className="c">{cnt(s)}</span></button>)}
      </div>
      <section className="panel" style={{ padding: '6px 0' }}>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Réf.</th><th>Client</th><th className="r">Montant HT</th><th>Envoyé le</th><th>Échéance</th><th>Statut</th><th>Relances</th><th /></tr></thead>
          <tbody>{list.map((q) => {
            const d = byId.get(q.dossier_id);
            const seq = data.sequences.find((s) => s.quote_id === q.id);
            return (
              <tr key={q.id}>
                <td className="mono">{q.ref}</td>
                <td>{d ? <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => go('dossier', d.id)}>{d.kind === 'entreprise' && d.company_name ? d.company_name : d.name}</button> : '—'}
                  <div className="faint mono">{d?.ref}</div></td>
                <td className="r num">{eur(q.amount_ht)}</td>
                <td className="num">{fDate(q.sent_on)}</td>
                <td className="num">{fDate(q.due_on)}{q.due_on && Q_OPEN.includes(q.status) && <div className="faint" style={{ fontSize: '.75rem' }}>{daysLeft(q.due_on) < 0 ? 'dépassée' : `dans ${daysLeft(q.due_on)} j`}</div>}</td>
                <td><select value={q.status} disabled={!canEdit} onChange={(e) => setStatus(q, e.target.value)} aria-label={`Statut du devis ${q.ref}`}>
                  {(Object.keys(Q_LABEL) as QuoteStatus[]).map((s) => <option key={s} value={s}>{Q_LABEL[s]}</option>)}</select></td>
                <td>{seq ? <SeqPill s={seq.state} /> : Q_OPEN.includes(q.status) && d ? <button className="btn sm" disabled={!canEdit} onClick={() => setSchedule(q)}>Programmer</button> : <span className="faint">—</span>}</td>
                <td><button className="btn ghost sm" disabled={!canEdit} onClick={() => setEdit(q)}>Modifier</button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        {!list.length && <p className="muted" style={{ padding: 14 }}>Aucun devis.</p>}
      </section>
      <p className="faint" style={{ fontSize: '.8rem' }}>Un devis accepté n'est ni une facture ni un encaissement.</p>
      {edit && <QuoteModal quote={edit === 'new' ? undefined : edit} dossiers={data.dossiers} onClose={() => setEdit(null)} onSaved={reload} />}
      {schedule && byId.get(schedule.dossier_id) && <ScheduleModal quote={schedule} dossier={byId.get(schedule.dossier_id)!} onClose={() => setSchedule(null)} onSaved={reload} />}
    </>
  );
}
