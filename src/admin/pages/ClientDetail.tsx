import { useId, useState, type FormEvent } from 'react';
import { formatPrice } from '../../lib/format';
import { go, useAdmin } from '../AdminApp';
import { estVente, montants, telCle } from '../stats';
import type { ClientInput } from '../types';
import { Card, Empty, Field, fmtDate, Input, PaiementBadge, StatutBadge, Textarea } from '../ui';

const empty: ClientInput = { nom: '', entreprise: '', telephone: '', email: '', adresse: '', notes: '' };

export default function ClientDetail({ id }: { id: string | null }) {
  const { clients, clientById, commandes, saveClient, deleteClient } = useAdmin();
  const uid = useId();
  const existing = id ? clientById.get(id) : undefined;
  const [form, setForm] = useState<ClientInput>(() => (existing ? { ...existing } : { ...empty }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (id && !existing) return <Empty>Client introuvable.</Empty>;

  const historique = id
    ? commandes.filter((c) => c.client_id === id).sort((a, b) => (b.date_prestation ?? '9999').localeCompare(a.date_prestation ?? '9999'))
    : [];
  const ca = historique.filter(estVente).reduce((s, c) => s + montants(c).ttc, 0);
  const reste = historique.filter(estVente).reduce((s, c) => s + montants(c).reste, 0);

  // Anti-doublon en direct
  const email = form.email.trim().toLowerCase();
  const cle = telCle(form.telephone);
  const doublon = clients.find(
    (c) => c.id !== id && ((email && c.email.toLowerCase() === email) || (cle.length === 9 && telCle(c.telephone) === cle)),
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim() && !form.entreprise.trim()) return setMsg({ ok: false, text: 'Indiquez au moins un nom ou une entreprise.' });
    if (doublon) return setMsg({ ok: false, text: 'Ce client existe déjà (même email ou téléphone).' });
    setBusy(true);
    try {
      const saved = await saveClient({ ...form, email, id: id ?? undefined });
      if (!id) go(`clients/${saved.id}`);
      else setMsg({ ok: true, text: 'Fiche enregistrée ✓' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const supprimer = async () => {
    if (!id) return;
    if (!window.confirm(`Supprimer ce client ? Ses ${historique.length} commande(s) seront conservées sans client associé.`)) return;
    await deleteClient(id);
    go('clients');
  };

  const f = (k: string) => `${uid}-${k}`;
  const champs = [
    ['nom', 'Nom du contact', 'text', 'name'],
    ['entreprise', 'Entreprise', 'text', 'organization'],
    ['telephone', 'Téléphone', 'tel', 'tel'],
    ['email', 'Email', 'email', 'email'],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <a href="#/clients" className="text-sm text-neutral-400 hover:text-gold">
          ← Clients
        </a>
        <h1 className="flex-1 font-display text-2xl font-bold text-white">{existing ? existing.entreprise || existing.nom : 'Nouveau client'}</h1>
        {existing && (
          <a href={`#/commandes/nouvelle?client=${existing.id}`} className="btn-gold px-4">
            + Commande / devis
          </a>
        )}
      </div>

      {existing && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <p className="text-xs uppercase text-neutral-400">Commandes</p>
            <p className="text-xl font-bold text-white">{historique.length}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase text-neutral-400">Chiffre d’affaires</p>
            <p className="text-xl font-bold text-gold">{formatPrice(ca)}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase text-neutral-400">Reste à payer</p>
            <p className={`text-xl font-bold ${reste > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{formatPrice(reste)}</p>
          </Card>
        </div>
      )}

      <form onSubmit={submit}>
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {champs.map(([k, label, type, ac]) => (
              <Field key={k} label={label} id={f(k)}>
                <Input id={f(k)} type={type} autoComplete={ac} value={form[k]} onChange={(e) => setForm((c) => ({ ...c, [k]: e.target.value }))} />
              </Field>
            ))}
            <Field label="Adresse" id={f('adresse')} className="sm:col-span-2">
              <Input id={f('adresse')} autoComplete="street-address" value={form.adresse} onChange={(e) => setForm((c) => ({ ...c, adresse: e.target.value }))} />
            </Field>
            <Field label="📝 Mes notes personnelles" id={f('notes')} className="sm:col-span-2">
              <Textarea id={f('notes')} value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Préférences, habitudes, contacts…" />
            </Field>
          </div>
          {doublon && (
            <p className="mt-3 rounded-lg bg-amber-950/70 p-3 text-sm text-amber-100">
              ⚠️ Doublon possible avec{' '}
              <a href={`#/clients/${doublon.id}`} className="font-semibold underline">
                {doublon.entreprise || doublon.nom}
              </a>{' '}
              (même email ou téléphone).
            </p>
          )}
          {msg && (
            <p role="status" className={`mt-3 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
              {msg.text}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {existing?.telephone && (
              <a href={`tel:${existing.telephone.replace(/\s/g, '')}`} className="btn-outline px-3">
                📞 Appeler
              </a>
            )}
            {existing?.email && (
              <a href={`mailto:${existing.email}`} className="btn-outline px-3">
                ✉️ Email
              </a>
            )}
            {existing && (
              <button type="button" onClick={() => void supprimer()} className="btn-outline border-red-400/50 px-3 text-red-300">
                Supprimer
              </button>
            )}
            <button type="submit" className="btn-gold ml-auto px-6" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </Card>
      </form>

      {existing && (
        <Card>
          <h2 className="mb-3 font-semibold text-white">Historique des devis et commandes</h2>
          {historique.length === 0 ? (
            <Empty>Aucune commande pour ce client.</Empty>
          ) : (
            <ul className="divide-y divide-white/10">
              {historique.map((c) => (
                <li key={c.id}>
                  <a href={`#/commandes/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-white/5">
                    <span>
                      <span className="font-semibold text-white">{fmtDate(c.date_prestation)}</span>
                      <span className="ml-2 text-sm text-neutral-400">
                        {c.numero_facture ?? c.numero_devis ?? ''} {c.type === 'degustation' ? '🎁 Dégustation' : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-gold">{formatPrice(montants(c).ttc)}</span>
                      <StatutBadge statut={c.statut} />
                      <PaiementBadge statut={c.paiement_statut} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
