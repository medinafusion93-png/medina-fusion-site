import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { loadOverview, loadTemplates } from '../data';
import { must, supabase } from '../supabase';
import type { Template } from '../types';
import { fDate, SeqPill, STEP_LABEL, useAction } from '../ui';

type Data = Awaited<ReturnType<typeof loadOverview>>;

export default function Followups() {
  const { company, go, canEdit, isAdmin, reloadCompany } = useApp();
  const [data, setData] = useState<Data | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const { busy, run } = useAction();
  const reload = useCallback(() => loadOverview(company.id).then(setData), [company.id]);
  useEffect(() => { void reload(); loadTemplates(company.id).then(setTemplates).catch(() => {}); }, [reload, company.id]);
  if (!data) return <p className="spinner">Chargement…</p>;

  const byId = new Map(data.dossiers.map((d) => [d.id, d]));
  const qById = new Map(data.quotes.map((q) => [q.id, q]));
  const active = new Set(data.sequences.filter((s) => s.state === 'active').map((s) => s.id));
  const toValidate = data.steps.filter((p) => p.status === 'a_valider' && active.has(p.sequence_id));
  const failed = data.steps.filter((p) => p.status === 'echec');
  const order = { active: 0, suspendue: 1, terminee: 2, arretee: 3 };
  const seqs = [...data.sequences].sort((a, b) => order[a.state] - order[b.state]);
  const name = (id: string) => { const d = byId.get(id); return d ? (d.kind === 'entreprise' && d.company_name ? d.company_name : d.name) : '—'; };

  const setStep = (id: string, status: string, msg: string) => run(async () => { must(await supabase.from('sequence_steps').update({ status }).eq('id', id)); await reload(); }, msg);
  const setState = (id: string, state: string, msg: string) => run(async () => { must(await supabase.rpc('set_sequence_state', { p_seq: id, p_state: state })); await reload(); }, msg);

  return (
    <>
      <div className="head"><div><h1>Relances</h1><p className="sub">Aucune relance n'est envoyée sans validation. Une séquence s'arrête dès que le client répond ou que le devis change de statut.</p></div></div>
      <div className="grid-2">
        <div className="col">
          {failed.length > 0 && (
            <div className="alert crit"><b>{failed.length} relance{failed.length > 1 ? 's' : ''} non envoyée{failed.length > 1 ? 's' : ''} après 3 tentatives.</b>
              <span>{failed[0]?.last_error}</span></div>
          )}
          <section className="panel">
            <div className="panel-h"><h2>Relances à valider</h2><span className="faint">{toValidate.length}</span></div>
            {toValidate.length ? toValidate.map((p) => {
              const s = data.sequences.find((x) => x.id === p.sequence_id)!;
              return (
                <div className="seq" key={p.id}>
                  <div className="panel-h"><span><b>Relance {p.position}</b> · {name(s.dossier_id)} · <span className="mono faint">{qById.get(s.quote_id)?.ref}</span></span><span className="faint">Prévue le {fDate(p.due_at)}</span></div>
                  <div className="preview">{p.body}</div>
                  <div className="row">
                    <button className="btn primary sm" disabled={!canEdit || busy} onClick={() => setStep(p.id, 'programmee', 'Relance validée et programmée')}>Valider</button>
                    <button className="btn sm" disabled={!canEdit || busy} onClick={() => setStep(p.id, 'annulee', 'Relance retirée')}>Ne pas envoyer</button>
                    <button className="btn ghost sm" onClick={() => go('dossier', s.dossier_id)}>Ouvrir le dossier</button>
                  </div>
                </div>
              );
            }) : <p className="muted">Aucune relance en attente de validation.</p>}
          </section>
          <section className="panel">
            <h2>Séquences</h2>
            {seqs.length ? seqs.map((s) => (
              <div className="seq" key={s.id}>
                <div className="panel-h"><span><b>{name(s.dossier_id)}</b> · <span className="mono faint">{qById.get(s.quote_id)?.ref}</span> <SeqPill s={s.state} /></span>
                  <span className="row">
                    {s.state === 'active' && <button className="btn sm" disabled={!canEdit} onClick={() => setState(s.id, 'suspendue', 'Séquence suspendue')}>Suspendre</button>}
                    {s.state === 'suspendue' && <button className="btn sm" disabled={!canEdit} onClick={() => setState(s.id, 'active', 'Séquence reprise')}>Reprendre</button>}
                    {['active', 'suspendue'].includes(s.state) && <button className="btn sm danger" disabled={!canEdit} onClick={() => setState(s.id, 'arretee', 'Séquence arrêtée')}>Arrêter</button>}
                  </span></div>
                {s.stop_reason && <span className="faint" style={{ fontSize: '.8rem' }}>{s.stop_reason}</span>}
                <div className="seq-steps">{data.steps.filter((p) => p.sequence_id === s.id).map((p) => (
                  <div key={p.id} className={`sstep ${p.status}`}><b>Relance {p.position} · J+{p.day_offset}</b><span className="faint">{fDate(p.due_at)}</span><span>{STEP_LABEL[p.status]}</span></div>))}</div>
              </div>
            )) : <p className="muted">Aucune séquence pour l'instant.</p>}
          </section>
        </div>
        <div className="col">
          <form className="panel" onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
            const delays = [f.d0, f.d1, f.d2].map(Number);
            void run(async () => {
              if (!(delays[0]! > 0 && delays[0]! < delays[1]! && delays[1]! < delays[2]!)) throw new Error('Les délais doivent être croissants (ex. 3, 7, 14)');
              must(await supabase.from('companies').update({
                seq_delays: delays, seq_templates: [f.t0, f.t1, f.t2], send_start_hour: Number(f.start), send_end_hour: Number(f.end), send_saturday: f.saturday === 'on',
              }).eq('id', company.id));
              await reloadCompany();
            }, 'Séquence par défaut enregistrée');
          }}>
            <h2>Séquence par défaut</h2>
            {[0, 1, 2].map((i) => (
              <div className="fgrid" style={{ gridTemplateColumns: '90px minmax(0,1fr)' }} key={i}>
                <div className="field"><label htmlFor={`dl${i}`}>Délai {i + 1}</label><input id={`dl${i}`} name={`d${i}`} type="number" min={1} max={90} defaultValue={company.seq_delays[i] ?? 0} disabled={!isAdmin} /></div>
                <div className="field"><label htmlFor={`tp${i}`}>Modèle</label><select id={`tp${i}`} name={`t${i}`} defaultValue={company.seq_templates[i]} disabled={!isAdmin}>
                  {templates.filter((t) => t.key.startsWith('relance')).map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select></div>
              </div>
            ))}
            <span className="faint" style={{ fontSize: '.78rem' }}>Délais en jours après l'envoi du devis.</span>
            <div className="fgrid">
              <div className="field"><label htmlFor="sw-start">Envoi à partir de</label><input id="sw-start" name="start" type="number" min={0} max={23} defaultValue={company.send_start_hour} disabled={!isAdmin} /></div>
              <div className="field"><label htmlFor="sw-end">Jusqu'à (heure)</label><input id="sw-end" name="end" type="number" min={1} max={24} defaultValue={company.send_end_hour} disabled={!isAdmin} /></div>
            </div>
            <label className="check"><input type="checkbox" name="saturday" defaultChecked={company.send_saturday} disabled={!isAdmin} /> Envoyer aussi le samedi</label>
            <label className="check"><input type="checkbox" checked disabled readOnly /> Arrêt dès que le client répond, ou que le devis est accepté, refusé ou expiré</label>
            <label className="check"><input type="checkbox" checked disabled readOnly /> Une seule séquence par devis</label>
            {isAdmin && <div><button className="btn sm" disabled={busy}>Enregistrer</button></div>}
          </form>
        </div>
      </div>
    </>
  );
}
