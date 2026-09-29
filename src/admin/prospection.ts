// Module Prospection : types et logique pure (testée dans src/__tests__/prospection.test.ts)
import type { Commande } from './types';

export type EmailStatut = 'a_trouver' | 'trouvee' | 'verifiee' | 'rejetee';
export type ProspectStatut = 'nouveau' | 'contacte' | 'repondu' | 'degustation' | 'devis' | 'client' | 'refus' | 'desinscrit' | 'rejete';
export type CampagneStatut = 'brouillon' | 'programmee' | 'en_pause' | 'terminee';
export type EnvoiStatut = 'planifie' | 'envoye' | 'echec' | 'annule';
export type MotifExclusion = 'desinscription' | 'refus' | 'adresse_rejetee' | 'manuel';

export interface Prospect {
  id: string;
  created_at: string;
  token: string;
  siren: string | null;
  nom: string;
  categorie: string;
  activite: string;
  naf: string;
  effectif: string;
  adresse: string;
  code_postal: string;
  ville: string;
  site: string;
  email: string;
  email_statut: EmailStatut;
  email_source: string;
  telephone: string;
  linkedin_entreprise: string;
  contact_nom: string;
  contact_fonction: string;
  linkedin_contact: string;
  source: string;
  collecte_le: string;
  statut: ProspectStatut;
  notes: string;
  client_id: string | null;
}
export type ProspectInput = Partial<Omit<Prospect, 'id' | 'created_at' | 'token'>> & { id?: string; nom: string };

export interface Campagne {
  id: string;
  created_at: string;
  nom: string;
  statut: CampagneStatut;
  objet: string;
  corps: string;
  relance: boolean;
  objet_relance: string;
  corps_relance: string;
  debut: string | null;
  valide_le: string | null;
}
export type CampagneInput = Omit<Campagne, 'id' | 'created_at' | 'statut' | 'debut' | 'valide_le'> & { id?: string };

export interface Envoi {
  id: string;
  created_at: string;
  campagne_id: string;
  prospect_id: string;
  etape: 1 | 2;
  email: string;
  statut: EnvoiStatut;
  planifie_pour: string;
  envoye_le: string | null;
  repondu_le: string | null;
  erreur: string;
}

export interface Exclusion {
  email: string;
  motif: MotifExclusion;
  created_at: string;
}

export interface Parametres {
  expediteur_nom: string;
  expediteur_email: string;
  limite_jour: number;
  heure_debut: number;
  heure_fin: number;
  site_url: string;
  adresse_postale: string;
  relance_active: boolean;
  // Écrits uniquement par la fonction serveur, après vérification réelle
  envoi_operationnel: boolean;
  detection_reponses_ok: boolean;
  derniere_verification: string | null;
  dernier_passage: string | null;
  derniere_erreur: string;
}
export type ParametresEditables = Pick<
  Parametres,
  'expediteur_nom' | 'limite_jour' | 'heure_debut' | 'heure_fin' | 'site_url' | 'adresse_postale' | 'relance_active'
>;

