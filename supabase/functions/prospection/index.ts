// =====================================================================
//  MEDINA FUSION — Fonction serveur « prospection » (Supabase Edge Function, Deno)
//
//  Actions (POST JSON { action, ... }) :
//   - statut          (admin)  vérifie réellement la connexion Gmail (envoi + lecture des réponses)
//   - recherche       (admin)  recherche d'entreprises via l'API officielle Recherche d'entreprises
//   - extraire_email  (admin)  cherche une adresse publique sur le site officiel du prospect
//   - test            (admin)  envoie UN e-mail de test à l'adresse de l'expéditeur uniquement
//   - tick            (cron)   envois planifiés, relances, détection des réponses et des rejets
//
//  Secrets à définir dans Supabase (Edge Functions → Secrets) :
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, CRON_SECRET
//  (SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.)
//
//  Aucune coordonnée n'est inventée : seules les données renvoyées par les sources sont enregistrées.
// =====================================================================

// ---------------------------------------------------------------------------
// Logique pure (testée par vitest : src/__tests__/prospection-fonction.test.ts)
// ---------------------------------------------------------------------------

export const API_ENTREPRISES = 'https://recherche-entreprises.api.gouv.fr';

/** Catégories ciblées → filtres de l'API Recherche d'entreprises */
export const CATEGORIES: Record<string, { label: string; params: Record<string, string> }> = {
  entreprises: {
    label: 'Entreprises de services (10 salariés et +)',
    params: {
      section_activite_principale: 'J,K,M,N',
      tranche_effectif_salarie: '11,12,21,22,31,32,41,42,51,52,53',
    },
  },
  formation: { label: 'Organismes de formation', params: { activite_principale: '85.59A,85.59B' } },
  associations: { label: 'Associations', params: { nature_juridique: '9220,9221,9222,9230,9240,9260' } },
  coworking: {
    label: 'Coworking / centres d’affaires (codes NAF approchants)',
    params: { activite_principale: '68.20B,82.11Z' },
  },
};

export interface RechercheParams {
  lat: number;
  lon: number;
  rayon: number;
  categorie: string;
  page?: number;
}

export function urlRecherche(p: RechercheParams): string {
  const cat = CATEGORIES[p.categorie];
  if (!cat) throw new Error('Catégorie inconnue');
  const q = new URLSearchParams({
    lat: String(p.lat),
    long: String(p.lon),
    radius: String(Math.min(50, Math.max(0.5, p.rayon))),
    etat_administratif: 'A',
    per_page: '25',
    page: String(Math.max(1, p.page ?? 1)),
    ...cat.params,
  });
  return `${API_ENTREPRISES}/near_point?${q}`;
}

export interface ProspectTrouve {
  siren: string;
  nom: string;
  activite: string;
  naf: string;
  effectif: string;
  adresse: string;
  code_postal: string;
  ville: string;
  dirigeants: string[];
}

const TRANCHES: Record<string, string> = {
  '00': '0 salarié', '01': '1-2', '02': '3-5', '03': '6-9', '11': '10-19', '12': '20-49', '21': '50-99',
  '22': '100-199', '31': '200-249', '32': '250-499', '41': '500-999', '42': '1000-1999', '51': '2000-4999',
  '52': '5000-9999', '53': '10 000+',
};

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

