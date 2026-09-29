import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { formatPrice } from '../../lib/format';
import { useAdmin } from '../AdminApp';
import {
  apercu, CATEGORIES, domaine, EMAIL_STATUTS, liensRecherche, messageLinkedIn, MODELE, MOTIFS, planifier, selectionner, statsCampagne,
  STATUTS_PROSPECT, statutProspect, trouverDoublon, VARIABLES, VILLES,
  type Campagne, type CampagneInput, type Envoi, type Exclusion, type Parametres, type Prospect, type ProspectInput, type ProspectStatut,
  type ResultatRecherche,
} from '../prospection';
import { getProspectionApi, type ProspectionApi, type Recherche } from '../prospectionApi';
import { matches } from '../stats';
import { Card, Empty, Field, Input, Select, Spinner, Textarea, fmtDate } from '../ui';

// ---------------------------------------------------------------------------
// Données du module
// ---------------------------------------------------------------------------
interface Donnees {
  api: ProspectionApi;
  params: Parametres;
  prospects: Prospect[];
  campagnes: Campagne[];
  envois: Envoi[];
  exclusions: Exclusion[];
  reload: () => Promise<void>;
}
const Ctx = createContext<Donnees | null>(null);
const useP = () => useContext(Ctx)!;

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const dateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function Message({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <p role={m.ok ? 'status' : 'alert'} className={`mt-3 whitespace-pre-line text-sm ${m.ok ? 'text-emerald-300' : 'text-red-300'}`}>
      {m.text}
    </p>
  );
}

/** Exécute une action et affiche son résultat (succès ou erreur réelle) */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = useCallback(async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg(null);
    try {
      const t = await fn();
      if (t) setMsg({ ok: true, text: t });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, msg, setMsg, run };
}