/** Résultat de l’API Recherche d’entreprises (tel que renvoyé par la fonction serveur) */
export interface ResultatRecherche {
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

export const STATUTS_PROSPECT: { id: ProspectStatut; label: string; color: string }[] = [
  { id: 'nouveau', label: 'Nouveau', color: 'bg-neutral-600 text-white' },
  { id: 'contacte', label: 'Contacté', color: 'bg-sky-600 text-white' },
  { id: 'repondu', label: 'A répondu', color: 'bg-violet-600 text-white' },
  { id: 'degustation', label: 'Dégustation', color: 'bg-amber-500 text-ink' },
  { id: 'devis', label: 'Devis', color: 'bg-orange-500 text-ink' },
  { id: 'client', label: 'Client', color: 'bg-emerald-600 text-white' },
  { id: 'refus', label: 'Refus', color: 'bg-red-800 text-white' },
  { id: 'desinscrit', label: 'Désinscrit', color: 'bg-red-900 text-white' },
  { id: 'rejete', label: 'Adresse rejetée', color: 'bg-red-900 text-white' },
];
export const statutProspect = (s: ProspectStatut) => STATUTS_PROSPECT.find((x) => x.id === s) ?? STATUTS_PROSPECT[0]!;

export const EMAIL_STATUTS: Record<EmailStatut, { label: string; color: string; aide: string }> = {
  a_trouver: { label: 'E-mail à trouver', color: 'bg-neutral-700 text-neutral-200', aide: 'Aucune adresse connue.' },
  trouvee: { label: 'E-mail trouvé', color: 'bg-amber-600 text-ink', aide: 'Adresse publiée sur une source publique, pas encore confirmée.' },
  verifiee: { label: 'E-mail vérifié', color: 'bg-emerald-600 text-white', aide: 'Confirmée par vous ou par une réponse reçue.' },
  rejetee: { label: 'E-mail rejeté', color: 'bg-red-800 text-white', aide: 'Refusée par le serveur de messagerie destinataire.' },
};

export const MOTIFS: Record<MotifExclusion, string> = {
  desinscription: 'Désinscription',
  refus: 'Refus',
  adresse_rejetee: 'Adresse rejetée',
  manuel: 'Ajout manuel',
};

/** Statuts qui arrêtent tout envoi (premier message et relance) */
export const STATUTS_STOP: ProspectStatut[] = ['repondu', 'degustation', 'devis', 'client', 'refus', 'desinscrit', 'rejete'];

/** Catégories (identiques à celles de la fonction serveur) */
export const CATEGORIES: { id: string; label: string }[] = [
  { id: 'entreprises', label: 'Entreprises de services (10 salariés et +)' },
  { id: 'formation', label: 'Organismes de formation' },
  { id: 'associations', label: 'Associations' },
  { id: 'coworking', label: 'Coworking / centres d’affaires' },
];

/** Centres de recherche (coordonnées approximatives du centre-ville, servent seulement de point de départ) */
export const VILLES: { id: string; label: string; lat: number; lon: number }[] = [
  { id: 'bagnolet', label: 'Bagnolet', lat: 48.8693, lon: 2.4181 },
  { id: 'montreuil', label: 'Montreuil', lat: 48.8611, lon: 2.4437 },
  { id: 'romainville', label: 'Romainville', lat: 48.8845, lon: 2.4349 },
  { id: 'les-lilas', label: 'Les Lilas', lat: 48.8799, lon: 2.4190 },
  { id: 'pantin', label: 'Pantin', lat: 48.8944, lon: 2.4094 },
  { id: 'vincennes', label: 'Vincennes', lat: 48.8474, lon: 2.4392 },
  { id: 'paris-20', label: 'Paris 20e', lat: 48.8634, lon: 2.3985 },
  { id: 'paris-11', label: 'Paris 11e', lat: 48.8590, lon: 2.3800 },
  { id: 'paris-19', label: 'Paris 19e', lat: 48.8871, lon: 2.3847 },
  { id: 'paris-12', label: 'Paris 12e', lat: 48.8396, lon: 2.3876 },
];

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
/** Modèle par défaut : court, sans relation antérieure inventée. Le pied de message légal est ajouté par le serveur. */
export const MODELE = {
  objet: 'Dégustation offerte pour {{entreprise}} — traiteur libano-tunisien à Bagnolet',
  corps: [
    'Bonjour,',
    '',
    'Je suis Imad, de Medina Fusion, traiteur libano-tunisien installé à Bagnolet. Nous préparons des plateaux repas et buffets pour les équipes, réunions et événements d’entreprise dans l’Est parisien.',
    '',
    'Je vous propose une dégustation gratuite pour 2 personnes, sur rendez-vous et après confirmation de notre part, pour que vous puissiez goûter avant de nous confier un repas d’équipe.',
    '',
    'Notre carte : {{lien_site}}',
    'Pour demander la dégustation : {{lien_degustation}}',
    '',
    'Bonne journée,',
    '{{expediteur}}',
  ].join('\n'),
  objet_relance: 'Re : Dégustation offerte pour {{entreprise}}',
  corps_relance: [
    'Bonjour,',
    '',
    'Je me permets de revenir vers vous au sujet de la dégustation gratuite pour 2 personnes (sur rendez-vous, après confirmation).',
    '',
    'Si le sujet ne vous concerne pas, il suffit de me le dire et je ne vous écrirai plus.',
    'Pour la demander : {{lien_degustation}}',
    '',
    'Bonne journée,',
    '{{expediteur}}',
  ].join('\n'),
};

export const VARIABLES = ['{{entreprise}}', '{{ville}}', '{{contact}}', '{{lien_site}}', '{{lien_degustation}}', '{{expediteur}}'];

export function remplir(modele: string, v: Record<string, string>): string {
  return modele.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => v[k] ?? '');
}

/** Même pied de message que la fonction serveur (aperçu fidèle) */
export function piedDeMessage(entreprise: string, adresse: string, lienDesinscription: string): string {
  return [
    '—',
    `Vous recevez ce message car ${entreprise || 'votre structure'} est une structure professionnelle proche de Bagnolet, susceptible d’organiser des repas ou événements d’équipe.`,
    `Medina Fusion — ${adresse}.`,
    `Pour ne plus recevoir aucun message de notre part (gratuit, immédiat) : ${lienDesinscription}`,
  ].join('\n');
}