/** Convertit la réponse de l'API sans rien ajouter : seules les valeurs présentes sont reprises */
export function lireResultats(json: unknown): { resultats: ProspectTrouve[]; total: number; pages: number } {
  const j = (json ?? {}) as Json;
  const results = Array.isArray(j.results) ? (j.results as Json[]) : [];
  return {
    total: Number(j.total_results) || 0,
    pages: Number(j.total_pages) || 0,
    resultats: results
      .map((r) => {
        const etab = (Array.isArray(r.matching_etablissements) && (r.matching_etablissements as Json[])[0]) || (r.siege as Json) || {};
        const dirigeants = Array.isArray(r.dirigeants)
          ? (r.dirigeants as Json[])
              .map((d) => [str(d.prenoms), str(d.nom), str(d.denomination)].filter(Boolean).join(' ') + (d.qualite ? ` (${str(d.qualite)})` : ''))
              .filter((x) => x.trim())
              .slice(0, 3)
          : [];
        return {
          siren: str(r.siren),
          nom: str(r.nom_complet) || str(r.nom_raison_sociale),
          activite: str(r.libelle_activite_principale) || str(etab.libelle_activite_principale),
          naf: str(r.activite_principale) || str(etab.activite_principale),
          effectif: TRANCHES[str(r.tranche_effectif_salarie)] ?? '',
          adresse: str(etab.adresse),
          code_postal: str(etab.code_postal),
          ville: str(etab.libelle_commune),
          dirigeants,
        };
      })
      .filter((r) => r.siren && r.nom),
  };
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const FAUX_POSITIFS = /\.(png|jpe?g|gif|svg|webp)$|@(example|exemple|domain|sentry|wixpress)\./i;

/** Adresses présentes dans une page (mailto ou texte), en privilégiant le domaine du site */
export function extraireEmails(html: string, domaineSite: string): string[] {
  const texte = html.replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, '@');
  const vues = new Set<string>();
  for (const m of texte.match(EMAIL_RE) ?? []) {
    const e = m.toLowerCase().replace(/^mailto:/, '');
    if (!FAUX_POSITIFS.test(e)) vues.add(e);
  }
  const dom = domaineSite.replace(/^www\./, '').toLowerCase();
  return [...vues].sort((a, b) => Number(b.endsWith(`@${dom}`) || b.endsWith(`.${dom}`)) - Number(a.endsWith(`@${dom}`) || a.endsWith(`.${dom}`)));
}

/** Respect basique de robots.txt (règles « User-agent: * ») */
export function autoriseParRobots(robots: string, chemin: string): boolean {
  let actif = false;
  const interdits: string[] = [];
  for (const brute of robots.split(/\r?\n/)) {
    const l = brute.split('#')[0]!.trim();
    const [k, ...v] = l.split(':');
    const cle = (k ?? '').trim().toLowerCase();
    const val = v.join(':').trim();
    if (cle === 'user-agent') actif = val === '*';
    else if (actif && cle === 'disallow' && val) interdits.push(val);
  }
  return !interdits.some((d) => chemin.startsWith(d));
}

/** Heure et jour de la semaine à Paris */
export function heureParis(d: Date): { heure: number; jourSemaine: number; date: string } {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const jours = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  return { heure: Number(get('hour')), jourSemaine: jours.indexOf(get('weekday')), date: `${get('year')}-${get('month')}-${get('day')}` };
}

export function dansFenetre(d: Date, debut: number, fin: number): boolean {
  const { heure, jourSemaine } = heureParis(d);
  return jourSemaine >= 1 && jourSemaine <= 5 && heure >= debut && heure < fin;
}

/** Ajoute n jours ouvrés (lundi–vendredi ; jours fériés non gérés) */
export function ajouterJoursOuvres(d: Date, n: number): Date {
  const r = new Date(d);
  let reste = n;
  while (reste > 0) {
    r.setUTCDate(r.getUTCDate() + 1);
    const j = heureParis(r).jourSemaine;
    if (j >= 1 && j <= 5) reste--;
  }
  return r;
}

export interface VarsMessage {
  entreprise: string;
  ville: string;
  contact: string;
  lien_degustation: string;
  lien_site: string;
  lien_traiteur: string;
  expediteur: string;
}

export function remplir(modele: string, v: Partial<VarsMessage>): string {
  return modele.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => str((v as Json)[k]));
}

