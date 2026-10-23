import { useEffect, useState } from 'react';
import { useApp } from './app-context';
import { loadTemplates } from './data';
import { must, supabase } from './supabase';
import type { Dossier, Quote, QuoteStatus, Template } from './types';
import { addDays, fDate, Modal, Q_LABEL, today, useAction } from './ui';

/** Associer ou modifier un devis (le devis lui-même reste établi dans le logiciel habituel) */
export function QuoteModal({ quote, dossiers, dossierId, onClose, onSaved }: {
  quote?: Quote; dossiers?: Dossier[]; dossierId?: string; onClose: () => void; onSaved: () => void;
}) {
  const { company } = useApp();
  const { busy, run } = useAction();
  const sent = quote?.sent_on ?? today();
  async function save(f: Record<string, string>) {
    const row = {
      ref: (f.ref ?? '').trim(), amount_ht: f.amount ? Number(f.amount) : null, sent_on: f.sent_on || null, due_on: f.due_on || null,
      status: f.status as QuoteStatus,
    };
    if (!row.ref) throw new Error('Indiquez la référence du devis');
    if (quote) must(await supabase.from('quotes').update(row).eq('id', quote.id));
    else must(await supabase.from('quotes').insert({ ...row, company_id: company.id, dossier_id: dossierId || f.dossier_id }));
    onSaved();
    onClose();
  }
  return (
    <Modal title={quote ? `Modifier le devis ${quote.ref}` : 'Associer un devis'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" form="qform" disabled={busy}>Enregistrer</button></>}>
      <form id="qform" className="fgrid" onSubmit={(e) => { e.preventDefault(); void run(() => save(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>), 'Devis enregistré'); }}>
        {!quote && !dossierId && (
          <div className="field full"><label htmlFor="q-d">Dossier</label>
            <select id="q-d" name="dossier_id" required>{(dossiers ?? []).filter((d) => !['perdu', 'clos'].includes(d.status)).map((d) => (
              <option key={d.id} value={d.id}>{d.ref} — {d.kind === 'entreprise' && d.company_name ? d.company_name : d.name}</option>))}</select></div>
        )}
        <div className="field"><label htmlFor="q-ref">Référence (de votre logiciel)</label><input id="q-ref" name="ref" required maxLength={60} defaultValue={quote?.ref ?? ''} /></div>
        <div className="field"><label htmlFor="q-amount">Montant HT (€)</label><input id="q-amount" name="amount" type="number" min="0" step="0.01" defaultValue={quote?.amount_ht ?? ''} /></div>
        <div className="field"><label htmlFor="q-sent">Date d'envoi</label><input id="q-sent" name="sent_on" type="date" defaultValue={sent} /></div>
        <div className="field"><label htmlFor="q-due">Échéance</label><input id="q-due" name="due_on" type="date" defaultValue={quote?.due_on ?? addDays(sent, company.quote_validity_days)} /></div>
        <div className="field full"><label htmlFor="q-status">Statut</label>
          <select id="q-status" name="status" defaultValue={quote?.status ?? 'envoye'}>{(Object.keys(Q_LABEL) as QuoteStatus[]).map((s) => <option key={s} value={s}>{Q_LABEL[s]}</option>)}</select>
          <span className="hint">Accepté, refusé ou expiré arrête automatiquement les relances.</span></div>
      </form>
    </Modal>
  );
}

function render(body: string, q: Quote, d: Dossier, companyName: string, contactHours: string, owner: string) {
  return body.replaceAll('{client}', d.name).replaceAll('{ref}', q.ref).replaceAll('{date_devis}', q.sent_on ? fDate(q.sent_on) : '')
    .replaceAll('{echeance}', q.due_on ? fDate(q.due_on) : '').replaceAll('{responsable}', owner).replaceAll('{entreprise}', companyName)
    .replaceAll('{horaires}', contactHours).replaceAll('{ref_dossier}', d.ref);
}

/** Aperçu puis création de la séquence de relances d'un devis */
export function ScheduleModal({ quote, dossier, onClose, onSaved }: { quote: Quote; dossier: Dossier; onClose: () => void; onSaved: () => void }) {
  const { company, memberName } = useApp();
  const { busy, run } = useAction();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  useEffect(() => { loadTemplates(company.id).then(setTemplates).catch(() => setTemplates([])); }, [company.id]);
  const owner = dossier.owner_id ? memberName(dossier.owner_id) : company.name;
  async function create(validate: boolean) {
    must(await supabase.rpc('create_sequence', { p_quote: quote.id, p_validate: validate }));
    onSaved();
    onClose();
  }
  return (
    <Modal title={`Programmer les relances — ${quote.ref}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn" disabled={busy || !dossier.email} onClick={() => run(() => create(false), 'Séquence créée : relances à valider')}>Créer, valider plus tard</button>
        <button className="btn primary" disabled={busy || !dossier.email} onClick={() => run(() => create(true), 'Relances validées et programmées')}>Valider les {company.seq_delays.length} relances</button></>}>
      <p className="muted">{dossier.name} · devis envoyé le {fDate(quote.sent_on)} · échéance {fDate(quote.due_on)}</p>
      {!dossier.email && <div className="alert warn"><b>Pas d'adresse e-mail pour ce client.</b><span>Ajoutez-la dans la fiche pour programmer des relances.</span></div>}
      {templates === null ? <p className="spinner">Chargement…</p> : company.seq_delays.map((day, i) => {
        const t = templates.find((x) => x.key === company.seq_templates[i]);
        return (
          <div className="seq" key={i}><div className="panel-h"><b>Relance {i + 1} · J+{day}</b><span className="faint">{t?.name ?? 'Modèle manquant'}</span></div>
            <div className="preview">{t ? render(t.body, quote, dossier, company.name, company.contact_hours, owner) : '—'}</div></div>
        );
      })}
      <div className="alert ok"><span>Envoi uniquement pendant la fenêtre {company.send_start_hour}h–{company.send_end_hour}h. La séquence s'arrête si le client répond ou si le devis change de statut.</span></div>
    </Modal>
  );
}
