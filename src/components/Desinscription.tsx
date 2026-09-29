import { useEffect, useState } from 'react';
import { CONTACT, SUPABASE } from '../data/config';

type Etat = 'attente' | 'envoi' | 'ok' | 'inconnu' | 'erreur';

/** Page publique /desinscription?t=<jeton> : lien présent dans chaque e-mail de prospection */
export default function Desinscription() {
  const token = new URLSearchParams(window.location.search).get('t') ?? '';
  const valide = /^[0-9a-f-]{36}$/i.test(token);
  const [etat, setEtat] = useState<Etat>('attente');

  useEffect(() => {
    document.title = 'Désinscription · Medina Fusion';
  }, []);

  const confirmer = async () => {
    setEtat('envoi');
    try {
      const res = await fetch(`${SUPABASE.url}/rest/v1/rpc/prospect_desinscrire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE.anonKey },
        body: JSON.stringify({ p_token: token }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setEtat((await res.json()) === true ? 'ok' : 'inconnu');
    } catch {
      setEtat('erreur');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-gold/40 bg-ink-800 p-6 text-center shadow-2xl">
        <p className="font-display text-2xl font-bold text-gold-light">MEDINA FUSION</p>
        <h1 className="mt-2 text-lg font-semibold text-white">Ne plus recevoir nos messages</h1>
        {!valide ? (
          <p className="mt-4 text-sm text-neutral-300">
            Lien incomplet. Pour vous désinscrire, répondez simplement « STOP » à notre e-mail ou écrivez à{' '}
            <a className="text-gold underline" href={`mailto:${CONTACT.email}?subject=D%C3%A9sinscription`}>
              {CONTACT.email}
            </a>
            .
          </p>
        ) : etat === 'ok' ? (
          <p role="status" className="mt-4 text-sm text-emerald-300">
            C’est fait : votre adresse est retirée définitivement de nos envois. Vous ne recevrez plus aucun message de prospection de notre part.
          </p>
        ) : etat === 'inconnu' ? (
          <p role="status" className="mt-4 text-sm text-neutral-300">
            Ce lien ne correspond à aucune adresse enregistrée : aucun message ne vous sera envoyé.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-neutral-300">Un clic suffit. C’est gratuit et immédiat.</p>
            <button type="button" className="btn-gold mt-5 w-full" disabled={etat === 'envoi'} onClick={() => void confirmer()}>
              {etat === 'envoi' ? 'Désinscription…' : 'Confirmer la désinscription'}
            </button>
            {etat === 'erreur' && (
              <p role="alert" className="mt-4 text-sm text-red-300">
                Le service ne répond pas. Répondez « STOP » à notre e-mail ou écrivez à {CONTACT.email} : nous vous retirerons de la liste.
              </p>
            )}
          </>
        )}
        <a href="/" className="mt-6 block text-xs text-neutral-500">
          Medina Fusion — {CONTACT.adresse}
        </a>
      </div>
    </main>
  );
}
