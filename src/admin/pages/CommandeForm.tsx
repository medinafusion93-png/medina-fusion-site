import { useId, useMemo, useState, type FormEvent } from 'react';
import { ORDERABLES } from '../../data/products';
import { formatPrice, round2 } from '../../lib/format';
import { go, useAdmin } from '../AdminApp';
import { coutMatiere, montants, telCle, totalHT } from '../stats';
import { PAIEMENTS, STATUTS, type ClientInput, type CommandeInput, type Ligne } from '../types';
import { Card, Field, Input, Select, StatutBadge, Textarea } from '../ui';

const CATALOGUE = [...ORDERABLES.values()].map((o) => ({ nom: o.nom, prix: o.prix }));
const prixCatalogue = new Map(CATALOGUE.map((c) => [c.nom, c.prix]));

const NOUVEAU = '__nouveau__';
const emptyClient: ClientInput = { nom: '', entreprise: '', telephone: '', email: '', adresse: '', notes: '' };

function vide(clientId: string | null): CommandeInput {
  return {
    client_id: clientId, source: 'admin', type: 'commande', statut: 'demande', paiement_statut: 'en_attente',
    montant_encaisse: 0, date_prestation: null, heure: '', nb_personnes: null, mode: 'livraison', adresse: '',
    lignes: [], total_ht: 0, tva_taux: 0.1, allergies: '', notes: '', parrain: '', numero_devis: null, numero_facture: null,
  };
}