export function apercu(p: Pick<Prospect, 'nom' | 'ville' | 'contact_nom' | 'token'>, params: Pick<Parametres, 'site_url' | 'expediteur_nom' | 'adresse_postale'>, objet: string, corps: string) {
  const site = (params.site_url || 'https://votre-site').replace(/\/$/, '');
  const lienDesinscription = `${site}/desinscription?t=${p.token}`;
  const vars = { entreprise: p.nom, ville: p.ville, contact: p.contact_nom, lien_site: site, lien_degustation: `${site}/?pf=${p.token}#commande`, expediteur: params.expediteur_nom };
  return {
    objet: remplir(objet, vars),
    texte: `${remplir(corps, vars)}\n\n${piedDeMessage(p.nom, params.adresse_postale, lienDesinscription)}`,
  };
}

/** Message LinkedIn à copier (aucun envoi automatique) */
export function messageLinkedIn(p: Pick<Prospect, 'nom' | 'contact_nom'>, site: string, expediteur: string): string {
  const bonjour = p.contact_nom ? `Bonjour ${p.contact_nom.split(' ')[0]},` : 'Bonjour,';
  return [
    bonjour,
    `Je suis Imad, de Medina Fusion, traiteur libano-tunisien à Bagnolet. Nous préparons des plateaux repas et buffets pour les équipes.`,
    `Je propose à ${p.nom} une dégustation gratuite pour 2 personnes, sur rendez-vous. Notre carte : ${site || '(lien du site)'}`,
    `Bonne journée, ${expediteur.split('–')[0]!.trim() || 'Imad'}`,
  ].join('\n');
}

/** Recherches manuelles (liens seulement : aucune extraction automatique) */
export function liensRecherche(p: Pick<Prospect, 'nom' | 'ville'>) {
  const q = `${p.nom} ${p.ville}`.trim();
  return {
    linkedinEntreprise: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(p.nom)}`,
    linkedinPersonnes: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${p.nom} office manager OR assistante de direction OR RH`)}`,
    google: `https://www.google.com/search?q=${encodeURIComponent(`${q} site officiel`)}`,
  };
}