/** Pied de message obligatoire (identification, raison du contact, opposition gratuite) — non modifiable */
export function piedDeMessage(p: { entreprise: string; adresse: string; lienDesinscription: string }): string {
  return [
    '—',
    `Vous recevez ce message car ${p.entreprise || 'votre structure'} est une structure professionnelle proche de Bagnolet, susceptible d’organiser des repas ou événements d’équipe.`,
    `Medina Fusion — ${p.adresse}.`,
    `Pour ne plus recevoir aucun message de notre part (gratuit, immédiat) : ${p.lienDesinscription}`,
  ].join('\n');
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const b64url = (s: string) => b64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enteteUtf8 = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const echapperHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function versHtml(texte: string, lienDegustation: string): string {
  const lignes = echapperHtml(texte)
    .split('\n')
    .map((l) => l.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>'))
    .join('<br>');
  const bouton = lienDegustation
    ? `<p><a href="${echapperHtml(lienDegustation)}" style="display:inline-block;background:#b7791f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Demander une dégustation</a></p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${lignes}${bouton}</div>`;
}

export interface Mime {
  deNom: string;
  deEmail: string;
  a: string;
  objet: string;
  texte: string;
  html: string;
  lienDesinscription: string;
  enReponseA?: string;
}

export function construireMime(m: Mime): string {
  const frontiere = `mf-${crypto.randomUUID()}`;
  const entetes = [
    `From: ${enteteUtf8(m.deNom)} <${m.deEmail}>`,
    `To: <${m.a}>`,
    `Subject: ${enteteUtf8(m.objet)}`,
    'MIME-Version: 1.0',
    `List-Unsubscribe: <${m.lienDesinscription}>, <mailto:${m.deEmail}?subject=desinscription>`,
    ...(m.enReponseA ? [`In-Reply-To: ${m.enReponseA}`, `References: ${m.enReponseA}`] : []),
    `Content-Type: multipart/alternative; boundary="${frontiere}"`,
  ];
  const partie = (type: string, contenu: string) =>
    [`--${frontiere}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', b64(contenu).replace(/.{76}/g, '$&\r\n')].join('\r\n');
  return b64url([...entetes, '', partie('text/plain', m.texte), partie('text/html', m.html), `--${frontiere}--`, ''].join('\r\n'));
}

// ---------------------------------------------------------------------------
// Accès base de données (PostgREST, clé service_role — jamais exposée au navigateur)
// ---------------------------------------------------------------------------
interface Ctx {
  url: string;
  service: string;
  anon: string;
}

async function rest<T = unknown>(ctx: Ctx, chemin: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ctx.url}/rest/v1/${chemin}`, {
    ...init,
    headers: {
      apikey: ctx.service,
      Authorization: `Bearer ${ctx.service}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  const texte = await res.text();
  if (!res.ok) throw new Error(`Base de données (${res.status}) : ${texte.slice(0, 300)}`);
  return (texte ? JSON.parse(texte) : null) as T;
}

async function estAdmin(ctx: Ctx, authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  const u = await fetch(`${ctx.url}/auth/v1/user`, { headers: { apikey: ctx.anon, Authorization: authHeader } });
  if (!u.ok) return false;
  const { id } = (await u.json()) as { id?: string };
  if (!id) return false;
  const rows = await rest<unknown[]>(ctx, `admins?user_id=eq.${id}&select=user_id`);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Gmail (API officielle Google, OAuth2)
// ---------------------------------------------------------------------------
async function jetonGmail(): Promise<string> {
  const id = Deno.env.get('GOOGLE_CLIENT_ID');
  const secret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refresh = Deno.env.get('GOOGLE_REFRESH_TOKEN');
  if (!id || !secret || !refresh) throw new Error('Gmail non configuré : secrets GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN manquants.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const j = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !j.access_token) throw new Error(`Connexion Gmail refusée : ${j.error_description ?? j.error ?? res.status}`);
  return j.access_token;
}

async function gmail<T>(token: string, chemin: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Gmail (${res.status}) : ${JSON.stringify(j).slice(0, 300)}`);
  return j as T;
}

type Entete = { name: string; value: string };
const entete = (h: Entete[] | undefined, nom: string) => h?.find((x) => x.name.toLowerCase() === nom.toLowerCase())?.value ?? '';

async function verifierGmail(ctx: Ctx) {
  let envoi = false;
  let lecture = false;
  let adresse = '';
  let erreur = '';
  try {
    const token = await jetonGmail();
    const profil = await gmail<{ emailAddress: string }>(token, 'profile');
    adresse = profil.emailAddress.toLowerCase();
    envoi = true; // jeton valide et compte identifié ; l'envoi réel est confirmé par « Envoyer un test »
    await gmail(token, 'messages?maxResults=1');
    lecture = true;
  } catch (e) {
    erreur = (e as Error).message;
  }
  await rest(ctx, 'prospection_parametres?id=eq.1', {
    method: 'PATCH',
    body: JSON.stringify({
      envoi_operationnel: envoi,
      detection_reponses_ok: lecture,
      derniere_verification: new Date().toISOString(),
      derniere_erreur: erreur,
      ...(adresse ? { expediteur_email: adresse } : {}),
    }),
  });
  return { envoi, lecture, adresse, erreur };
}

// ---------------------------------------------------------------------------
interface Parametres {
  expediteur_nom: string;
  expediteur_email: string;
  limite_jour: number;
  heure_debut: number;
  heure_fin: number;
  site_url: string;
  adresse_postale: string;
  relance_active: boolean;
  envoi_operationnel: boolean;
  detection_reponses_ok: boolean;
}
interface ProspectRow {
  id: string;
  token: string;
  nom: string;
  ville: string;
  contact_nom: string;
  email: string;
  statut: string;
  site: string;
}
interface CampagneRow {
  id: string;
  statut: string;
  objet: string;
  corps: string;
  relance: boolean;
  objet_relance: string;
  corps_relance: string;
}
interface EnvoiRow {
  id: string;
  campagne_id: string;
  prospect_id: string;
  etape: number;
  email: string;
  statut: string;
  planifie_pour: string;
  envoye_le: string | null;
  message_id: string | null;
  thread_id: string | null;
}

const STATUTS_STOP = ['repondu', 'refus', 'desinscrit', 'rejete', 'client', 'devis', 'degustation'];

function composer(p: Parametres, pr: ProspectRow, objet: string, corps: string) {
  const site = p.site_url.replace(/\/$/, '');
  const lienDegustation = `${site}/?pf=${pr.token}#commande`;
  const lienDesinscription = `${site}/desinscription?t=${pr.token}`;
  const vars: VarsMessage = {
    entreprise: pr.nom, ville: pr.ville, contact: pr.contact_nom, lien_degustation: lienDegustation, lien_site: site, lien_traiteur: `${site}/#carte`, expediteur: p.expediteur_nom,
  };
  const texte = `${remplir(corps, vars)}\n\n${piedDeMessage({ entreprise: pr.nom, adresse: p.adresse_postale, lienDesinscription })}`;
  return { objet: remplir(objet, vars), texte, html: versHtml(texte, lienDegustation), lienDesinscription };
}

async function envoyer(token: string, p: Parametres, a: string, c: ReturnType<typeof composer>, fil?: { threadId: string; messageId: string }) {
  const raw = construireMime({
    deNom: p.expediteur_nom, deEmail: p.expediteur_email, a, objet: c.objet, texte: c.texte, html: c.html,
    lienDesinscription: c.lienDesinscription, enReponseA: fil?.messageId,
  });
  const envoye = await gmail<{ id: string; threadId: string }>(token, 'messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw, ...(fil ? { threadId: fil.threadId } : {}) }),
  });
  const meta = await gmail<{ payload?: { headers?: Entete[] } }>(token, `messages/${envoye.id}?format=metadata&metadataHeaders=Message-ID`);
  return { threadId: envoye.threadId, messageId: entete(meta.payload?.headers, 'Message-ID') };
}

// ---------------------------------------------------------------------------
async function tick(ctx: Ctx) {
  const [p] = await rest<Parametres[]>(ctx, 'prospection_parametres?id=eq.1');
  if (!p) return { message: 'Paramètres absents' };
  const bilan = { reponses: 0, rejets: 0, envoyes: 0, relancesPlanifiees: 0, erreurs: [] as string[] };
  if (!p.site_url || !p.expediteur_email) return { message: 'Paramètres incomplets (site ou expéditeur) : aucun envoi.' };

  let token: string;
  try {
    token = await jetonGmail();
  } catch (e) {
    await rest(ctx, 'prospection_parametres?id=eq.1', { method: 'PATCH', body: JSON.stringify({ envoi_operationnel: false, detection_reponses_ok: false, derniere_erreur: (e as Error).message, dernier_passage: new Date().toISOString() }) });
    return { message: (e as Error).message };
  }

  // 1) Réponses : tout message du fil qui n'est pas de nous
  const depuis = new Date(Date.now() - 30 * 86400_000).toISOString();
  const aSurveiller = await rest<EnvoiRow[]>(ctx, `envois?statut=eq.envoye&repondu_le=is.null&thread_id=not.is.null&envoye_le=gte.${depuis}&limit=50`);
  for (const e of aSurveiller) {
    try {
      const fil = await gmail<{ messages?: { internalDate: string; payload?: { headers?: Entete[] } }[] }>(token, `threads/${e.thread_id}?format=metadata&metadataHeaders=From`);
      const reponse = (fil.messages ?? []).find(
        (m) => !entete(m.payload?.headers, 'From').toLowerCase().includes(p.expediteur_email) && Number(m.internalDate) > Date.parse(e.envoye_le!),
      );
      if (reponse) {
        bilan.reponses++;
        await rest(ctx, `envois?id=eq.${e.id}`, { method: 'PATCH', body: JSON.stringify({ repondu_le: new Date(Number(reponse.internalDate)).toISOString() }) });
        await rest(ctx, `envois?prospect_id=eq.${e.prospect_id}&statut=eq.planifie`, { method: 'PATCH', body: JSON.stringify({ statut: 'annule', erreur: 'Réponse reçue' }) });
        await rest(ctx, `prospects?id=eq.${e.prospect_id}&statut=in.(nouveau,contacte)`, { method: 'PATCH', body: JSON.stringify({ statut: 'repondu', email_statut: 'verifiee' }) });
      }
    } catch (err) {
      bilan.erreurs.push((err as Error).message);
    }
  }

  // 2) Adresses rejetées (retours « mailer-daemon ») → liste d'exclusion
  try {
    const liste = await gmail<{ messages?: { id: string }[] }>(token, `messages?q=${encodeURIComponent('from:mailer-daemon newer_than:7d')}&maxResults=20`);
    for (const m of liste.messages ?? []) {
      const msg = await gmail<{ payload?: { headers?: Entete[] } }>(token, `messages/${m.id}?format=metadata&metadataHeaders=X-Failed-Recipients`);
      for (const adr of entete(msg.payload?.headers, 'X-Failed-Recipients').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) {
        const connus = await rest<EnvoiRow[]>(ctx, `envois?email=eq.${encodeURIComponent(adr)}&statut=eq.envoye&limit=1`);
        if (!connus.length) continue;
        await rest(ctx, 'prospection_exclusions', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ email: adr, motif: 'adresse_rejetee' }) });
        await rest(ctx, `envois?email=eq.${encodeURIComponent(adr)}&statut=eq.envoye`, { method: 'PATCH', body: JSON.stringify({ erreur: 'Adresse rejetée par le serveur destinataire' }) });
        bilan.rejets++;
      }
    }
  } catch (err) {
    bilan.erreurs.push((err as Error).message);
  }

  // 3) Envois dus, dans la fenêtre horaire et la limite quotidienne
  const maintenant = new Date();
  if (dansFenetre(maintenant, p.heure_debut, p.heure_fin)) {
    const jour = heureParis(maintenant).date;
    const debutJour = new Date(Date.now() - 36 * 3600_000).toISOString();
    const recents = await rest<EnvoiRow[]>(ctx, `envois?statut=eq.envoye&envoye_le=gte.${debutJour}&select=envoye_le`);
    const dejaAujourdhui = recents.filter((r) => r.envoye_le && heureParis(new Date(r.envoye_le)).date === jour).length;
    const quota = Math.max(0, Math.min(10, p.limite_jour - dejaAujourdhui)); // au plus 10 par passage (envois étalés)
    if (quota > 0) {
      const dus = await rest<EnvoiRow[]>(ctx, `envois?statut=eq.planifie&planifie_pour=lte.${maintenant.toISOString()}&order=planifie_pour&limit=${quota * 3}`);
      const campagnes = new Map<string, CampagneRow>();
      for (const e of dus) {
        if (bilan.envoyes >= quota) break;
        let c = campagnes.get(e.campagne_id);
        if (!c) {
          c = (await rest<CampagneRow[]>(ctx, `campagnes?id=eq.${e.campagne_id}`))[0];
          if (c) campagnes.set(c.id, c);
        }
        if (!c || c.statut !== 'programmee') continue; // brouillon, pause ou terminée : on n'envoie pas
        const [pr] = await rest<ProspectRow[]>(ctx, `prospects?id=eq.${e.prospect_id}`);
        const exclu = await rest<unknown[]>(ctx, `prospection_exclusions?email=eq.${encodeURIComponent(e.email)}`);
        if (!pr || exclu.length || STATUTS_STOP.includes(pr.statut)) {
          await rest(ctx, `envois?id=eq.${e.id}`, { method: 'PATCH', body: JSON.stringify({ statut: 'annule', erreur: exclu.length ? 'Adresse exclue' : `Prospect « ${pr?.statut ?? 'supprimé'} »` }) });
          continue;
        }
        let fil: { threadId: string; messageId: string } | undefined;
        if (e.etape === 2) {
          if (!p.relance_active || !p.detection_reponses_ok || !c.relance) {
            await rest(ctx, `envois?id=eq.${e.id}`, { method: 'PATCH', body: JSON.stringify({ statut: 'annule', erreur: 'Relances désactivées ou détection des réponses indisponible' }) });
            continue;
          }
          const [premier] = await rest<EnvoiRow[]>(ctx, `envois?campagne_id=eq.${e.campagne_id}&prospect_id=eq.${e.prospect_id}&etape=eq.1`);
          if (!premier || premier.statut !== 'envoye' || !premier.thread_id) continue;
          fil = { threadId: premier.thread_id, messageId: premier.message_id ?? '' };
        }
        try {
          const msg = composer(p, pr, e.etape === 2 ? c.objet_relance || `Re: ${c.objet}` : c.objet, e.etape === 2 ? c.corps_relance : c.corps);
          const r = await envoyer(token, p, e.email, msg, fil);
          await rest(ctx, `envois?id=eq.${e.id}`, { method: 'PATCH', body: JSON.stringify({ statut: 'envoye', envoye_le: new Date().toISOString(), thread_id: r.threadId, message_id: r.messageId, erreur: '' }) });
          if (pr.statut === 'nouveau') await rest(ctx, `prospects?id=eq.${pr.id}`, { method: 'PATCH', body: JSON.stringify({ statut: 'contacte' }) });
          bilan.envoyes++;
          // Une seule relance, 5 jours ouvrés plus tard — uniquement si la détection des réponses fonctionne
          if (e.etape === 1 && c.relance && p.relance_active && p.detection_reponses_ok && c.corps_relance.trim()) {
            await rest(ctx, 'envois', {
              method: 'POST',
              headers: { Prefer: 'resolution=ignore-duplicates' },
              body: JSON.stringify({ campagne_id: c.id, prospect_id: pr.id, etape: 2, email: e.email, planifie_pour: ajouterJoursOuvres(new Date(), 5).toISOString() }),
            });
            bilan.relancesPlanifiees++;
          }
        } catch (err) {
          await rest(ctx, `envois?id=eq.${e.id}`, { method: 'PATCH', body: JSON.stringify({ statut: 'echec', erreur: (err as Error).message.slice(0, 500) }) });
          bilan.erreurs.push((err as Error).message);
        }
      }
    }
  }

  // 4) Campagnes terminées (plus rien de planifié)
  const actives = await rest<CampagneRow[]>(ctx, 'campagnes?statut=eq.programmee&select=id');
  for (const c of actives) {
    const reste = await rest<unknown[]>(ctx, `envois?campagne_id=eq.${c.id}&statut=eq.planifie&select=id&limit=1`);
    if (!reste.length) await rest(ctx, `campagnes?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify({ statut: 'terminee' }) });
  }

  await rest(ctx, 'prospection_parametres?id=eq.1', {
    method: 'PATCH',
    body: JSON.stringify({ dernier_passage: new Date().toISOString(), derniere_erreur: bilan.erreurs[0] ?? '' }),
  });
  return bilan;
}

// ---------------------------------------------------------------------------
async function extraireEmail(ctx: Ctx, prospectId: string) {
  const [pr] = await rest<ProspectRow[]>(ctx, `prospects?id=eq.${prospectId}`);
  if (!pr) throw new Error('Prospect introuvable');
  if (!pr.site) throw new Error('Renseignez d’abord le site officiel du prospect.');
  const base = new URL(/^https?:\/\//.test(pr.site) ? pr.site : `https://${pr.site}`);
  let robots = '';
  try {
    const r = await fetch(`${base.origin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) robots = await r.text();
  } catch { /* pas de robots.txt */ }
  const pages = ['/', '/contact', '/contact/', '/nous-contacter', '/mentions-legales'].filter((c) => autoriseParRobots(robots, c));
  const trouvees: { email: string; page: string }[] = [];
  for (const chemin of pages) {
    try {
      const url = new URL(chemin, base.origin).toString();
      const r = await fetch(url, { headers: { 'User-Agent': 'MedinaFusion-Prospection/1.0 (contact public uniquement)' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok || !(r.headers.get('content-type') ?? '').includes('text/html')) continue;
      for (const email of extraireEmails(await r.text(), base.hostname)) if (!trouvees.some((t) => t.email === email)) trouvees.push({ email, page: url });
    } catch { /* page indisponible */ }
    if (trouvees.length >= 3) break;
  }
  if (trouvees.length && !pr.email) {
    await rest(ctx, `prospects?id=eq.${pr.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ email: trouvees[0]!.email, email_statut: 'trouvee', email_source: `${trouvees[0]!.page} (collectée le ${new Date().toISOString().slice(0, 10)})` }),
    });
  }
  return { trouvees, pagesConsultees: pages.length };
}