async function copier(texte: string) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// État des connexions (toujours lu depuis la base, écrit par le serveur)
// ---------------------------------------------------------------------------
function EtatConnexions() {
  const { api, params } = useP();
  const relancesPossibles = params.relance_active && params.detection_reponses_ok;
  const ligne = (ok: boolean, oui: string, non: string) => (
    <li className={ok ? 'text-emerald-300' : 'text-amber-200'}>
      {ok ? '✅' : '⛔'} {ok ? oui : non}
    </li>
  );
  return (
    <Card className={params.envoi_operationnel ? '' : 'border-amber-400/40'}>
      <ul className="space-y-1 text-sm">
        {!api.serveurDisponible && <li className="text-amber-200">⛔ Mode démo : fonction serveur non connectée, aucune action réelle possible.</li>}
        {ligne(params.envoi_operationnel, `Envoi d’e-mails opérationnel (${params.expediteur_email})`, 'Envoi d’e-mails non connecté : aucun message ne partira.')}
        {ligne(
          params.detection_reponses_ok,
          'Détection des réponses et des adresses rejetées opérationnelle',
          'Détection des réponses non connectée : relances automatiques désactivées.',
        )}
        {params.detection_reponses_ok && !params.relance_active && <li className="text-neutral-400">Relances désactivées dans les paramètres.</li>}
        {relancesPossibles && <li className="text-emerald-300">✅ Relance unique à J+5 ouvrés, arrêtée en cas de réponse, refus, désinscription ou adresse rejetée.</li>}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">
        Dernière vérification : {dateHeure(params.derniere_verification)} · Dernier passage automatique : {dateHeure(params.dernier_passage)}
      </p>
      {params.derniere_erreur && <p className="mt-1 text-xs text-red-300">Dernière erreur : {params.derniere_erreur}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Recherche (API officielle Recherche d’entreprises)
// ---------------------------------------------------------------------------
function RechercheOnglet() {
  const { api, prospects, reload } = useP();
  const f = useId();
  const [ville, setVille] = useState(VILLES[0]!.id);
  const [rayon, setRayon] = useState(2);
  const [categorie, setCategorie] = useState(CATEGORIES[0]!.id);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Recherche | null>(null);
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const { busy, msg, run } = useAction();

  const chercher = (p: number) =>
    run(async () => {
      const v = VILLES.find((x) => x.id === ville)!;
      const r = await api.rechercher({ lat: v.lat, lon: v.lon, rayon, categorie, page: p });
      setRes(r);
      setPage(p);
      setChoix(new Set());
      if (!r.resultats.length) return 'Aucune structure trouvée pour ces critères.';
    });

  const ajouter = () =>
    run(async () => {
      if (!res) return;
      const cat = CATEGORIES.find((c) => c.id === categorie)!.label;
      let ajoutes = 0;
      const doublons: string[] = [];
      const existants = [...prospects];
      for (const r of res.resultats.filter((x) => choix.has(x.siren))) {
        const d = trouverDoublon({ siren: r.siren, nom: r.nom, code_postal: r.code_postal }, existants);
        if (d) {
          doublons.push(`${r.nom} (${d.raison})`);
          continue;
        }
        const p = await api.saveProspect({
          siren: r.siren, nom: r.nom, categorie: cat, activite: r.activite, naf: r.naf, effectif: r.effectif, adresse: r.adresse,
          code_postal: r.code_postal, ville: r.ville, source: `${res.source} — SIREN ${r.siren}`, collecte_le: new Date().toISOString(),
          notes: r.dirigeants.length ? `Dirigeants déclarés (registre officiel) : ${r.dirigeants.join(', ')}` : '',
        });
        existants.push(p);
        ajoutes++;
      }
      await reload();
      setChoix(new Set());
      return `${ajoutes} prospect${ajoutes > 1 ? 's' : ''} ajouté${ajoutes > 1 ? 's' : ''}.${doublons.length ? `\nIgnorés (déjà présents) : ${doublons.join(' ; ')}` : ''}\nÉtape suivante : renseigner le site officiel, puis chercher l’e-mail public (onglet Prospects).`;
    });

  const deja = new Set([...(res?.dejaEnregistres ?? []), ...prospects.map((p) => p.siren ?? '')]);
  const selectionnables = (res?.resultats ?? []).filter((r) => !deja.has(r.siren));

  return (
    <div className="space-y-4">
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto_1.4fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void chercher(1);
          }}
        >
          <Field label="Autour de" id={f + 'v'}>
            <Select id={f + 'v'} value={ville} onChange={(e) => setVille(e.target.value)}>
              {VILLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rayon" id={f + 'r'}>
            <Select id={f + 'r'} value={rayon} onChange={(e) => setRayon(Number(e.target.value))}>
              {[1, 2, 3, 5, 10].map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type de structure" id={f + 'c'}>
            <Select id={f + 'c'} value={categorie} onChange={(e) => setCategorie(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <button type="submit" className="btn-gold" disabled={busy}>
            {busy ? 'Recherche…' : '🔎 Rechercher'}
          </button>
        </form>
        <p className="mt-3 text-xs text-neutral-500">
          Source : API officielle « Recherche d’entreprises » (data.gouv, gratuite). Elle donne nom, SIREN, activité, effectif et adresse
          déclarée — jamais d’e-mail, de téléphone ni de site : ceux-ci se complètent ensuite depuis le site officiel de la structure.
        </p>
        <Message m={msg} />
      </Card>

      {res && res.resultats.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-300">
              {res.total} structure{res.total > 1 ? 's' : ''} · page {page}/{res.pages || 1}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-outline px-3 text-xs" onClick={() => setChoix(new Set(selectionnables.map((r) => r.siren)))}>
                Tout cocher
              </button>
              <button type="button" className="btn-gold px-4 text-sm" disabled={!choix.size || busy} onClick={() => void ajouter()}>
                Ajouter la sélection ({choix.size})
              </button>
            </div>
          </div>
          <ul className="mt-3 divide-y divide-white/5">
            {res.resultats.map((r: ResultatRecherche) => {
              const present = deja.has(r.siren);
              return (
                <li key={r.siren} className="flex gap-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Sélectionner ${r.nom}`}
                    className="mt-1 h-5 w-5 accent-[#c9a227]"
                    disabled={present}
                    checked={choix.has(r.siren)}
                    onChange={(e) => {
                      const n = new Set(choix);
                      if (e.target.checked) n.add(r.siren);
                      else n.delete(r.siren);
                      setChoix(n);
                    }}
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-white">
                      {r.nom} {present && <span className="ml-1 rounded-full bg-white/10 px-2 text-xs text-neutral-300">déjà enregistré</span>}
                    </p>
                    <p className="text-neutral-400">
                      {[r.activite, r.effectif && `${r.effectif} salariés`].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {r.adresse || 'Adresse non communiquée'} · SIREN {r.siren}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-center gap-2">
            <button type="button" className="btn-outline px-3 text-xs" disabled={page <= 1 || busy} onClick={() => void chercher(page - 1)}>
              ← Précédente
            </button>
            <button type="button" className="btn-outline px-3 text-xs" disabled={page >= res.pages || busy} onClick={() => void chercher(page + 1)}>
              Suivante →
            </button>
          </div>
        </Card>
      )}
      <AjoutManuel />
    </div>
  );
}

function AjoutManuel() {
  const { api, prospects, reload } = useP();
  const f = useId();
  const vide = { nom: '', ville: '', site: '', email: '', telephone: '', source: '' };
  const [v, setV] = useState(vide);
  const { busy, msg, run } = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const d = trouverDoublon({ nom: v.nom, email: v.email, site: v.site }, prospects);
      if (d) throw new Error(`Doublon : « ${d.prospect.nom} » existe déjà (${d.raison}).`);
      const email = v.email.trim().toLowerCase();
      await api.saveProspect({
        nom: v.nom.trim(), ville: v.ville.trim(), site: v.site.trim(), telephone: v.telephone.trim(), email,
        email_statut: email ? 'trouvee' : 'a_trouver', email_source: email ? `${v.source.trim()} (saisi le ${aujourdhui()})` : '',
        source: v.source.trim(), collecte_le: new Date().toISOString(),
      });
      setV(vide);
      await reload();
      return 'Prospect ajouté.';
    });
  };
  const champ = (k: keyof typeof vide, label: string, type = 'text', required = false) => (
    <Field label={label} id={f + k}>
      <Input id={f + k} type={type} required={required} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Field>
  );
  return (
    <Card>
      <details>
        <summary className="cursor-pointer font-semibold text-white">➕ Ajouter un prospect à la main</summary>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          {champ('nom', 'Nom de la structure *', 'text', true)}
          {champ('ville', 'Ville')}
          {champ('site', 'Site officiel')}
          {champ('email', 'E-mail professionnel public', 'email')}
          {champ('telephone', 'Téléphone', 'tel')}
          {champ('source', 'Source (où l’avez-vous trouvé ?) *', 'text', true)}
          <button type="submit" className="btn-gold sm:col-span-2" disabled={busy}>
            Ajouter
          </button>
        </form>
        <Message m={msg} />
      </details>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------
function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

function FicheProspect({ p }: { p: Prospect }) {
  const { api, params, prospects, reload } = useP();
  const f = useId();
  const [v, setV] = useState(p);
  const { busy, msg, setMsg, run } = useAction();
  const liens = liensRecherche(p);
  const li = messageLinkedIn(v, params.site_url, params.expediteur_nom);

  const enregistrer = () =>
    run(async () => {
      const email = v.email.trim().toLowerCase();
      const d = trouverDoublon({ id: p.id, email, site: v.site }, prospects);
      if (d) throw new Error(`Doublon : « ${d.prospect.nom} » a déjà ${d.raison === 'même e-mail' ? 'cet e-mail' : 'ce site'}.`);
      const emailChange = email !== p.email;
      const input: ProspectInput = {
        id: p.id, nom: v.nom.trim(), site: v.site.trim(), telephone: v.telephone.trim(), linkedin_entreprise: v.linkedin_entreprise.trim(),
        contact_nom: v.contact_nom.trim(), contact_fonction: v.contact_fonction.trim(), linkedin_contact: v.linkedin_contact.trim(), notes: v.notes,
        ...(emailChange
          ? { email, email_statut: email ? 'trouvee' : 'a_trouver', email_source: email ? `Saisie manuelle le ${aujourdhui()}` : '' }
          : {}),
      };
      await api.saveProspect(input);
      await reload();
      return 'Enregistré.';
    });

  const exclure = (motif: 'refus' | 'desinscription') =>
    run(async () => {
      if (!p.email) {
        await api.saveProspect({ id: p.id, nom: p.nom, statut: motif === 'refus' ? 'refus' : 'desinscrit' });
      } else {
        if (!window.confirm(`Ajouter ${p.email} à la liste d’exclusion définitive ? Plus aucun message ne lui sera envoyé.`)) return;
        await api.addExclusion(p.email, motif);
      }
      await reload();
      return 'Ajouté à la liste d’exclusion.';
    });

  const champ = (k: 'site' | 'email' | 'telephone' | 'linkedin_entreprise' | 'contact_nom' | 'contact_fonction' | 'linkedin_contact', label: string, type = 'text') => (
    <Field label={label} id={f + k}>
      <Input id={f + k} type={type} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Field>
  );

  return (
    <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {champ('site', 'Site officiel')}
        {champ('email', 'E-mail professionnel public', 'email')}
        {champ('telephone', 'Téléphone', 'tel')}
        {champ('linkedin_entreprise', 'Page LinkedIn de la structure')}
        {champ('contact_nom', 'Contact (nom)')}
        {champ('contact_fonction', 'Fonction (office manager, RH, assistante de direction…)')}
        {champ('linkedin_contact', 'Profil LinkedIn du contact')}
        <Field label="Notes" id={f + 'n'}>
          <Textarea id={f + 'n'} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Field>
      </div>
      <p className="text-xs text-neutral-500">
        Source : {p.source || '—'} · collecté le {dateHeure(p.collecte_le)}
        {p.email_source && <> · e-mail : {p.email_source}</>}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-gold px-4 text-sm" disabled={busy} onClick={() => void enregistrer()}>
          Enregistrer
        </button>
        <button
          type="button"
          className="btn-outline px-3 text-xs"
          disabled={busy || !p.site}
          title={p.site ? '' : 'Enregistrez d’abord le site officiel'}
          onClick={() =>
            void run(async () => {
              const r = await api.extraireEmail(p.id);
              await reload();
              if (!r.trouvees.length) return `Aucune adresse publique trouvée (${r.pagesConsultees} page(s) autorisée(s) consultée(s)).`;
              return `Trouvé : ${r.trouvees.map((t) => `${t.email} (${t.page})`).join(', ')}${p.email ? '\nL’adresse existante n’a pas été remplacée.' : ''}`;
            })
          }
        >
          🔎 Chercher l’e-mail sur le site officiel
        </button>
        {p.email && p.email_statut === 'trouvee' && (
          <button
            type="button"
            className="btn-outline px-3 text-xs"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api.saveProspect({ id: p.id, nom: p.nom, email_statut: 'verifiee', email_source: `${p.email_source} · vérifiée manuellement le ${aujourdhui()}` });
                await reload();
                return 'Adresse marquée comme vérifiée.';
              })
            }
          >
            ✔ Marquer l’e-mail vérifié
          </button>
        )}
        <button type="button" className="btn-outline px-3 text-xs" disabled={busy} onClick={() => void exclure('refus')}>
          Refus
        </button>
        <button type="button" className="btn-outline px-3 text-xs" disabled={busy} onClick={() => void exclure('desinscription')}>
          Désinscrire
        </button>
      </div>
      <div className="rounded-xl bg-white/5 p-3 text-sm">
        <p className="font-semibold text-white">LinkedIn (manuel uniquement)</p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {p.linkedin_entreprise && (
            <a className="text-gold underline" href={p.linkedin_entreprise} target="_blank" rel="noreferrer">
              Page de la structure
            </a>
          )}
          {p.linkedin_contact && (
            <a className="text-gold underline" href={p.linkedin_contact} target="_blank" rel="noreferrer">
              Profil du contact
            </a>
          )}
          <a className="text-gold underline" href={liens.linkedinEntreprise} target="_blank" rel="noreferrer">
            Rechercher la structure
          </a>
          <a className="text-gold underline" href={liens.linkedinPersonnes} target="_blank" rel="noreferrer">
            Rechercher un contact
          </a>
          <a className="text-gold underline" href={liens.google} target="_blank" rel="noreferrer">
            Trouver le site officiel (Google)
          </a>
        </p>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-ink p-2 font-sans text-xs text-neutral-300">{li}</pre>
        <button
          type="button"
          className="btn-outline mt-2 px-3 text-xs"
          onClick={() => void copier(li).then((ok) => setMsg({ ok, text: ok ? 'Message copié : collez-le dans LinkedIn.' : 'Copie impossible : sélectionnez le texte.' }))}
        >
          📋 Copier le message
        </button>
      </div>
      <Message m={msg} />
    </div>
  );
}

function ProspectsOnglet() {
  const { prospects, api, reload } = useP();
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState<'' | ProspectStatut>('');
  const [emailF, setEmailF] = useState('');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const liste = prospects.filter(
    (p) =>
      (!statut || p.statut === statut) &&
      (!emailF || p.email_statut === emailF) &&
      (!q || matches(q, `${p.nom} ${p.ville} ${p.activite} ${p.email} ${p.contact_nom} ${p.siren ?? ''}`)),
  );
  if (!prospects.length) return <Empty>Aucun prospect. Lancez une recherche (onglet « Recherche ») ou ajoutez-en un à la main.</Empty>;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_1fr]">
        <Input placeholder="Rechercher…" aria-label="Rechercher un prospect" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Filtrer par statut" value={statut} onChange={(e) => setStatut(e.target.value as ProspectStatut | '')}>
          <option value="">Tous les statuts</option>
          {STATUTS_PROSPECT.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({prospects.filter((p) => p.statut === s.id).length})
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrer par e-mail" value={emailF} onChange={(e) => setEmailF(e.target.value)}>
          <option value="">Tous les e-mails</option>
          {Object.entries(EMAIL_STATUTS).map(([k, s]) => (
            <option key={k} value={k}>
              {s.label} ({prospects.filter((p) => p.email_statut === k).length})
            </option>
          ))}
        </Select>
      </div>
      <p className="text-xs text-neutral-500">
        {liste.length} prospect{liste.length > 1 ? 's' : ''} · « E-mail trouvé » = publié sur une source publique, non confirmé ; « vérifié » =
        confirmé par vous ou par une réponse.
      </p>
      {liste.map((p) => {
        const s = statutProspect(p.statut);
        const e = EMAIL_STATUTS[p.email_statut];
        return (
          <Card key={p.id} className="!p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOuvert(ouvert === p.id ? null : p.id)} aria-expanded={ouvert === p.id}>
                <p className="font-semibold text-white">{p.nom}</p>
                <p className="text-sm text-neutral-400">
                  {[p.ville, p.activite, p.contact_nom && `${p.contact_nom}${p.contact_fonction ? ` (${p.contact_fonction})` : ''}`].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <Badge className={e.color}>{e.label}</Badge>
                  {p.email && <span className="text-xs text-neutral-300">{p.email}</span>}
                  {p.site && <span className="text-xs text-neutral-500">{domaine(p.site)}</span>}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <Select
                  aria-label={`Statut de ${p.nom}`}
                  className={`!w-auto !py-1.5 text-sm ${s.color}`}
                  value={p.statut}
                  disabled={p.statut === 'desinscrit' || p.statut === 'rejete'}
                  onChange={(ev) => void api.saveProspect({ id: p.id, nom: p.nom, statut: ev.target.value as ProspectStatut }).then(reload)}
                >
                  {STATUTS_PROSPECT.filter((x) => !['desinscrit', 'rejete'].includes(x.id) || x.id === p.statut).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {ouvert === p.id && <FicheProspect key={p.id + p.email + p.email_statut + p.statut} p={p} />}
          </Card>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campagnes
// ---------------------------------------------------------------------------
function Stats({ c }: { c: Campagne }) {
  const { envois, prospects } = useP();
  const { commandes } = useAdmin();
  const s = statsCampagne(c.id, envois, prospects, commandes);
  const tuiles: [string, string | number][] = [
    ['Planifiés', s.planifies],
    ['Envoyés', s.envoyes],
    ['Relances', s.relancesEnvoyees],
    ['Réponses', s.reponses],
    ['Dégustations', s.degustations],
    ['Devis', s.devis],
    ['Clients', s.clients],
    ['CA HT', formatPrice(s.caHT)],
    ['Désinscrits', s.desinscrits],
    ['Rejetés', s.rejets],
    ['Échecs', s.echecs],
    ['Annulés', s.annules],
  ];
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {tuiles.map(([l, v]) => (
        <div key={l} className="rounded-lg bg-white/5 p-2 text-center">
          <dt className="text-[11px] text-neutral-400">{l}</dt>
          <dd className="font-bold tabular-nums text-white">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const STATUT_CAMPAGNE: Record<Campagne['statut'], { label: string; color: string }> = {
  brouillon: { label: 'Brouillon', color: 'bg-neutral-600 text-white' },
  programmee: { label: 'Programmée', color: 'bg-emerald-600 text-white' },
  en_pause: { label: 'En pause', color: 'bg-amber-500 text-ink' },
  terminee: { label: 'Terminée', color: 'bg-sky-700 text-white' },
};

function CampagnesOnglet() {
  const { campagnes, api, reload, envois } = useP();
  const [edition, setEdition] = useState<Campagne | 'nouvelle' | null>(null);
  const { busy, msg, run } = useAction();

  if (edition) return <EditeurCampagne c={edition === 'nouvelle' ? null : edition} fermer={() => setEdition(null)} />;

  return (
    <div className="space-y-3">
      <button type="button" className="btn-gold" onClick={() => setEdition('nouvelle')}>
        ✉️ Préparer une campagne
      </button>
      <Message m={msg} />
      {!campagnes.length && <Empty>Aucune campagne pour l’instant.</Empty>}
      {campagnes.map((c) => {
        const st = STATUT_CAMPAGNE[c.statut];
        const prochain = envois
          .filter((e) => e.campagne_id === c.id && e.statut === 'planifie')
          .map((e) => e.planifie_pour)
          .sort()[0];
        return (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-white">
                  {c.nom} <Badge className={st.color}>{st.label}</Badge>
                </p>
                <p className="text-xs text-neutral-400">
                  {c.debut ? `Début ${fmtDate(c.debut)}` : 'Non programmée'}
                  {prochain && ` · prochain envoi prévu ${dateHeure(prochain)}`}
                  {c.relance ? ' · relance J+5 ouvrés' : ' · sans relance'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.statut === 'brouillon' && (
                  <>
                    <button type="button" className="btn-outline px-3 text-xs" onClick={() => setEdition(c)}>
                      Modifier / programmer
                    </button>
                    <button
                      type="button"
                      className="btn-outline px-3 text-xs"
                      disabled={busy}
                      onClick={() =>
                        window.confirm('Supprimer ce brouillon ?') &&
                        void run(async () => {
                          await api.deleteCampagne(c.id);
                          await reload();
                        })
                      }
                    >
                      Supprimer
                    </button>
                  </>
                )}
                {c.statut === 'programmee' && (
                  <button
                    type="button"
                    className="btn-outline px-3 text-xs"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api.setStatutCampagne(c.id, 'en_pause');
                        await reload();
                        return 'Campagne en pause : aucun envoi ni relance ne partira tant qu’elle n’est pas reprise.';
                      })
                    }
                  >
                    ⏸ Mettre la campagne en pause
                  </button>
                )}
                {c.statut === 'en_pause' && (
                  <button
                    type="button"
                    className="btn-gold px-4 text-xs"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api.setStatutCampagne(c.id, 'programmee');
                        await reload();
                        return 'Campagne reprise.';
                      })
                    }
                  >
                    ▶ Reprendre
                  </button>
                )}
              </div>
            </div>
            {c.statut !== 'brouillon' && <Stats c={c} />}
          </Card>
        );
      })}
      <p className="text-xs text-neutral-500">
        Statistiques calculées uniquement à partir des envois réellement effectués, des réponses détectées et des demandes reçues sur le site
        via le lien de la campagne.
      </p>
    </div>
  );
}

function EditeurCampagne({ c, fermer }: { c: Campagne | null; fermer: () => void }) {
  const { api, params, prospects, envois, exclusions, reload } = useP();
  const f = useId();
  const relancePossible = params.relance_active && params.detection_reponses_ok;
  const [v, setV] = useState<CampagneInput>(
    c ?? { nom: `Dégustation ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`, ...MODELE, relance: relancePossible },
  );
  const [id, setId] = useState(c?.id);
  const [debut, setDebut] = useState(aujourdhui());
  const dejaContactes = useMemo(() => new Set(envois.map((e) => e.prospect_id)), [envois]);
  const exclus = useMemo(() => new Set(exclusions.map((e) => e.email)), [exclusions]);
  const tous = useMemo(() => selectionner(prospects, exclus, dejaContactes), [prospects, exclus, dejaContactes]);
  const [choix, setChoix] = useState<Set<string>>(() => new Set(tous.retenus.map((p) => p.id)));
  const [recap, setRecap] = useState(false);
  const { busy, msg, run } = useAction();

  const retenus = tous.retenus.filter((p) => choix.has(p.id));
  const avecRelance = v.relance && relancePossible;
  const plan = planifier(retenus, debut, params.limite_jour, params.heure_debut, avecRelance);
  const exemple = retenus[0] ?? { nom: 'Entreprise Exemple', ville: 'Bagnolet', contact_nom: '', token: '00000000-0000-0000-0000-000000000000' };
  const msg1 = apercu(exemple, params, v.objet, v.corps);
  const msg2 = apercu(exemple, params, v.objet_relance || `Re: ${v.objet}`, v.corps_relance);

  const sauver = async () => {
    const saved = await api.saveCampagne({ ...v, relance: avecRelance, id });
    setId(saved.id);
    return saved;
  };

  const set = <K extends keyof CampagneInput>(k: K, val: CampagneInput[K]) => setV((x) => ({ ...x, [k]: val }));

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-neutral-400 underline" onClick={fermer}>
        ← Retour aux campagnes
      </button>
      <Card>
        <h2 className="text-lg font-bold text-white">1. Message</h2>
        <div className="mt-3 grid gap-3">
          <Field label="Nom de la campagne (interne)" id={f + 'n'}>
            <Input id={f + 'n'} value={v.nom} onChange={(e) => set('nom', e.target.value)} />
          </Field>
          <Field label="Objet" id={f + 'o'}>
            <Input id={f + 'o'} value={v.objet} onChange={(e) => set('objet', e.target.value)} />
          </Field>
          <Field label="Message" id={f + 'c'}>
            <Textarea id={f + 'c'} rows={11} value={v.corps} onChange={(e) => set('corps', e.target.value)} />
          </Field>
          <p className="text-xs text-neutral-500">
            Variables : {VARIABLES.join(' ')} · Ajoutés automatiquement : bouton « Demander une dégustation » et pied de message (identité,
            raison du contact, désinscription gratuite) — non modifiables.
          </p>
          <label className="flex items-center gap-2 text-sm text-neutral-200">
            <input type="checkbox" className="h-5 w-5 accent-[#c9a227]" checked={avecRelance} disabled={!relancePossible} onChange={(e) => set('relance', e.target.checked)} />
            Une relance 5 jours ouvrés plus tard (sauf réponse, refus, désinscription ou adresse rejetée)
          </label>
          {!relancePossible && (
            <p className="rounded-lg bg-amber-950/60 p-2 text-xs text-amber-100">
              Relance automatique indisponible : {params.detection_reponses_ok ? 'désactivée dans les paramètres.' : 'la détection des réponses (lecture de la boîte Gmail) n’est pas connectée. Sans elle, on risquerait de relancer quelqu’un qui a déjà répondu.'}
            </p>
          )}
          {avecRelance && (
            <>
              <Field label="Objet de la relance" id={f + 'or'}>
                <Input id={f + 'or'} value={v.objet_relance} onChange={(e) => set('objet_relance', e.target.value)} />
              </Field>
              <Field label="Message de relance" id={f + 'cr'}>
                <Textarea id={f + 'cr'} rows={8} value={v.corps_relance} onChange={(e) => set('corps_relance', e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-gold-light">Aperçu ({exemple.nom})</summary>
          <p className="mt-2 text-sm font-semibold text-white">Objet : {msg1.objet}</p>
          <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-ink p-3 font-sans text-xs text-neutral-300">{msg1.texte}</pre>
        </details>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline px-4 text-sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await sauver();
                await reload();
                return 'Brouillon enregistré.';
              })
            }
          >
            💾 Enregistrer le brouillon
          </button>
          <button
            type="button"
            className="btn-outline px-4 text-sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await api.envoyerTest({ ...v, etape: 1 });
                await reload();
                return `E-mail de test envoyé à ${r.envoye_a} (votre propre adresse). Vérifiez sa réception et son affichage.`;
              })
            }
          >
            🧪 Envoyer un test
          </button>
          {avecRelance && (
            <button type="button" className="btn-outline px-4 text-sm" disabled={busy} onClick={() => void run(async () => `Relance de test envoyée à ${(await api.envoyerTest({ ...v, etape: 2 })).envoye_a}.`)}>
              🧪 Tester la relance
            </button>
          )}
        </div>
        <Message m={msg} />
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-white">2. Destinataires</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Seuls les prospects avec un e-mail trouvé ou vérifié, jamais contactés et hors liste d’exclusion sont proposés.
        </p>
        {tous.retenus.length ? (
          <>
            <div className="mt-2 flex gap-2 text-xs">
              <button type="button" className="underline" onClick={() => setChoix(new Set(tous.retenus.map((p) => p.id)))}>
                Tout cocher
              </button>
              <button type="button" className="underline" onClick={() => setChoix(new Set())}>
                Tout décocher
              </button>
            </div>
            <ul className="mt-2 max-h-72 divide-y divide-white/5 overflow-y-auto">
              {tous.retenus.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#c9a227]"
                      checked={choix.has(p.id)}
                      onChange={(e) => {
                        const n = new Set(choix);
                        if (e.target.checked) n.add(p.id);
                        else n.delete(p.id);
                        setChoix(n);
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-white">{p.nom}</span> <span className="text-neutral-400">· {p.email}</span>
                    </span>
                    <Badge className={EMAIL_STATUTS[p.email_statut].color}>{EMAIL_STATUTS[p.email_statut].label}</Badge>
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty>Aucun prospect contactable : ajoutez des prospects et leur e-mail public.</Empty>
        )}
        {tous.ecartes.length > 0 && (
          <details className="mt-2 text-xs text-neutral-400">
            <summary className="cursor-pointer">{tous.ecartes.length} prospect(s) écarté(s)</summary>
            <ul className="mt-1 space-y-0.5">
              {tous.ecartes.map(({ prospect, raison }) => (
                <li key={prospect.id}>
                  {prospect.nom} — {raison}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-white">3. Programmation</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Premier jour d’envoi" id={f + 'd'}>
            <Input id={f + 'd'} type="date" min={aujourdhui()} value={debut} onChange={(e) => setDebut(e.target.value)} />
          </Field>
          <p className="self-end text-sm text-neutral-400">
            {params.limite_jour} envois max. par jour, du lundi au vendredi, entre {params.heure_debut} h et {params.heure_fin} h (modifiable dans
            Paramètres).
          </p>
        </div>
        {!params.envoi_operationnel && (
          <p className="mt-3 rounded-lg bg-amber-950/60 p-2 text-sm text-amber-100">
            Programmation bloquée : l’envoi d’e-mails n’est pas encore opérationnel. Connectez Gmail (Paramètres) puis réussissez « Envoyer un
            test ».
          </p>
        )}
        <button type="button" className="btn-gold mt-4" disabled={!retenus.length || !params.envoi_operationnel || busy} onClick={() => setRecap(true)}>
          ✅ Valider et programmer ({retenus.length})
        </button>
      </Card>

      {recap && (
        <div role="dialog" aria-modal="true" aria-labelledby={f + 'rt'} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-gold/40 bg-ink-800 p-5 sm:rounded-2xl">
            <h2 id={f + 'rt'} className="text-xl font-bold text-white">
              Récapitulatif avant lancement
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-400">Destinataires</dt>
                <dd className="font-semibold text-white">{retenus.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-400">Premiers e-mails</dt>
                <dd className="font-semibold text-white">{retenus.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-400">Relances (au maximum)</dt>
                <dd className="font-semibold text-white">{avecRelance ? `${retenus.length} — seulement sans réponse` : 'aucune'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-400">Expéditeur</dt>
                <dd className="text-right font-semibold text-white">
                  {params.expediteur_nom} &lt;{params.expediteur_email}&gt;
                </dd>
              </div>
            </dl>
            <h3 className="mt-4 font-semibold text-white">Calendrier</h3>
            <ul className="mt-1 text-sm text-neutral-300">
              {plan.jours.map((j) => (
                <li key={j.date}>
                  {fmtDate(j.date, true)} : {j.nb} e-mail{j.nb > 1 ? 's' : ''} (à partir de {params.heure_debut} h, étalés)
                </li>
              ))}
              {plan.relances.length > 0 && (
                <li className="text-neutral-400">
                  Relances éventuelles : du {fmtDate(plan.relances[0]!.date)} au {fmtDate(plan.relances.at(-1)!.date)}
                </li>
              )}
            </ul>
            <h3 className="mt-4 font-semibold text-white">Message</h3>
            <p className="mt-1 text-sm text-white">Objet : {msg1.objet}</p>
            <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink p-3 font-sans text-xs text-neutral-300">{msg1.texte}</pre>
            {avecRelance && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-gold-light">Relance</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-ink p-3 font-sans text-xs text-neutral-300">{msg2.texte}</pre>
              </details>
            )}
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-gold-light">Liste des destinataires</summary>
              <ul className="mt-1 text-xs text-neutral-300">
                {retenus.map((p) => (
                  <li key={p.id}>
                    {p.nom} — {p.email}
                  </li>
                ))}
              </ul>
            </details>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setRecap(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-gold"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const saved = await sauver();
                    await api.programmer(saved.id, debut, plan.envois);
                    await reload();
                    setRecap(false);
                    fermer();
                  })
                }
              >
                Confirmer la programmation
              </button>
            </div>
            <Message m={msg} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paramètres
// ---------------------------------------------------------------------------
function ParametresOnglet() {
  const { api, params, reload } = useP();
  const f = useId();
  const [v, setV] = useState(params);
  const { busy, msg, run } = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (v.heure_fin <= v.heure_debut) throw new Error('L’heure de fin doit être après l’heure de début.');
      await api.saveParametres({
        expediteur_nom: v.expediteur_nom.trim(), limite_jour: v.limite_jour, heure_debut: v.heure_debut, heure_fin: v.heure_fin,
        site_url: v.site_url.trim().replace(/\/$/, ''), adresse_postale: v.adresse_postale.trim(), relance_active: v.relance_active,
      });
      await reload();
      return 'Paramètres enregistrés.';
    });
  };
  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de l’expéditeur" id={f + 'n'}>
            <Input id={f + 'n'} required value={v.expediteur_nom} onChange={(e) => setV({ ...v, expediteur_nom: e.target.value })} />
          </Field>
          <Field label="Adresse d’envoi (définie par la connexion Gmail)" id={f + 'e'}>
            <Input id={f + 'e'} value={params.expediteur_email || 'Non connectée'} readOnly disabled />
          </Field>
          <Field label="Adresse du site (liens des e-mails)" id={f + 's'}>
            <Input id={f + 's'} type="url" required placeholder="https://…" value={v.site_url} onChange={(e) => setV({ ...v, site_url: e.target.value })} />
          </Field>
          <Field label="Adresse postale (pied de message)" id={f + 'a'}>
            <Input id={f + 'a'} required value={v.adresse_postale} onChange={(e) => setV({ ...v, adresse_postale: e.target.value })} />
          </Field>
          <Field label="Limite d’envois par jour" id={f + 'l'}>
            <Input id={f + 'l'} type="number" min={1} max={500} required value={v.limite_jour} onChange={(e) => setV({ ...v, limite_jour: Number(e.target.value) })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="De (heure)" id={f + 'hd'}>
              <Input id={f + 'hd'} type="number" min={0} max={23} value={v.heure_debut} onChange={(e) => setV({ ...v, heure_debut: Number(e.target.value) })} />
            </Field>
            <Field label="À (heure)" id={f + 'hf'}>
              <Input id={f + 'hf'} type="number" min={1} max={24} value={v.heure_fin} onChange={(e) => setV({ ...v, heure_fin: Number(e.target.value) })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-200 sm:col-span-2">
            <input type="checkbox" className="h-5 w-5 accent-[#c9a227]" checked={v.relance_active} onChange={(e) => setV({ ...v, relance_active: e.target.checked })} />
            Autoriser la relance automatique (active seulement si la détection des réponses fonctionne)
          </label>
          <button type="submit" className="btn-gold sm:col-span-2" disabled={busy}>
            Enregistrer
          </button>
        </form>
        <p className="mt-3 text-xs text-neutral-500">
          Conseil : commencez à 20–30 envois par jour. Gmail gratuit limite à environ 500 destinataires / jour, Google Workspace à 2 000 ; au-delà
          de quelques dizaines par jour, le risque de finir en spam augmente.
        </p>
      </Card>
      <Card>
        <h2 className="font-semibold text-white">Connexion Gmail</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Vérifie réellement l’accès (envoi et lecture des réponses) avec les clés stockées côté serveur. Rien n’est envoyé.
        </p>
        <button
          type="button"
          className="btn-outline mt-3"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await api.verifierConnexion();
              await reload();
              if (r.erreur) throw new Error(r.erreur);
              return `Compte ${r.adresse} : envoi ${r.envoi ? 'OK' : 'KO'}, lecture des réponses ${r.lecture ? 'OK' : 'KO'}.`;
            })
          }
        >
          🔌 Vérifier la connexion
        </button>
        <Message m={msg} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Liste d’exclusion (définitive)
// ---------------------------------------------------------------------------
function ExclusionsOnglet() {
  const { api, exclusions, reload } = useP();
  const [email, setEmail] = useState('');
  const { busy, msg, run } = useAction();
  return (
    <div className="space-y-3">
      <Card>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.addExclusion(email, 'manuel');
              setEmail('');
              await reload();
              return 'Adresse exclue définitivement.';
            });
          }}
        >
          <Input type="email" required aria-label="Adresse à exclure" placeholder="adresse@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="btn-gold whitespace-nowrap" disabled={busy}>
            Exclure
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          Liste permanente : une adresse exclue ne reçoit plus jamais de message, même si le prospect est réimporté.
        </p>
        <Message m={msg} />
      </Card>
      {exclusions.length ? (
        <Card>
          <ul className="divide-y divide-white/5 text-sm">
            {exclusions.map((x) => (
              <li key={x.email} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-white">{x.email}</span>
                <span className="text-neutral-400">
                  {MOTIFS[x.motif]} · {dateHeure(x.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty>Aucune adresse exclue.</Empty>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
type Onglet = 'recherche' | 'prospects' | 'campagnes' | 'parametres' | 'exclusions';

export default function ProspectionPage() {
  const api = useMemo(getProspectionApi, []);
  const [data, setData] = useState<Omit<Donnees, 'api' | 'reload'> | null>(null);
  const [erreur, setErreur] = useState('');
  const [onglet, setOnglet] = useState<Onglet>('prospects');

  const reload = useCallback(async () => {
    try {
      const [params, prospects, campagnes, envois, exclusions] = await Promise.all([
        api.parametres(), api.listProspects(), api.listCampagnes(), api.listEnvois(), api.listExclusions(),
      ]);
      setData({ params, prospects, campagnes, envois, exclusions });
      setErreur('');
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (erreur)
    return (
      <Card>
        <h1 className="font-display text-2xl font-bold text-white">🎯 Prospection</h1>
        <p className="mt-3 text-neutral-300">{erreur}</p>
        <button type="button" className="btn-outline mt-4" onClick={() => void reload()}>
          Réessayer
        </button>
      </Card>
    );
  if (!data) return <Spinner />;

  const tabs: { id: Onglet; label: string }[] = [
    { id: 'recherche', label: '🔎 Recherche' },
    { id: 'prospects', label: `Prospects (${data.prospects.length})` },
    { id: 'campagnes', label: `Campagnes (${data.campagnes.length})` },
    { id: 'parametres', label: '⚙️ Paramètres' },
    { id: 'exclusions', label: `Exclusions (${data.exclusions.length})` },
  ];

  return (
    <Ctx.Provider value={{ ...data, api, reload }}>
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">🎯 Prospection</h1>
        <EtatConnexions />
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <div className="flex w-max gap-2" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={onglet === t.id}
                onClick={() => setOnglet(t.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${onglet === t.id ? 'border-gold bg-gold text-ink' : 'border-white/15 text-neutral-200 hover:border-gold'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {onglet === 'recherche' && <RechercheOnglet />}
        {onglet === 'prospects' && <ProspectsOnglet />}
        {onglet === 'campagnes' && <CampagnesOnglet />}
        {onglet === 'parametres' && <ParametresOnglet />}
        {onglet === 'exclusions' && <ExclusionsOnglet />}
      </div>
    </Ctx.Provider>
  );
}
