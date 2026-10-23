import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { must, supabase } from '../supabase';
import type { Dossier, DossierStatus } from '../types';
import { D_LABEL, DPill, Icon, Modal, NeedChip, useAction } from '../ui';
import { EQUIPMENTS, inZone, NEED_LABEL } from '../../supabase/functions/_shared/logic.ts';

const STATUSES = Object.keys(D_LABEL) as DossierStatus[];

export default function Requests() {
  const { company, filter, go, canEdit, memberName } = useApp();
  const [rows, setRows] = useState<Dossier[] | null>(null);
  const [status, setStatus] = useState<string>(filter && STATUSES.includes(filter as DossierStatus) ? filter : 'all');
  const [need, setNeed] = useState('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('dossiers').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(2000)
      .then((r) => { try { setRows(must(r) as Dossier[]); } catch (e) { setError((e as Error).message); } });
  }, [company.id]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((d) => (status === 'all' || d.status === status) && (need === 'all' || (d.need || 'inconnu') === need)
      && (!s || [d.ref, d.name, d.company_name, d.city, d.postcode, d.equipment].join(' ').toLowerCase().includes(s)));
  }, [rows, status, need, q]);

  if (error) return <p className="err">{error}</p>;
  if (!rows) return <p className="spinner">Chargement…</p>;
  const cnt = (s: string) => rows.filter((d) => d.status === s).length;
  return (
    <>
      <div className="head"><div><h1>Demandes</h1><p className="sub">{rows.length} dossiers</p></div>
        {canEdit && <button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={16} /> Saisir une demande</button>}</div>
      <div className="filters">
        <button className="fchip" aria-pressed={status === 'all'} onClick={() => setStatus('all')}>Toutes<span className="c">{rows.length}</span></button>
        {STATUSES.map((s) => <button key={s} className="fchip" aria-pressed={status === s} onClick={() => setStatus(s)}>{D_LABEL[s]}<span className="c">{cnt(s)}</span></button>)}
      </div>
      <div className="filters">
        <input className="inp search" type="search" placeholder="Rechercher un client, une ville, une référence…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <select className="inp" style={{ width: 'auto' }} value={need} onChange={(e) => setNeed(e.target.value)} aria-label="Type de besoin">
          <option value="all">Tous les besoins</option>
          {Object.entries(NEED_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="inconnu">À qualifier</option>
        </select>
      </div>
      <section className="panel" style={{ padding: '8px 4px' }}>
        <div className="list-head label"><span>Réf.</span><span>Client</span><span>Zone</span><span>Statut</span><span>Signalements · prochaine action</span><span /></div>
        <div className="list">
          {list.length ? list.map((d) => {
            const miss = d.ai?.missing.length ?? 0;
            return (
              <button key={d.id} className="item" onClick={() => go('dossier', d.id)}>
                <span className="c-ref"><span className="mono faint">{d.ref}</span> <NeedChip n={d.need} /></span>
                <span className="who"><b>{d.kind === 'entreprise' && d.company_name ? d.company_name : d.name}</b>
                  <span className="small">{d.kind === 'entreprise' ? `Entreprise · ${d.name}` : 'Particulier'} · {d.equipment || 'équipement ?'}</span></span>
                <span className="c-loc small">{d.postcode} {d.city}{!inZone(d.postcode, company.zone) && <> <span className="flag warn">Hors zone</span></>}</span>
                <span className="c-st"><DPill s={d.status} /></span>
                <span className="c-na"><span className="row" style={{ gap: 4 }}>
                  {d.ai?.urgent && <span className="flag crit">Urgent ?</span>}
                  {d.ai?.injection && <span className="flag sim">Consigne ignorée</span>}
                  {miss > 0 && <span className="flag warn">{miss} info{miss > 1 ? 's' : ''} manquante{miss > 1 ? 's' : ''}</span>}
                  {!d.ai && <span className="flag sim">Résumé à préparer</span>}
                </span><span className="small" style={{ display: 'block' }}>{d.next_action || '—'} · {memberName(d.owner_id)}</span></span>
                <span className="chev"><Icon n="chev" s={16} /></span>
              </button>
            );
          }) : <p className="muted" style={{ padding: 14 }}>Aucune demande ne correspond.</p>}
        </div>
      </section>
      {adding && <NewDossier onClose={() => setAdding(false)} />}
    </>
  );
}

/** Saisie manuelle d'une demande reçue par téléphone ou e-mail */
function NewDossier({ onClose }: { onClose: () => void }) {
  const { company, me, go } = useApp();
  const { busy, run } = useAction();
  async function save(f: Record<string, string>) {
    const row = must(await supabase.from('dossiers').insert({
      company_id: company.id, ref: '', ref_num: 0, source: f.source || 'Téléphone', kind: f.kind === 'entreprise' ? 'entreprise' : 'particulier',
      name: f.name, company_name: f.company_name ?? '', phone: f.phone ?? '', email: (f.email ?? '').toLowerCase(), address: f.address ?? '',
      postcode: f.postcode ?? '', city: f.city ?? '', need: f.need ?? '', equipment: f.equipment ?? '', brand: f.brand ?? '',
      description: f.description ?? '', availability: f.availability ?? '', owner_id: me.user_id, next_action: 'Préparer le résumé et répondre',
      next_action_at: new Date().toISOString(),
    }).select('id').single()) as { id: string };
    must(await supabase.from('events').insert({ company_id: company.id, dossier_id: row.id, actor_id: me.user_id, type: 'create', text: `Demande saisie (${f.source || 'Téléphone'})`, body: f.description ?? '' }));
    go('dossier', row.id);
  }
  return (
    <Modal title="Saisir une demande" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" form="new-dossier" disabled={busy}>Créer le dossier</button></>}>
      <form id="new-dossier" className="fgrid" onSubmit={(e) => { e.preventDefault(); void run(() => save(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>)); }}>
        <div className="field"><label htmlFor="nd-source">Reçue par</label><select id="nd-source" name="source"><option>Téléphone</option><option>E-mail</option><option>Sur place</option><option>Autre</option></select></div>
        <div className="field"><label htmlFor="nd-kind">Type de client</label><select id="nd-kind" name="kind"><option value="particulier">Particulier</option><option value="entreprise">Entreprise</option></select></div>
        <div className="field"><label htmlFor="nd-name">Nom du contact *</label><input id="nd-name" name="name" required maxLength={120} /></div>
        <div className="field"><label htmlFor="nd-company">Entreprise</label><input id="nd-company" name="company_name" maxLength={120} /></div>
        <div className="field"><label htmlFor="nd-phone">Téléphone</label><input id="nd-phone" name="phone" /></div>
        <div className="field"><label htmlFor="nd-email">E-mail</label><input id="nd-email" name="email" type="email" /></div>
        <div className="field full"><label htmlFor="nd-address">Adresse</label><input id="nd-address" name="address" /></div>
        <div className="field"><label htmlFor="nd-cp">Code postal</label><input id="nd-cp" name="postcode" /></div>
        <div className="field"><label htmlFor="nd-city">Ville</label><input id="nd-city" name="city" /></div>
        <div className="field"><label htmlFor="nd-need">Besoin</label><select id="nd-need" name="need"><option value="">À qualifier</option>{Object.entries(NEED_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="nd-equip">Équipement</label><select id="nd-equip" name="equipment"><option value="">—</option>{EQUIPMENTS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="nd-brand">Marque / modèle</label><input id="nd-brand" name="brand" /></div>
        <div className="field"><label htmlFor="nd-avail">Disponibilités</label><input id="nd-avail" name="availability" /></div>
        <div className="field full"><label htmlFor="nd-desc">Description</label><textarea id="nd-desc" name="description" rows={4} maxLength={4000} /></div>
      </form>
    </Modal>
  );
}
