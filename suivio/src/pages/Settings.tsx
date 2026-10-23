import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { loadTemplates } from '../data';
import { must, supabase } from '../supabase';
import type { Invitation, Role, Template, Usage } from '../types';
import { Modal, ROLE_LABEL, useAction, useToast } from '../ui';

export default function Settings() {
  const { company, isAdmin, reloadCompany, members, me } = useApp();
  const { busy, run } = useAction();
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dis = !isAdmin;
  const formUrl = `${location.origin}/f/${company.form_token}`;
  const embed = `<iframe src="${formUrl}" style="width:100%;min-height:1100px;border:0" title="Demande de devis"></iframe>`;

  const reload = useCallback(async () => {
    setTemplates(await loadTemplates(company.id));
    if (isAdmin) setInvites(must(await supabase.from('invitations').select('*').eq('company_id', company.id)) as Invitation[]);
    const month = new Date(); month.setDate(1);
    const u = must(await supabase.from('usage_monthly').select('*').eq('company_id', company.id).eq('month', month.toISOString().slice(0, 10)).maybeSingle()) as Usage | null;
    setUsage(u);
  }, [company.id, isAdmin]);
  useEffect(() => { void reload(); }, [reload]);

  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast('Copié')).catch(() => toast('Sélectionnez le texte et copiez-le', true));

  async function exportData() {
    const data = must(await supabase.rpc('export_company', { c: company.id }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `suivio-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="head"><div><h1>Paramètres</h1><p className="sub">{isAdmin ? '' : 'Seul un administrateur peut modifier ces paramètres.'}</p></div></div>
      <div className="grid-2">
        <div className="col">
          <section className="panel">
            <h2>Formulaire client</h2>
            <p className="muted" style={{ fontSize: '.86rem' }}>Lien à mettre sur votre site, vos e-mails ou votre fiche Google. Les demandes arrivent directement dans « Demandes ».</p>
            <div className="copy"><input className="inp mono" readOnly value={formUrl} aria-label="Lien du formulaire" /><button className="btn sm" onClick={() => copy(formUrl)}>Copier</button></div>
            <div className="copy"><input className="inp mono" readOnly value={embed} aria-label="Code d'intégration" /><button className="btn sm" onClick={() => copy(embed)}>Copier le code</button></div>
          </section>
          <form className="panel" onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
            void run(async () => {
              must(await supabase.from('companies').update({
                name: f.name, phone: f.phone, email: (f.email ?? '').toLowerCase(), address: f.address, contact_hours: f.contact_hours, zone: f.zone,
                timezone: f.timezone, lang: f.lang, quote_validity_days: Number(f.quote_validity_days) || 30,
              }).eq('id', company.id));
              await reloadCompany();
            }, 'Paramètres enregistrés');
          }}>
            <h2>Entreprise</h2>
            <div className="fgrid">
              <div className="field full"><label htmlFor="s-name">Raison sociale</label><input id="s-name" name="name" required defaultValue={company.name} disabled={dis} /></div>
              <div className="field"><label htmlFor="s-phone">Téléphone</label><input id="s-phone" name="phone" defaultValue={company.phone} disabled={dis} /></div>
              <div className="field"><label htmlFor="s-email">E-mail de contact</label><input id="s-email" name="email" type="email" defaultValue={company.email} disabled={dis} /></div>
              <div className="field full"><label htmlFor="s-address">Adresse</label><input id="s-address" name="address" defaultValue={company.address} disabled={dis} /></div>
              <div className="field"><label htmlFor="s-lang">Langue</label><select id="s-lang" name="lang" defaultValue={company.lang} disabled={dis}><option value="fr">Français</option><option value="en">English (bientôt)</option></select></div>
              <div className="field"><label htmlFor="s-tz">Fuseau horaire</label><select id="s-tz" name="timezone" defaultValue={company.timezone} disabled={dis}>
                {['Europe/Paris', 'Europe/Brussels', 'Europe/Zurich', 'Europe/Luxembourg', 'America/Montreal', 'Africa/Casablanca'].map((z) => <option key={z}>{z}</option>)}</select></div>
              <div className="field full"><label htmlFor="s-hours">Horaires de contact</label><input id="s-hours" name="contact_hours" defaultValue={company.contact_hours} disabled={dis} /></div>
              <div className="field full"><label htmlFor="s-zone">Zone d'intervention (codes postaux ou préfixes)</label><textarea id="s-zone" name="zone" rows={2} defaultValue={company.zone} disabled={dis} />
                <span className="hint">Ex. « 93, 94, 75011 ». Les demandes hors zone sont signalées. Vide = pas de contrôle.</span></div>
              <div className="field"><label htmlFor="s-valid">Validité des devis (jours)</label><input id="s-valid" name="quote_validity_days" type="number" min={1} max={365} defaultValue={company.quote_validity_days} disabled={dis} /></div>
            </div>
            {isAdmin && <div><button className="btn primary sm" disabled={busy}>Enregistrer</button></div>}
          </form>
          <form className="panel" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              for (const t of templates) {
                must(await supabase.from('templates').update({ subject: String(f.get(`s-${t.key}`) ?? ''), body: String(f.get(`b-${t.key}`) ?? '') }).eq('company_id', company.id).eq('key', t.key));
              }
              await reload();
            }, 'Modèles enregistrés');
          }}>
            <h2>Modèles de messages</h2>
            <p className="faint" style={{ fontSize: '.8rem' }}>Variables : {'{client} {ref} {date_devis} {echeance} {responsable} {entreprise} {horaires} {ref_dossier}'}. Les relances déjà créées gardent leur texte.</p>
            {templates.map((t) => (
              <div className="field" key={t.key}><label htmlFor={`b-${t.key}`}>{t.name}</label>
                <input className="inp" name={`s-${t.key}`} defaultValue={t.subject} disabled={dis} aria-label={`Objet : ${t.name}`} />
                <textarea id={`b-${t.key}`} name={`b-${t.key}`} rows={6} defaultValue={t.body} disabled={dis} maxLength={5000} /></div>
            ))}
            {isAdmin && <div><button className="btn primary sm" disabled={busy}>Enregistrer</button></div>}
          </form>
        </div>
        <div className="col">
          <section className="panel">
            <h2>Membres et rôles</h2>
            <div className="tbl-wrap"><table><thead><tr><th>Membre</th><th>Rôle</th><th /></tr></thead><tbody>
              {members.map((m) => (
                <tr key={m.user_id}><td><b style={{ fontWeight: 600 }}>{m.display_name || '—'}</b>{m.user_id === me.user_id && <span className="faint"> (vous)</span>}</td>
                  <td><select value={m.role} disabled={dis} aria-label={`Rôle de ${m.display_name}`} onChange={(e) => run(async () => {
                    must(await supabase.from('memberships').update({ role: e.target.value }).eq('company_id', company.id).eq('user_id', m.user_id)); await reloadCompany();
                  }, 'Rôle modifié')}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                  <td>{isAdmin && m.user_id !== me.user_id && <button className="btn ghost sm danger" onClick={() => run(async () => {
                    must(await supabase.from('memberships').delete().eq('company_id', company.id).eq('user_id', m.user_id)); await reloadCompany();
                  }, 'Accès retiré')}>Retirer</button>}</td></tr>
              ))}
            </tbody></table></div>
            {isAdmin && (
              <form className="fgrid" onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
                void run(async () => {
                  must(await supabase.from('invitations').insert({ company_id: company.id, email: (f.email ?? '').trim().toLowerCase(), role: f.role, display_name: f.display_name ?? '' }));
                  form.reset();
                  await reload();
                }, 'Invitation créée : la personne se connecte avec cette adresse');
              }}>
                <div className="field"><label htmlFor="inv-email">Inviter (e-mail)</label><input id="inv-email" name="email" type="email" required /></div>
                <div className="field"><label htmlFor="inv-name">Nom</label><input id="inv-name" name="display_name" required /></div>
                <div className="field"><label htmlFor="inv-role">Rôle</label><select id="inv-role" name="role" defaultValue="gestion">{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
                <div className="field" style={{ justifyContent: 'flex-end' }}><button className="btn sm" disabled={busy}>Inviter</button></div>
              </form>
            )}
            {invites.length > 0 && <div className="faint" style={{ fontSize: '.82rem' }}>En attente : {invites.map((i) => (
              <span key={i.email}>{i.email} ({ROLE_LABEL[i.role]}) <button className="btn ghost sm" onClick={() => run(async () => {
                must(await supabase.from('invitations').delete().eq('company_id', company.id).eq('email', i.email)); await reload();
              }, 'Invitation annulée')}>Annuler</button></span>))}</div>}
            <div className="tbl-wrap"><table className="perm"><thead><tr><th>Droit</th><th>Admin</th><th>Gestion</th><th>Lecture</th></tr></thead><tbody>
              <tr><td>Consulter les dossiers</td><td>✓</td><td>✓</td><td>✓</td></tr>
              <tr><td>Répondre, devis, relances</td><td>✓</td><td>✓</td><td>—</td></tr>
              <tr><td>Paramètres, membres, export, effacement</td><td>✓</td><td>—</td><td>—</td></tr>
            </tbody></table></div>
          </section>
          <section className="panel">
            <h2>Volumes du mois</h2>
            <dl className="kv">
              <dt>Demandes reçues</dt><dd className="num">{usage?.requests ?? 0} / {company.limit_requests}</dd>
              <dt>Analyses IA</dt><dd className="num">{usage?.ai_calls ?? 0} / {company.limit_ai}</dd>
              <dt>E-mails envoyés</dt><dd className="num">{usage?.emails ?? 0} / {company.limit_emails}</dd>
            </dl>
            <span className="faint" style={{ fontSize: '.78rem' }}>Au-delà, l'analyse se fait par règles locales et les envois sont suspendus jusqu'au mois suivant.</span>
          </section>
          {isAdmin && (
            <section className="panel">
              <h2>Données</h2>
              <p className="muted" style={{ fontSize: '.86rem' }}>Export complet (dossiers, devis, relances, historique) au format JSON.</p>
              <div className="row"><button className="btn sm" onClick={() => run(exportData, 'Export téléchargé')}>Exporter les données</button>
                <button className="btn ghost sm danger" onClick={() => setDeleting(true)}>Supprimer l'entreprise</button></div>
            </section>
          )}
        </div>
      </div>
      {deleting && <DeleteCompany onClose={() => setDeleting(false)} />}
    </>
  );
}

function DeleteCompany({ onClose }: { onClose: () => void }) {
  const { company } = useApp();
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState('');
  return (
    <Modal title="Supprimer définitivement l'entreprise ?" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={busy || confirm !== company.name} onClick={() => run(async () => {
          must(await supabase.rpc('delete_company', { c: company.id, p_confirm: confirm }));
          localStorage.removeItem('suivio.company');
          location.assign('/');
        })}>Supprimer</button></>}>
      <p>Toutes les données (dossiers, devis, relances, historique, membres) seront supprimées. Exportez-les avant si besoin.</p>
      <div className="field"><label htmlFor="del-confirm">Saisissez « {company.name} » pour confirmer</label><input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
    </Modal>
  );
}
