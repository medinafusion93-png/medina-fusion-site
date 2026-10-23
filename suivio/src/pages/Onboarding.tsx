import { useState, type FormEvent } from 'react';
import { supabase } from '../supabase';

export default function Onboarding({ email, onDone }: { email: string; onDone: (companyId: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [display, setDisplay] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error: err } = await supabase.rpc('create_company', { p_name: name, p_display_name: display });
    setBusy(false);
    if (err) setError(err.message); else await onDone(data as string);
  }

  return (
    <div className="center">
      <form className="card" onSubmit={submit}>
        <h1>Créer votre espace</h1>
        <p className="muted">Connecté avec {email}. Si un collègue vous a invité, demandez-lui de vérifier l'adresse utilisée, puis reconnectez-vous.</p>
        <div className="field"><label htmlFor="ob-name">Nom de l'entreprise</label>
          <input id="ob-name" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="ob-display">Votre nom (signature des messages)</label>
          <input id="ob-display" required value={display} onChange={(e) => setDisplay(e.target.value)} placeholder="Ex. : Karim B." /></div>
        {error && <p className="err">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Création…' : "Créer l'espace"}</button>
        <button type="button" className="btn ghost" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </form>
    </div>
  );
}