export default function CommandeForm({ id }: { id: string | null }) {
  const { commandes, clients, clientById, saveCommande, saveClient, deleteCommande, ingredients, recettes, ingredientById } = useAdmin();
  const uid = useId();
  const existing = id ? commandes.find((c) => c.id === id) : undefined;
  const presetClient = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('client');

  const [form, setForm] = useState<CommandeInput>(() => (existing ? { ...existing, lignes: existing.lignes.map((l) => ({ ...l })) } : vide(presetClient)));
  const [clientSel, setClientSel] = useState<string>(existing?.client_id ?? presetClient ?? (clients.length ? '' : NOUVEAU));
  const [newClient, setNewClient] = useState<ClientInput>(emptyClient);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof CommandeInput>(k: K, v: CommandeInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLigne = (i: number, patch: Partial<Ligne>) =>
    setForm((f) => ({ ...f, lignes: f.lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  const ht = totalHT(form.lignes);
  const m = montants({ total_ht: ht, tva_taux: form.tva_taux, montant_encaisse: form.montant_encaisse });
  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => (a.entreprise || a.nom).localeCompare(b.entreprise || b.nom, 'fr')),
    [clients],
  );

  if (id && !existing) {
    return (
      <Card>
        <p className="text-neutral-300">Commande introuvable.</p>
        <a href="#/commandes" className="btn-outline mt-4">
          ← Retour
        </a>
      </Card>
    );
  }

  const choisirClient = (value: string) => {
    setClientSel(value);
    const cl = clientById.get(value);
    if (cl && !form.adresse) set('adresse', cl.adresse);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      let clientId: string | null = clientSel && clientSel !== NOUVEAU ? clientSel : null;
      if (clientSel === NOUVEAU) {
        if (!newClient.nom.trim() && !newClient.entreprise.trim()) throw new Error('Indiquez au moins le nom ou l’entreprise du client.');
        // Anti-doublon : même email ou même téléphone → on réutilise la fiche existante
        const email = newClient.email.trim().toLowerCase();
        const cle = telCle(newClient.telephone);
        const doublon = clients.find((c) => (email && c.email.toLowerCase() === email) || (cle.length === 9 && telCle(c.telephone) === cle));
        clientId = doublon ? doublon.id : (await saveClient({ ...newClient, email })).id;
        if (doublon) setMsg({ ok: true, text: `Client déjà connu : fiche « ${doublon.entreprise || doublon.nom} » réutilisée.` });
      }
      const lignes = form.lignes
        .filter((l) => l.nom.trim() && Number(l.quantite) > 0)
        .map((l) => ({ nom: l.nom.trim(), quantite: Number(l.quantite), prix_unitaire: round2(Number(l.prix_unitaire) || 0) }));
      const saved = await saveCommande({
        ...form,
        client_id: clientId,
        adresse: form.mode === 'retrait' ? '' : form.adresse,
        lignes,
        total_ht: totalHT(lignes),
        montant_encaisse: round2(Number(form.montant_encaisse) || 0),
        nb_personnes: form.nb_personnes ? Number(form.nb_personnes) : null,
      });
      if (!id) go(`commandes/${saved.id}`);
      else setMsg({ ok: true, text: 'Commande enregistrée ✓' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const supprimer = async () => {
    if (!id || !window.confirm('Supprimer définitivement cette commande ? (Pour garder une trace, préférez le statut « Annulée ».)')) return;
    await deleteCommande(id);
    go('commandes');
  };

  const f = (name: string) => `${uid}-${name}`;
  const titre = existing ? `Commande · ${clientById.get(existing.client_id ?? '')?.entreprise || clientById.get(existing.client_id ?? '')?.nom || 'client inconnu'}` : 'Nouvelle commande';

  return (
    <form onSubmit={submit} className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <a href="#/commandes" className="text-sm text-neutral-400 hover:text-gold">
          ← Commandes
        </a>
        <h1 className="flex-1 font-display text-2xl font-bold text-white">{titre}</h1>
        {existing && <StatutBadge statut={existing.statut} />}
      </div>
      {existing?.source === 'site' && existing.statut === 'demande' && (
        <p className="rounded-xl border border-sky-400/40 bg-sky-500/10 p-3 text-sm text-sky-100">
          📥 Demande reçue depuis le site, <strong>non confirmée</strong>. Vérifiez-la, envoyez le devis, puis passez-la en « Confirmée ».
        </p>
      )}

      {/* ---------- Client ---------- */}
      <Card>
        <h2 className="mb-3 font-semibold text-gold-light">Client</h2>
        <Field label="Client" id={f('client')}>
          <Select id={f('client')} value={clientSel} onChange={(e) => choisirClient(e.target.value)}>
            <option value="">— Choisir un client —</option>
            <option value={NOUVEAU}>➕ Nouveau client</option>
            {sortedClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.entreprise ? `${c.entreprise} — ${c.nom}` : c.nom} {c.telephone && `(${c.telephone})`}
              </option>
            ))}
          </Select>
        </Field>
        {clientSel === NOUVEAU && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ['nom', 'Nom du contact', 'text'],
                ['entreprise', 'Entreprise', 'text'],
                ['telephone', 'Téléphone', 'tel'],
                ['email', 'Email', 'email'],
              ] as const
            ).map(([k, label, type]) => (
              <Field key={k} label={label} id={f(`nc-${k}`)}>
                <Input id={f(`nc-${k}`)} type={type} value={newClient[k]} onChange={(e) => setNewClient((c) => ({ ...c, [k]: e.target.value }))} />
              </Field>
            ))}
            <Field label="Adresse" id={f('nc-adresse')} className="sm:col-span-2">
              <Input
                id={f('nc-adresse')}
                value={newClient.adresse}
                onChange={(e) => {
                  setNewClient((c) => ({ ...c, adresse: e.target.value }));
                  set('adresse', e.target.value);
                }}
              />
            </Field>
          </div>
        )}
        {clientSel && clientSel !== NOUVEAU && (
          <a href={`#/clients/${clientSel}`} className="mt-2 inline-block text-sm text-gold underline underline-offset-2">
            Voir la fiche client
          </a>
        )}
      </Card>

      {/* ---------- Prestation ---------- */}
      <Card>
        <h2 className="mb-3 font-semibold text-gold-light">Prestation</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date" id={f('date')}>
            <Input id={f('date')} type="date" value={form.date_prestation ?? ''} onChange={(e) => set('date_prestation', e.target.value || null)} />
          </Field>
          <Field label="Heure" id={f('heure')}>
            <Input id={f('heure')} type="time" value={form.heure} onChange={(e) => set('heure', e.target.value)} />
          </Field>
          <Field label="Nombre de personnes" id={f('pers')}>
            <Input
              id={f('pers')}
              type="number"
              min={0}
              inputMode="numeric"
              value={form.nb_personnes ?? ''}
              onChange={(e) => set('nb_personnes', e.target.value === '' ? null : Number(e.target.value))}
            />
          </Field>
          <Field label="Type" id={f('type')}>
            <Select id={f('type')} value={form.type} onChange={(e) => set('type', e.target.value as CommandeInput['type'])}>
              <option value="commande">Commande</option>
              <option value="degustation">Dégustation</option>
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Mode">
          {(['livraison', 'retrait'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={form.mode === mode}
              onClick={() => set('mode', mode)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold ${form.mode === mode ? 'border-gold bg-gold/15 text-gold-light' : 'border-white/15 text-neutral-300'}`}
            >
              {mode === 'livraison' ? '🚚 Livraison' : '🏪 Retrait sur place'}
            </button>
          ))}
        </div>
        {form.mode === 'livraison' && (
          <Field label="Adresse de livraison" id={f('adresse')} className="mt-3">
            <Input id={f('adresse')} value={form.adresse} onChange={(e) => set('adresse', e.target.value)} />
          </Field>
        )}
      </Card>

      {/* ---------- Menu ---------- */}
      <Card>
        <h2 className="mb-3 font-semibold text-gold-light">Menu & quantités</h2>
        <datalist id={f('catalogue')}>
          {CATALOGUE.map((c) => (
            <option key={c.nom} value={c.nom} />
          ))}
        </datalist>
        <div className="space-y-3">
          {form.lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-white/10 p-2 sm:grid-cols-[1fr_90px_120px_110px_auto] sm:items-center">
              <Input
                aria-label={`Désignation ligne ${i + 1}`}
                list={f('catalogue')}
                placeholder="Produit (catalogue ou libre)"
                value={l.nom}
                onChange={(e) => {
                  const prix = prixCatalogue.get(e.target.value);
                  setLigne(i, prix !== undefined ? { nom: e.target.value, prix_unitaire: prix } : { nom: e.target.value });
                }}
                className="col-span-2 sm:col-span-1"
              />
              <Input aria-label="Quantité" type="number" min={0} inputMode="numeric" value={l.quantite} onChange={(e) => setLigne(i, { quantite: Number(e.target.value) })} />
              <Input aria-label="Prix unitaire HT" type="number" min={0} step="0.01" inputMode="decimal" value={l.prix_unitaire} onChange={(e) => setLigne(i, { prix_unitaire: Number(e.target.value) })} />
              <span className="text-right text-sm font-semibold tabular-nums text-neutral-100 sm:text-base">{formatPrice((Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0))}</span>
              <button
                type="button"
                aria-label={`Retirer la ligne ${i + 1}`}
                onClick={() => setForm((fm) => ({ ...fm, lignes: fm.lignes.filter((_, j) => j !== i) }))}
                className="h-10 w-10 justify-self-end rounded-full border border-white/15 text-red-300 hover:border-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setForm((fm) => ({ ...fm, lignes: [...fm.lignes, { nom: '', quantite: 1, prix_unitaire: 0 }] }))}
          className="btn-outline mt-3 w-full sm:w-auto"
        >
          + Ajouter une ligne
        </button>
        {ingredients && form.lignes.length > 0 && (() => {
          const cm = coutMatiere(form.lignes, recettes, ingredientById);
          return (
            <div className="mt-4 rounded-xl bg-ink p-3 text-sm">
              <p className="text-neutral-300">
                🥕 Coût matière estimé : <strong className="text-white">{formatPrice(cm.cout)}</strong> · Marge brute :{' '}
                <strong className={m.ht - cm.cout >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                  {formatPrice(m.ht - cm.cout)}
                  {m.ht > 0 && ` (${Math.round(((m.ht - cm.cout) / m.ht) * 100)} %)`}
                </strong>
              </p>
              {cm.sansRecette.length > 0 && (
                <p className="mt-1 text-xs text-amber-300">
                  Sans recette (non compté) : {cm.sansRecette.join(', ')} —{' '}
                  <a href="#/stock" className="underline">
                    ajouter les recettes
                  </a>
                </p>
              )}
            </div>
          );
        })()}
        <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-neutral-300">
            <dt>Total HT</dt>
            <dd className="tabular-nums">{formatPrice(m.ht)}</dd>
          </div>
          <div className="flex justify-between text-neutral-300">
            <dt>TVA {Math.round(form.tva_taux * 100)} %</dt>
            <dd className="tabular-nums">{formatPrice(m.tva)}</dd>
          </div>
          <div className="flex justify-between text-lg font-bold text-gold">
            <dt>Total TTC</dt>
            <dd className="tabular-nums">{formatPrice(m.ttc)}</dd>
          </div>
        </dl>
      </Card>

      {/* ---------- Allergies & notes ---------- */}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="⚠️ Allergies / demandes particulières" id={f('allergies')}>
            <Textarea id={f('allergies')} value={form.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Ex. 2 sans gluten, 1 allergie fruits à coque" />
          </Field>
          <Field label="Notes internes" id={f('notes')}>
            <Textarea id={f('notes')} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Visible uniquement dans l’espace admin" />
          </Field>
          <Field label="Recommandé par (parrain)" id={f('parrain')}>
            <Input id={f('parrain')} value={form.parrain} onChange={(e) => set('parrain', e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* ---------- Suivi ---------- */}
      <Card>
        <h2 className="mb-3 font-semibold text-gold-light">Suivi</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Statut" id={f('statut')}>
            <Select id={f('statut')} value={form.statut} onChange={(e) => set('statut', e.target.value as CommandeInput['statut'])}>
              {STATUTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Paiement" id={f('paiement')}>
            <Select id={f('paiement')} value={form.paiement_statut} onChange={(e) => set('paiement_statut', e.target.value as CommandeInput['paiement_statut'])}>
              {PAIEMENTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Montant encaissé (TTC)" id={f('encaisse')}>
            <Input id={f('encaisse')} type="number" min={0} step="0.01" inputMode="decimal" value={form.montant_encaisse} onChange={(e) => set('montant_encaisse', Number(e.target.value))} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setForm((fm) => ({ ...fm, paiement_statut: 'acompte', montant_encaisse: round2(m.ttc * 0.3) }))}>
            Acompte 30 % ({formatPrice(round2(m.ttc * 0.3))})
          </button>
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setForm((fm) => ({ ...fm, paiement_statut: 'paye', montant_encaisse: m.ttc }))}>
            Tout est payé ({formatPrice(m.ttc)})
          </button>
        </div>
        <p className="mt-3 text-sm text-neutral-300">
          Reste à payer : <strong className={m.reste > 0 ? 'text-amber-300' : 'text-emerald-300'}>{formatPrice(m.reste)}</strong>
        </p>
      </Card>

      {existing && (
        <Card>
          <h2 className="mb-3 font-semibold text-gold-light">Documents</h2>
          <div className="flex flex-wrap gap-2">
            <a href={`#/imprimer/${existing.id}/devis`} className="btn-outline">
              📄 Devis {existing.numero_devis && `(${existing.numero_devis})`}
            </a>
            <a href={`#/imprimer/${existing.id}/facture`} className="btn-outline">
              🧾 Facture {existing.numero_facture && `(${existing.numero_facture})`}
            </a>
            <a href={`#/imprimer/${existing.id}/cuisine`} className="btn-outline">
              👩‍🍳 Fiche cuisine
            </a>
            <a href={`#/imprimer/${existing.id}/livraison`} className="btn-outline">
              🚚 Bon livreur
            </a>
          </div>
          <p className="mt-2 text-xs text-neutral-400">Enregistrez vos modifications avant d’imprimer.</p>
        </Card>
      )}

      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {msg.text}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-white/10 bg-ink/95 p-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-6xl gap-2">
          {existing && (
            <button type="button" onClick={() => void supprimer()} className="btn-outline border-red-400/50 px-3 text-red-300">
              Supprimer
            </button>
          )}
          <a href="#/commandes" className="btn-outline ml-auto px-4">
            Annuler
          </a>
          <button type="submit" className="btn-gold px-6" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </form>
  );
}