// ---------------------------------------------------------------------------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function traiter(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erreur: 'Méthode non autorisée' }, 405);
  const ctx: Ctx = {
    url: Deno.env.get('SUPABASE_URL') ?? '',
    service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    anon: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  };
  let body: Json = {};
  try {
    body = (await req.json()) as Json;
  } catch { /* corps vide */ }
  const action = str(body.action);

  try {
    if (action === 'tick') {
      const secret = Deno.env.get('CRON_SECRET');
      if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ erreur: 'Non autorisé' }, 401);
      return json(await tick(ctx));
    }
    if (!(await estAdmin(ctx, req.headers.get('Authorization')))) return json({ erreur: 'Réservé à l’administrateur' }, 403);

    if (action === 'statut') return json(await verifierGmail(ctx));

    if (action === 'recherche') {
      const url = urlRecherche({
        lat: Number(body.lat), lon: Number(body.lon), rayon: Number(body.rayon), categorie: str(body.categorie), page: Number(body.page) || 1,
      });
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`API Recherche d’entreprises indisponible (${r.status})`);
      const lu = lireResultats(await r.json());
      const sirens = lu.resultats.map((x) => x.siren);
      const connus = sirens.length ? await rest<{ siren: string }[]>(ctx, `prospects?siren=in.(${sirens.join(',')})&select=siren`) : [];
      return json({ ...lu, dejaEnregistres: connus.map((c) => c.siren), source: 'API Recherche d’entreprises (recherche-entreprises.api.gouv.fr)', url });
    }

    if (action === 'extraire_email') return json(await extraireEmail(ctx, str(body.prospect_id)));

    if (action === 'test') {
      const [p] = await rest<Parametres[]>(ctx, 'prospection_parametres?id=eq.1');
      if (!p?.expediteur_email || !p.site_url) throw new Error('Renseignez l’adresse du site et vérifiez la connexion Gmail.');
      const exemple: ProspectRow = {
        id: '', token: '00000000-0000-0000-0000-000000000000', nom: str(body.entreprise) || 'Entreprise Exemple', ville: str(body.ville) || 'Bagnolet',
        contact_nom: '', email: p.expediteur_email, statut: 'nouveau', site: '',
      };
      const token = await jetonGmail();
      const etape2 = body.etape === 2;
      const msg = composer(p, exemple, `[TEST] ${etape2 ? str(body.objet_relance) || `Re: ${str(body.objet)}` : str(body.objet)}`, etape2 ? str(body.corps_relance) : str(body.corps));
      // Destinataire forcé : l'adresse de l'expéditeur elle-même
      await envoyer(token, p, p.expediteur_email, msg);
      await rest(ctx, 'prospection_parametres?id=eq.1', { method: 'PATCH', body: JSON.stringify({ envoi_operationnel: true, derniere_erreur: '' }) });
      return json({ envoye_a: p.expediteur_email });
    }
    return json({ erreur: 'Action inconnue' }, 400);
  } catch (e) {
    return json({ erreur: (e as Error).message }, 500);
  }
}

declare const Deno: { env: { get(k: string): string | undefined }; serve?: (h: (r: Request) => Promise<Response>) => void };
if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(traiter);
