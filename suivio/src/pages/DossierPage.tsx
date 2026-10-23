import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { loadDossier, logEvent } from '../data';
import { callFunction, must, supabase } from '../supabase';
import type { Dossier, DossierStatus } from '../types';
import { QuoteModal, ScheduleModal } from '../quote-ui';
import { D_LABEL, daysLeft, DPill, eur, fDate, fDT, Modal, NeedChip, Q_OPEN, QPill, SeqPill, STEP_LABEL, useAction, useToast } from '../ui';
import { EQUIPMENTS, guardCheck, inZone, NEED_LABEL, TO_COMPLETE, type Analysis } from '../../supabase/functions/_shared/logic.ts';

type Data = Awaited<ReturnType<typeof loadDossier>>;
type ModalKind = null | 'edit' | 'reply' | 'quote' | 'schedule' | 'clientreply' | 'delete' | { quoteId: string };

export default function DossierPage({ id }: { id: string }) {
  const { company, me, canEdit, isAdmin, go, memberName } = useApp();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalKind>(null);
  const { busy, run } = useAction();
  const toast = useToast();

  const reload = useCallback(() => loadDossier(id).then(setData).catch((e: Error) => setError(e.message)), [id]);
  useEffect(() => { void reload(); }, [reload]);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="spinner">Chargement…</p>;
  const d = data.dossier;
  if (!d) return <p className="muted">Dossier introuvable.</p>;
  const ai = d.ai;
  const q = data.quotes[0];
  const openSeq = q ? data.sequences.find((s) => s.quote_id === q.id && ['active', 'suspendue'].includes(s.state)) : undefined;
  const title = d.kind === 'entreprise' && d.company_name ? d.company_name : d.name;
  const dis = !canEdit;

  const update = (patch: Partial<Dossier>, msg: string, log?: string) => run(async () => {
    must(await supabase.from('dossiers').update(patch).eq('id', d.id));
    if (log) await logEvent(company.id, d.id, me.user_id, 'sys', log);
    await reload();
  }, msg);

  const analyze = () => run(async () => {
    const r = await callFunction<{ analysis: Analysis; notice: string }>('assistant', { dossier_id: d.id });
    if (r.notice) toast(r.notice);
    await reload();
  });

  return (
    <>
      <div><button className="btn ghost sm" onClick={() => go('requests')}>← Retour</button></div>
      <div className="head">
        <div>
          <div className="row"><span className="mono faint">{d.ref}</span><DPill s={d.status} /><NeedChip n={d.need} />
            {ai?.urgent && <span className="flag crit">Potentiellement urgent</span>}
            {!inZone(d.postcode, company.zone) && <span className="flag warn">Hors zone</span>}</div>
          <h1 style={{ marginTop: 6 }}>{title}</h1>
          <p className="sub">Reçue {fDT(d.created_at)} · {d.source} · Responsable : {memberName(d.owner_id)}</p>
        </div>
        <div className="row">
          <button className="btn" disabled={dis} onClick={() => setModal('edit')}>Modifier</button>
          <button className="btn primary" disabled={dis || !ai} title={ai ? undefined : "Préparez d'abord le résumé"} onClick={() => setModal('reply')}>Préparer une réponse</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="col">
          <section className="ai">
            <div className="ai-h"><h2>Résumé préparé par l'assistant</h2>
              <span className="row">{ai && <span className={`ai-src ${ai.source}`}>{ai.source === 'ia' ? 'IA · à vérifier' : 'Règles locales'}</span>}
                <button className="btn sm" disabled={dis || busy} onClick={analyze}>{busy ? 'Analyse…' : ai ? 'Actualiser' : 'Préparer le résumé'}</button></span></div>
            <div className="ai-b">
              {!ai ? <p className="muted">Pas encore de résumé. « Préparer le résumé » analyse la demande et propose un brouillon de réponse. Rien n'est envoyé.</p> : (
                <>
                  {ai.notice && <div className="alert sim"><span>{ai.notice}</span></div>}
                  {ai.urgent && (
                    <div className="alert crit"><b>Situation potentiellement urgente : un humain doit examiner ce dossier.</b>
                      <span>{ai.urgent_reason} Aucun diagnostic automatique et aucune intervention promise.</span>
                      {d.urgent_ack ? <span>Pris en charge.</span> : <span><button className="btn sm" disabled={dis} onClick={() => update({ urgent_ack: true }, 'Prise en charge enregistrée', `Situation signalée prise en charge par ${me.display_name}`)}>Je prends en charge</button></span>}
                    </div>
                  )}
                  {ai.injection && <div className="alert sim"><b>Le message contient des consignes adressées à l'assistant.</b><span>Elles sont traitées comme du texte client et ne sont pas appliquées.</span></div>}
                  <p>{ai.summary}</p>
                  <dl className="kv">{ai.extracted.map((x, i) => <div key={i} style={{ display: 'contents' }}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}</dl>
                  <div><div className="label" style={{ marginBottom: 6 }}>Informations manquantes</div>
                    {ai.missing.length ? <div className="miss">{ai.missing.map((m) => <span key={m}>{m}</span>)}</div> : <span className="muted">Aucune information essentielle ne manque.</span>}</div>
                  {ai.suggested_need && !d.category_confirmed && (
                    <div className="row"><span className="muted">Catégorie proposée : <b>{NEED_LABEL[ai.suggested_need]}</b></span>
                      <button className="btn sm" disabled={dis} onClick={() => update({ need: ai.suggested_need, category_confirmed: true }, 'Catégorie confirmée', `Catégorie confirmée : ${NEED_LABEL[ai.suggested_need as keyof typeof NEED_LABEL]}`)}>Confirmer</button></div>
                  )}
                  <span className="faint" style={{ fontSize: '.75rem' }}>Préparé {fDT(d.ai_at)}</span>
                </>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-h"><h2>Historique des échanges et actions</h2>
              <button className="btn sm" disabled={dis} onClick={() => setModal('clientreply')}>Enregistrer une réponse du client</button></div>
            <ul className="tl">{data.events.map((e) => (
              <li key={e.id} className={e.type === 'in' ? 'in' : e.type === 'out' ? 'out' : e.type === 'ai' || e.type === 'sys' ? 'sys' : e.type === 'follow' ? 'warn' : ''}>
                <div><div><b style={{ fontWeight: 600 }}>{e.text}</b></div>
                  <div className="meta">{fDT(e.at)}{e.actor_id ? ` · ${memberName(e.actor_id)}` : ''}</div>
                  {e.body && <div className="msg">{e.body}</div>}</div>
              </li>))}</ul>
          </section>
        </div>

        <div className="col">
          <NextAction d={d} disabled={dis} onSaved={reload} />
          <section className="panel">
            <div className="panel-h"><h2>Devis associé</h2>{q && <QPill s={q.status} />}</div>
            {q ? (
              <>
                <dl className="kv"><dt>Référence</dt><dd className="mono">{q.ref}</dd><dt>Montant HT</dt><dd className="num">{eur(q.amount_ht)}</dd>
                  <dt>Envoyé le</dt><dd>{fDate(q.sent_on)}</dd><dt>Échéance</dt><dd>{fDate(q.due_on)}{q.due_on && Q_OPEN.includes(q.status) ? <span className="faint"> ({daysLeft(q.due_on)} j)</span> : null}</dd></dl>
                <div className="row">
                  <button className="btn sm" disabled={dis} onClick={() => setModal({ quoteId: q.id })}>Modifier le devis</button>
                  {Q_OPEN.includes(q.status) && (openSeq ? <button className="btn sm" onClick={() => go('followups')}>Voir les relances</button>
                    : <button className="btn primary sm" disabled={dis} onClick={() => setModal('schedule')}>Programmer les relances</button>)}
                  <button className="btn ghost sm" disabled={dis} onClick={() => setModal('quote')}>Autre devis</button>
                </div>
              </>
            ) : (
              <><p className="muted">Aucun devis associé. Saisissez la référence et le montant du devis établi dans votre logiciel habituel.</p>
                <div><button className="btn primary sm" disabled={dis} onClick={() => setModal('quote')}>Associer un devis</button></div></>
            )}
          </section>
          <section className="panel">
            <h2>Relances</h2>
            {data.sequences.length ? data.sequences.map((s) => {
              const qq = data.quotes.find((x) => x.id === s.quote_id);
              return (
                <div className="seq" key={s.id}><div className="panel-h"><span><span className="mono faint">{qq?.ref}</span> <SeqPill s={s.state} /></span></div>
                  {s.stop_reason && <span className="faint" style={{ fontSize: '.8rem' }}>{s.stop_reason}</span>}
                  <div className="seq-steps">{data.steps.filter((p) => p.sequence_id === s.id).map((p) => (
                    <div key={p.id} className={`sstep ${p.status}`}><b>Relance {p.position}</b><span className="faint">{fDate(p.due_at)}</span><span>{STEP_LABEL[p.status]}</span></div>))}</div>
                </div>
              );
            }) : <p className="muted">Aucune séquence. Les relances se programment une fois le devis envoyé.</p>}
          </section>
          <section className="panel">
            <h2>Client</h2>
            <dl className="kv"><dt>Type</dt><dd>{d.kind === 'entreprise' ? 'Entreprise' : 'Particulier'}</dd>{d.company_name && <><dt>Entreprise</dt><dd>{d.company_name}</dd></>}
              <dt>Contact</dt><dd>{d.name}</dd><dt>Téléphone</dt><dd>{d.phone || '—'}</dd><dt>E-mail</dt><dd>{d.email || '—'}</dd>
              <dt>Adresse</dt><dd>{[d.address, `${d.postcode} ${d.city}`.trim()].filter(Boolean).join(', ') || '—'}</dd>
              <dt>Équipement</dt><dd>{d.equipment || '—'}{d.brand ? ` · ${d.brand}` : ''}</dd><dt>Disponibilités</dt><dd>{d.availability || '—'}</dd>
              <dt>Description</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{d.description || '—'}</dd></dl>
          </section>
          <Notes d={d} notes={data.notes} disabled={dis} onSaved={reload} />
          {isAdmin && <div><button className="btn ghost sm danger" onClick={() => setModal('delete')}>Effacer ce dossier (demande du client)</button></div>}
        </div>
      </div>

      {modal === 'edit' && <EditDossier d={d} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'reply' && ai && <ReplyModal d={d} ai={ai} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'quote' && <QuoteModal dossierId={d.id} onClose={() => setModal(null)} onSaved={reload} />}
      {typeof modal === 'object' && modal && <QuoteModal quote={data.quotes.find((x) => x.id === modal.quoteId)} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'schedule' && q && <ScheduleModal quote={q} dossier={d} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'clientreply' && <ClientReply d={d} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === 'delete' && (
        <Modal title="Effacer définitivement ce dossier ?" onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => setModal(null)}>Annuler</button>
            <button className="btn primary" onClick={() => run(async () => { must(await supabase.rpc('delete_dossier', { p_dossier: d.id })); go('requests'); }, 'Dossier effacé')}>Effacer</button></>}>
          <p>Le dossier {d.ref}, ses devis, relances, notes et son historique seront supprimés. À utiliser quand le client demande l'effacement de ses données.</p>
        </Modal>
      )}
    </>
  );
}

function NextAction({ d, disabled, onSaved }: { d: Dossier; disabled: boolean; onSaved: () => Promise<void> }) {
  const { company, me, members } = useApp();
  const { run } = useAction();
  return (
    <section className="panel">
      <h2>Prochaine action</h2>
      <form className="col" style={{ gap: 8 }} onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
        void run(async () => {
          must(await supabase.from('dossiers').update({
            next_action: f.text ?? '', next_action_at: f.date ? new Date(`${f.date}T09:00:00`).toISOString() : null, owner_id: f.owner || null, status: f.status,
          }).eq('id', d.id));
          if (f.status !== d.status) await logEvent(company.id, d.id, me.user_id, 'status', `Statut du dossier changé en ${D_LABEL[f.status as DossierStatus]}`);
          if (f.owner !== d.owner_id) await logEvent(company.id, d.id, me.user_id, 'sys', `Dossier attribué à ${members.find((m) => m.user_id === f.owner)?.display_name ?? '—'}`);
          await onSaved();
        }, 'Enregistré');
      }}>
        <input className="inp" name="text" defaultValue={d.next_action} placeholder="Ex. : rappeler le client" disabled={disabled} aria-label="Prochaine action" />
        <div className="row">
          <input className="inp" type="date" name="date" style={{ width: 'auto' }} defaultValue={d.next_action_at?.slice(0, 10) ?? ''} disabled={disabled} aria-label="Date" />
          <select className="inp" name="owner" style={{ width: 'auto' }} defaultValue={d.owner_id ?? ''} disabled={disabled} aria-label="Responsable">
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name || m.user_id.slice(0, 8)}</option>)}</select>
        </div>
        <div className="row"><span className="faint" style={{ fontSize: '.8rem' }}>Statut</span>
          <select className="inp" name="status" style={{ width: 'auto' }} defaultValue={d.status} disabled={disabled} aria-label="Statut du dossier">
            {(Object.keys(D_LABEL) as DossierStatus[]).map((s) => <option key={s} value={s}>{D_LABEL[s]}</option>)}</select>
          <button className="btn sm" disabled={disabled}>Enregistrer</button></div>
      </form>
    </section>
  );
}

