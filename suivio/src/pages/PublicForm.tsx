import { useEffect, useState, type FormEvent } from 'react';
import { configured, supabase } from '../supabase';
import { EQUIPMENTS } from '../../supabase/functions/_shared/logic.ts';

interface Info { name: string; contact_hours: string }

/** Formulaire public de l'entreprise : /f/<jeton> (aucun compte requis) */
export default function PublicForm({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) { setInfo(null); return; }
    supabase.rpc('public_form_info', { p_token: token }).then(({ data }) => setInfo((data as Info | null) ?? null));
  }, [token]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if (!f.phone && !f.email) { setError('Indiquez un téléphone ou un e-mail pour être recontacté.'); return; }
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('submit_request', { p_token: token, p: f });
    setBusy(false);
    if (err) setError(err.message); else setDone(String(data));
  }

  if (info === undefined) return <p className="spinner">Chargement…</p>;
  if (info === null) return <div className="center"><div className="card"><h1>Formulaire introuvable</h1><p className="muted">Ce lien n'est pas ou plus valide.</p></div></div>;

  return (
    <main className="main"><div className="public">
      <div className="public-h"><span className="label" style={{ color: 'inherit', opacity: 0.7 }}>{info.name}</span>
        <h1>Demande d'intervention ou de devis</h1><p>Chauffage, climatisation, pompe à chaleur. Réponse pendant nos horaires : {info.contact_hours}.</p></div>
      {done ? (
        <div className="panel"><h2>Demande envoyée</h2>
          <p>Merci, votre demande{done !== 'ok' ? <> <b className="mono">{done}</b></> : null} a bien été reçue. Nous revenons vers vous pendant nos horaires d'ouverture.</p></div>
      ) : (
        <form className="panel" onSubmit={submit}>
          <h2>Vos coordonnées</h2>
          <div className="seg" role="radiogroup" aria-label="Vous êtes">
            <label><input type="radio" name="kind" value="particulier" defaultChecked /> Particulier</label>
            <label><input type="radio" name="kind" value="entreprise" /> Entreprise / syndic</label>
          </div>
          <div className="fgrid">
            <div className="field"><label htmlFor="pf-name">Nom et prénom *</label><input id="pf-name" name="name" required maxLength={120} autoComplete="name" /></div>
            <div className="field"><label htmlFor="pf-company">Entreprise (si applicable)</label><input id="pf-company" name="company_name" maxLength={120} autoComplete="organization" /></div>
            <div className="field"><label htmlFor="pf-phone">Téléphone</label><input id="pf-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" /></div>
            <div className="field"><label htmlFor="pf-email">E-mail</label><input id="pf-email" name="email" type="email" maxLength={160} autoComplete="email" /></div>
            <div className="field full"><label htmlFor="pf-address">Adresse de l'intervention</label><input id="pf-address" name="address" maxLength={200} autoComplete="street-address" /></div>
            <div className="field"><label htmlFor="pf-cp">Code postal *</label><input id="pf-cp" name="postcode" required maxLength={10} inputMode="numeric" autoComplete="postal-code" /></div>
            <div className="field"><label htmlFor="pf-city">Ville</label><input id="pf-city" name="city" maxLength={80} autoComplete="address-level2" /></div>
          </div>
          <h2>Votre besoin</h2>
          <div className="seg" role="radiogroup" aria-label="Type de besoin">
            {[['installation', 'Installation / remplacement'], ['entretien', 'Entretien'], ['depannage', 'Dépannage'], ['', 'Je ne sais pas']].map(([v, l], i) => (
              <label key={l}><input type="radio" name="need" value={v} defaultChecked={i === 0} /> {l}</label>
            ))}
          </div>
          <div className="fgrid">
            <div className="field"><label htmlFor="pf-equip">Équipement concerné</label>
              <select id="pf-equip" name="equipment" defaultValue=""><option value="">— Choisir —</option>{EQUIPMENTS.map((e) => <option key={e}>{e}</option>)}</select></div>
            <div className="field"><label htmlFor="pf-brand">Marque / modèle (si connu)</label><input id="pf-brand" name="brand" maxLength={80} /></div>
            <div className="field full"><label htmlFor="pf-desc">Décrivez votre demande *</label>
              <textarea id="pf-desc" name="description" required maxLength={4000} rows={4} placeholder="Ex. : surface à équiper, symptômes constatés, âge de l'installation…" /></div>
            <div className="field full"><label htmlFor="pf-avail">Vos disponibilités</label><input id="pf-avail" name="availability" maxLength={200} placeholder="Ex. : en semaine après 17h" /></div>
            {/* champ piège invisible pour les robots */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}><label htmlFor="pf-website">Site web</label><input id="pf-website" name="website" tabIndex={-1} autoComplete="off" /></div>
          </div>
          <p className="faint" style={{ fontSize: '.8rem' }}>En cas d'odeur de gaz ou de danger immédiat, n'utilisez pas ce formulaire : contactez les services d'urgence.</p>
          <label className="check"><input type="checkbox" required /> J'accepte que mes informations soient utilisées par {info.name} pour traiter ma demande. *</label>
          {error && <p className="err">{error}</p>}
          <div><button className="btn primary" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer ma demande'}</button></div>
        </form>
      )}
    </div></main>
  );
}
