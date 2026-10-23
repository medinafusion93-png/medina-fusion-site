import { useState, type FormEvent } from 'react';
import { supabase } from '../supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin } });
    setBusy(false);
    if (err) setError(err.message); else setSent(true);
  }

  return (
    <div className="center">
      <form className="card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0 }}><div><b>Suivio</b><small>Demandes, devis et relances</small></div></div>
        {sent ? (
          <>
            <h1>Vérifiez vos e-mails</h1>
            <p className="muted">Un lien de connexion a été envoyé à <b>{email}</b>. Ouvrez-le sur cet appareil.</p>
            <button type="button" className="btn" onClick={() => setSent(false)}>Utiliser une autre adresse</button>
          </>
        ) : (
          <>
            <h1>Connexion</h1>
            <div className="field"><label htmlFor="login-email">Adresse e-mail</label>
              <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {error && <p className="err">{error}</p>}
            <button className="btn primary" disabled={busy}>{busy ? 'Envoi…' : 'Recevoir un lien de connexion'}</button>
            <p className="faint" style={{ fontSize: '.8rem' }}>Pas de mot de passe : un lien valable quelques minutes vous est envoyé par e-mail.</p>
          </>
        )}
      </form>
    </div>
  );
}