function Notes({ d, notes, disabled, onSaved }: { d: Dossier; notes: Data['notes']; disabled: boolean; onSaved: () => Promise<void> }) {
  const { company, me, memberName } = useApp();
  const { run } = useAction();
  const [text, setText] = useState('');
  return (
    <section className="panel">
      <h2>Notes internes</h2>
      <p className="faint" style={{ fontSize: '.78rem' }}>Visibles uniquement par l'équipe.</p>
      {notes.map((n) => <div key={n.id} style={{ fontSize: '.86rem' }}><div className="faint" style={{ fontSize: '.75rem' }}>{fDT(n.created_at)} · {memberName(n.author_id)}</div>{n.body}</div>)}
      <form className="row" onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        void run(async () => { must(await supabase.from('notes').insert({ company_id: company.id, dossier_id: d.id, author_id: me.user_id, body: text.trim() })); setText(''); await onSaved(); }, 'Note ajoutée');
      }}>
        <input className="inp" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une note…" disabled={disabled} maxLength={2000} aria-label="Nouvelle note" />
        <button className="btn sm" disabled={disabled}>Ajouter</button>
      </form>
    </section>
  );
}

function ReplyModal({ d, ai, onClose, onSaved }: { d: Dossier; ai: Analysis; onClose: () => void; onSaved: () => Promise<void> }) {
  const { company } = useApp();
  const { busy, run } = useAction();
  const [text, setText] = useState(ai.draft);
  const [confirmed, setConfirmed] = useState(false);
  const warnings = guardCheck(text, company.contact_hours);
  const blocked = text.includes(TO_COMPLETE);

  function send(mode: 'email' | 'manual') {
    if (warnings.length && !confirmed) { setConfirmed(true); return; }
    void run(async () => {
      await callFunction('send', { dossier_id: d.id, text, mode });
      await onSaved();
      onClose();
    }, mode === 'email' ? 'Réponse envoyée par e-mail' : 'Réponse enregistrée');
  }
  return (
    <Modal title="Préparer une réponse" onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(text).catch(() => {})}>Copier</button>
        <button className="btn" disabled={busy || blocked} onClick={() => send('manual')}>Répondu par téléphone / SMS</button>
        <button className="btn primary" disabled={busy || blocked || !d.email} onClick={() => send('email')}>{warnings.length && !confirmed ? 'Vérifier puis envoyer' : 'Envoyer par e-mail'}</button>
      </>}>
      <div className="alert sim"><span>Brouillon {ai.source === 'ia' ? "préparé par l'IA" : 'préparé par des règles'}. Relisez et modifiez avant d'envoyer. Aucun prix, créneau ni diagnostic ne doit y figurer sans votre accord.</span></div>
      <div className="field"><label htmlFor="reply-to">Destinataire</label><input id="reply-to" className="inp" value={d.email || 'Pas d’e-mail : répondez par téléphone'} disabled /></div>
      <div className="field"><label htmlFor="reply-text">Message</label><textarea id="reply-text" rows={13} value={text} onChange={(e) => { setText(e.target.value); setConfirmed(false); }} /></div>
      {blocked && <div className="alert crit"><b>Le brouillon contient une zone « À compléter ».</b><span>Remplacez ou supprimez le passage entre crochets.</span></div>}
      {warnings.length > 0 && confirmed && <div className="alert warn"><b>Ce message mentionne {warnings.join(', ')}.</b><span>Vérifiez que c'est validé par l'entreprise, puis cliquez à nouveau.</span></div>}
    </Modal>
  );
}