// ---------------------------------------------------------------------------
// Doublons
// ---------------------------------------------------------------------------
export function domaine(url: string): string {
  const u = url.trim().toLowerCase();
  if (!u) return '';
  try {
    return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
const normNom = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(sas|sasu|sarl|sa|eurl|sci|association)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Renvoie le prospect existant qui correspond (SIREN, e-mail, domaine du site ou nom + code postal) */
export function trouverDoublon(
  c: Partial<Pick<Prospect, 'siren' | 'email' | 'site' | 'nom' | 'code_postal' | 'id'>>,
  existants: Prospect[],
): { prospect: Prospect; raison: string } | null {
  const email = (c.email ?? '').trim().toLowerCase();
  const dom = domaine(c.site ?? '');
  const nom = normNom(c.nom ?? '');
  for (const p of existants) {
    if (p.id === c.id) continue;
    if (c.siren && p.siren === c.siren) return { prospect: p, raison: 'même SIREN' };
    if (email && p.email === email) return { prospect: p, raison: 'même e-mail' };
    if (dom && domaine(p.site) === dom) return { prospect: p, raison: 'même site' };
    if (nom && c.code_postal && normNom(p.nom) === nom && p.code_postal === c.code_postal) return { prospect: p, raison: 'même nom et code postal' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sélection des destinataires et calendrier
// ---------------------------------------------------------------------------
export interface Selection {
  retenus: Prospect[];
  ecartes: { prospect: Prospect; raison: string }[];
}

/** Garde les prospects contactables : e-mail trouvé ou vérifié, jamais exclu, jamais déjà contacté, pas de doublon d’adresse */
export function selectionner(candidats: Prospect[], exclusions: Set<string>, dejaContactes: Set<string>): Selection {
  const retenus: Prospect[] = [];
  const ecartes: Selection['ecartes'] = [];
  const vus = new Set<string>();
  for (const p of candidats) {
    const email = p.email.trim().toLowerCase();
    let raison = '';
    if (!email) raison = 'pas d’e-mail';
    else if (p.email_statut === 'rejetee' || p.email_statut === 'a_trouver') raison = EMAIL_STATUTS[p.email_statut].label;
    else if (exclusions.has(email)) raison = 'dans la liste d’exclusion';
    else if (STATUTS_STOP.includes(p.statut)) raison = `statut « ${statutProspect(p.statut).label} »`;
    else if (dejaContactes.has(p.id)) raison = 'déjà contacté';
    else if (vus.has(email)) raison = 'adresse en double';
    if (raison) ecartes.push({ prospect: p, raison });
    else {
      vus.add(email);
      retenus.push(p);
    }
  }
  return { retenus, ecartes };
}

const estOuvre = (d: Date) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5;

/** Jours ouvrés à partir de dateISO (incluse si ouvrée) */
export function joursOuvres(dateISO: string, n: number): string[] {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const out: string[] = [];
  while (out.length < n) {
    if (estOuvre(d)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function ajouterJoursOuvres(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  let reste = n;
  while (reste > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (estOuvre(d)) reste--;
  }
  return d.toISOString().slice(0, 10);
}

/** Heure locale de Paris → instant UTC (gère l’heure d’été) */
export function parisVersUtc(dateISO: string, heure: number): Date {
  const [y, m, j] = dateISO.split('-').map(Number);
  const guess = new Date(Date.UTC(y!, m! - 1, j!, heure));
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23', day: '2-digit' }).formatToParts(guess);
  const hParis = Number(parts.find((p) => p.type === 'hour')!.value);
  const jParis = Number(parts.find((p) => p.type === 'day')!.value);
  const decalage = (hParis - heure + (jParis !== j ? 24 : 0) + 24) % 24;
  return new Date(guess.getTime() - decalage * 3600_000);
}

export interface Planning {
  envois: { prospect_id: string; email: string; planifie_pour: string }[];
  jours: { date: string; nb: number }[];
  relances: { date: string; nb: number }[];
  fin: string | null;
}

/** Répartit les premiers envois sur les jours ouvrés selon la limite quotidienne ; estime les relances (J+5 ouvrés) */
export function planifier(retenus: Prospect[], debutISO: string, limiteJour: number, heureDebut: number, avecRelance: boolean): Planning {
  const limite = Math.max(1, Math.floor(limiteJour));
  const jours = joursOuvres(debutISO, Math.ceil(retenus.length / limite));
  const envois = retenus.map((p, i) => ({
    prospect_id: p.id,
    email: p.email.trim().toLowerCase(),
    planifie_pour: parisVersUtc(jours[Math.floor(i / limite)]!, heureDebut).toISOString(),
  }));
  const parJour = jours.map((date, k) => ({ date, nb: Math.min(limite, retenus.length - k * limite) }));
  const relances = avecRelance ? parJour.map((j) => ({ date: ajouterJoursOuvres(j.date, 5), nb: j.nb })) : [];
  return { envois, jours: parJour, relances, fin: (relances.at(-1) ?? parJour.at(-1))?.date ?? null };
}

// ---------------------------------------------------------------------------
// Statistiques (données réelles uniquement)
// ---------------------------------------------------------------------------
export interface StatsCampagne {
  prospects: number;
  planifies: number;
  envoyes: number;
  relancesEnvoyees: number;
  echecs: number;
  annules: number;
  reponses: number;
  desinscrits: number;
  rejets: number;
  degustations: number;
  devis: number;
  clients: number;
  caHT: number;
}

export function statsCampagne(campagneId: string, envois: Envoi[], prospects: Prospect[], commandes: (Commande & { prospect_id?: string | null })[]): StatsCampagne {
  const es = envois.filter((e) => e.campagne_id === campagneId);
  const ids = new Set(es.map((e) => e.prospect_id));
  const contactes = new Set(es.filter((e) => e.statut === 'envoye').map((e) => e.prospect_id));
  const ps = prospects.filter((p) => ids.has(p.id));
  const cmd = commandes.filter((c) => c.prospect_id && contactes.has(c.prospect_id));
  const ventes = cmd.filter((c) => ['confirmee', 'en_preparation', 'livree'].includes(c.statut));
  return {
    prospects: ids.size,
    planifies: es.filter((e) => e.statut === 'planifie').length,
    envoyes: es.filter((e) => e.statut === 'envoye' && e.etape === 1).length,
    relancesEnvoyees: es.filter((e) => e.statut === 'envoye' && e.etape === 2).length,
    echecs: es.filter((e) => e.statut === 'echec').length,
    annules: es.filter((e) => e.statut === 'annule').length,
    reponses: new Set(es.filter((e) => e.repondu_le).map((e) => e.prospect_id)).size,
    desinscrits: ps.filter((p) => p.statut === 'desinscrit' && contactes.has(p.id)).length,
    rejets: ps.filter((p) => p.statut === 'rejete' && contactes.has(p.id)).length,
    degustations: new Set(cmd.filter((c) => c.type === 'degustation').map((c) => c.prospect_id)).size,
    devis: new Set(cmd.filter((c) => c.statut === 'devis_envoye' || c.numero_devis).map((c) => c.prospect_id)).size,
    clients: new Set(ventes.map((c) => c.prospect_id)).size,
    caHT: Math.round(ventes.reduce((s, c) => s + c.total_ht, 0) * 100) / 100,
  };
}