function ClientReply({ d, onClose, onSaved }: { d: Dossier; onClose: () => void; onSaved: () => Promise<void> }) {
  const { company, me } = useApp();
  const { busy, run } = useAction();
  const [text, setText] = useState('');
  return (
    <Modal title="Enregistrer une réponse du client" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={busy || !text.trim()} onClick={() => run(async () => {
          await logEvent(company.id, d.id, me.user_id, 'in', 'Réponse du client (saisie manuelle)', text.trim());
          await onSaved();
          onClose();
        }, 'Réponse enregistrée : relances arrêtées')}>Enregistrer</button></>}>
      <p className="muted">Pour une réponse reçue par téléphone, SMS ou sur place. Les réponses par e-mail sont rattachées automatiquement si la réception est configurée. Les relances en cours s'arrêtent.</p>
      <div className="field"><label htmlFor="cr-text">Ce que le client a répondu</label><textarea id="cr-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} /></div>
    </Modal>
  );
}

function EditDossier({ d, onClose, onSaved }: { d: Dossier; onClose: () => void; onSaved: () => Promise<void> }) {
  const { company, me } = useApp();
  const { busy, run } = useAction();
  return (
    <Modal title={`Modifier ${d.ref}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" form="dform" disabled={busy}>Enregistrer</button></>}>
      <form id="dform" className="fgrid" onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
        void run(async () => {
          must(await supabase.from('dossiers').update({ ...f, email: (f.email ?? '').toLowerCase(), category_confirmed: !!f.need || d.category_confirmed }).eq('id', d.id));
          await logEvent(company.id, d.id, me.user_id, 'sys', 'Informations du dossier modifiées');
          await onSaved();
          onClose();
        }, 'Dossier mis à jour');
      }}>
        <div className="field"><label htmlFor="e-kind">Type de client</label><select id="e-kind" name="kind" defaultValue={d.kind}><option value="particulier">Particulier</option><option value="entreprise">Entreprise</option></select></div>
        <div className="field"><label htmlFor="e-company">Entreprise</label><input id="e-company" name="company_name" defaultValue={d.company_name} /></div>
        <div className="field"><label htmlFor="e-name">Nom du contact</label><input id="e-name" name="name" required defaultValue={d.name} /></div>
        <div className="field"><label htmlFor="e-phone">Téléphone</label><input id="e-phone" name="phone" defaultValue={d.phone} /></div>
        <div className="field"><label htmlFor="e-email">E-mail</label><input id="e-email" name="email" type="email" defaultValue={d.email} /></div>
        <div className="field"><label htmlFor="e-address">Adresse</label><input id="e-address" name="address" defaultValue={d.address} /></div>
        <div className="field"><label htmlFor="e-cp">Code postal</label><input id="e-cp" name="postcode" defaultValue={d.postcode} /></div>
        <div className="field"><label htmlFor="e-city">Ville</label><input id="e-city" name="city" defaultValue={d.city} /></div>
        <div className="field"><label htmlFor="e-need">Besoin</label><select id="e-need" name="need" defaultValue={d.need}><option value="">À qualifier</option>{Object.entries(NEED_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="e-equip">Équipement</label><select id="e-equip" name="equipment" defaultValue={d.equipment}><option value="">—</option>{EQUIPMENTS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="e-brand">Marque / modèle</label><input id="e-brand" name="brand" defaultValue={d.brand} /></div>
        <div className="field"><label htmlFor="e-avail">Disponibilités</label><input id="e-avail" name="availability" defaultValue={d.availability} /></div>
        <div className="field full"><label htmlFor="e-desc">Description</label><textarea id="e-desc" name="description" rows={4} maxLength={4000} defaultValue={d.description} /></div>
      </form>
      <p className="faint" style={{ fontSize: '.78rem' }}>Après modification, « Actualiser » le résumé pour mettre à jour les informations manquantes.</p>
    </Modal>
  );
}

