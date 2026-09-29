import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient } from './api';
import type {
  Campagne, CampagneInput, CampagneStatut, Envoi, Exclusion, MotifExclusion, Parametres, ParametresEditables, Prospect, ProspectInput, ResultatRecherche,
} from './prospection';

export interface Recherche {
  resultats: ResultatRecherche[];
  total: number;
  pages: number;
  dejaEnregistres: string[];
  source: string;
  url: string;
}

/** Accès au module prospection. Les actions « serveur » passent par la fonction Supabase « prospection » (clés protégées côté serveur). */
export interface ProspectionApi {
  /** false en mode démo : aucune action serveur, aucun résultat simulé */
  serveurDisponible: boolean;
  parametres(): Promise<Parametres>;
  saveParametres(p: ParametresEditables): Promise<void>;
  listProspects(): Promise<Prospect[]>;
  saveProspect(p: ProspectInput): Promise<Prospect>;
  deleteProspect(id: string): Promise<void>;
  listCampagnes(): Promise<Campagne[]>;
  saveCampagne(c: CampagneInput): Promise<Campagne>;
  deleteCampagne(id: string): Promise<void>;
  /** Crée les envois planifiés puis passe la campagne en « programmée » */
  programmer(id: string, debut: string, envois: { prospect_id: string; email: string; planifie_pour: string }[]): Promise<void>;
  setStatutCampagne(id: string, statut: CampagneStatut): Promise<void>;
  listEnvois(): Promise<Envoi[]>;
  listExclusions(): Promise<Exclusion[]>;
  addExclusion(email: string, motif: MotifExclusion): Promise<void>;

  // Actions serveur (fonction Edge « prospection »)
  verifierConnexion(): Promise<{ envoi: boolean; lecture: boolean; adresse: string; erreur: string }>;
  rechercher(q: { lat: number; lon: number; rayon: number; categorie: string; page: number }): Promise<Recherche>;
  extraireEmail(prospectId: string): Promise<{ trouvees: { email: string; page: string }[]; pagesConsultees: number }>;
  envoyerTest(c: Pick<CampagneInput, 'objet' | 'corps' | 'objet_relance' | 'corps_relance'> & { etape: 1 | 2 }): Promise<{ envoye_a: string }>;
}

const unwrap = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) {
    if (/relation .* does not exist|Could not find the table/i.test(res.error.message))
      throw new Error('Module prospection non installé : exécutez supabase/prospection.sql dans Supabase.');
    throw new Error(res.error.message);
  }
  return res.data as T;
};

async function appelServeur<T>(sb: SupabaseClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.functions.invoke('prospection', { body });
  if (error) {
    // Message renvoyé par la fonction, sinon fonction non déployée / injoignable
    const ctx = (error as { context?: Response }).context;
    let detail = '';
    try {
      if (ctx && typeof ctx.json === 'function') detail = ((await ctx.json()) as { erreur?: string }).erreur ?? '';
    } catch {
      /* corps illisible */
    }
    if (detail) throw new Error(detail);
    if (ctx?.status === 404 || /Failed to send|FunctionsFetchError|Failed to fetch/i.test(error.message))
      throw new Error('Fonction serveur « prospection » non déployée ou injoignable (voir supabase/README.md, section Prospection).');
    throw new Error(error.message);
  }
  return data as T;
}

function supabaseProspection(sb: SupabaseClient): ProspectionApi {
  return {
    serveurDisponible: true,
    async parametres() {
      return unwrap(await sb.from('prospection_parametres').select('*').eq('id', 1).single()) as Parametres;
    },
    async saveParametres(p) {
      unwrap(await sb.from('prospection_parametres').update(p).eq('id', 1));
    },
    async listProspects() {
      return unwrap(await sb.from('prospects').select('*').order('created_at', { ascending: false })) as Prospect[];
    },
    async saveProspect({ id, ...p }) {
      const q = id ? sb.from('prospects').update(p).eq('id', id) : sb.from('prospects').insert(p);
      return unwrap(await q.select().single()) as Prospect;
    },
    async deleteProspect(id) {
      unwrap(await sb.from('prospects').delete().eq('id', id));
    },
    async listCampagnes() {
      return unwrap(await sb.from('campagnes').select('*').order('created_at', { ascending: false })) as Campagne[];
    },
    async saveCampagne({ id, ...c }) {
      const q = id ? sb.from('campagnes').update(c).eq('id', id) : sb.from('campagnes').insert(c);
      return unwrap(await q.select().single()) as Campagne;
    },
    async deleteCampagne(id) {
      unwrap(await sb.from('campagnes').delete().eq('id', id));
    },
    async programmer(id, debut, envois) {
      if (envois.length) unwrap(await sb.from('envois').insert(envois.map((e) => ({ ...e, campagne_id: id, etape: 1 }))));
      unwrap(await sb.from('campagnes').update({ statut: 'programmee', debut, valide_le: new Date().toISOString() }).eq('id', id));
    },
    async setStatutCampagne(id, statut) {
      unwrap(await sb.from('campagnes').update({ statut }).eq('id', id));
    },
    async listEnvois() {
      return unwrap(await sb.from('envois').select('*').order('planifie_pour', { ascending: false }).limit(5000)) as Envoi[];
    },
    async listExclusions() {
      return unwrap(await sb.from('prospection_exclusions').select('*').order('created_at', { ascending: false })) as Exclusion[];
    },
    async addExclusion(email, motif) {
      unwrap(await sb.from('prospection_exclusions').upsert({ email: email.trim().toLowerCase(), motif }, { onConflict: 'email', ignoreDuplicates: true }));
    },
    verifierConnexion: () => appelServeur(sb, { action: 'statut' }),
    rechercher: (q) => appelServeur(sb, { action: 'recherche', ...q }),
    extraireEmail: (prospect_id) => appelServeur(sb, { action: 'extraire_email', prospect_id }),
    envoyerTest: (c) => appelServeur(sb, { action: 'test', ...c }),
  };
}

// ---------------------------------------------------------------------------
// Mode démo : tables vides en mémoire, aucune action serveur, aucun résultat inventé
// ---------------------------------------------------------------------------
const INDISPONIBLE = 'Mode démo : la fonction serveur n’est pas connectée. Aucun résultat, envoi ou statistique n’est simulé.';

function demoProspection(): ProspectionApi {
  const uid = () => crypto.randomUUID();
  const params: Parametres = {
    expediteur_nom: 'Imad – Medina Fusion', expediteur_email: '', limite_jour: 30, heure_debut: 9, heure_fin: 18, site_url: '',
    adresse_postale: '288 rue Étienne Marcel, 93170 Bagnolet', relance_active: true, envoi_operationnel: false,
    detection_reponses_ok: false, derniere_verification: null, dernier_passage: null, derniere_erreur: '',
  };
  const prospects: Prospect[] = [];
  const campagnes: Campagne[] = [];
  const envois: Envoi[] = [];
  const exclusions: Exclusion[] = [];
  const exclu = (e: string) => exclusions.some((x) => x.email === e);
  return {
    serveurDisponible: false,
    async parametres() {
      return { ...params };
    },
    async saveParametres(p) {
      Object.assign(params, p);
    },
    async listProspects() {
      return prospects.map((p) => ({ ...p }));
    },
    async saveProspect({ id, ...p }) {
      const email = (p.email ?? '').trim().toLowerCase();
      if (id) {
        const k = prospects.findIndex((x) => x.id === id);
        prospects[k] = { ...prospects[k]!, ...p, ...(p.email !== undefined ? { email } : {}) };
        if (email && exclu(email)) prospects[k]!.statut = 'desinscrit';
        return prospects[k]!;
      }
      const n: Prospect = {
        id: uid(), created_at: new Date().toISOString(), token: uid(), siren: null, categorie: '', activite: '', naf: '', effectif: '', adresse: '',
        code_postal: '', ville: '', site: '', email_statut: 'a_trouver', email_source: '', telephone: '', linkedin_entreprise: '', contact_nom: '',
        contact_fonction: '', linkedin_contact: '', source: 'Saisie manuelle', collecte_le: new Date().toISOString(), statut: 'nouveau', notes: '',
        client_id: null, ...p, email,
      };
      if (n.siren && prospects.some((x) => x.siren === n.siren)) throw new Error('Ce SIREN est déjà enregistré.');
      if (email && exclu(email)) n.statut = 'desinscrit';
      prospects.unshift(n);
      return n;
    },
    async deleteProspect(id) {
      prospects.splice(prospects.findIndex((x) => x.id === id), 1);
    },
    async listCampagnes() {
      return campagnes.map((c) => ({ ...c }));
    },
    async saveCampagne({ id, ...c }) {
      if (id) {
        const k = campagnes.findIndex((x) => x.id === id);
        campagnes[k] = { ...campagnes[k]!, ...c };
        return campagnes[k]!;
      }
      const n: Campagne = { ...c, id: uid(), created_at: new Date().toISOString(), statut: 'brouillon', debut: null, valide_le: null };
      campagnes.unshift(n);
      return n;
    },
    async deleteCampagne(id) {
      campagnes.splice(campagnes.findIndex((x) => x.id === id), 1);
    },
    async programmer(id, debut, es) {
      for (const e of es) {
        if (exclu(e.email)) throw new Error(`Adresse exclue : ${e.email}`);
        envois.push({ ...e, id: uid(), created_at: new Date().toISOString(), campagne_id: id, etape: 1, statut: 'planifie', envoye_le: null, repondu_le: null, erreur: '' });
      }
      const c = campagnes.find((x) => x.id === id)!;
      Object.assign(c, { statut: 'programmee', debut, valide_le: new Date().toISOString() });
    },
    async setStatutCampagne(id, statut) {
      campagnes.find((x) => x.id === id)!.statut = statut;
    },
    async listEnvois() {
      return envois.map((e) => ({ ...e }));
    },
    async listExclusions() {
      return exclusions.map((e) => ({ ...e }));
    },
    async addExclusion(email, motif) {
      const e = email.trim().toLowerCase();
      if (exclu(e)) return;
      exclusions.unshift({ email: e, motif, created_at: new Date().toISOString() });
      for (const x of envois) if (x.email === e && x.statut === 'planifie') Object.assign(x, { statut: 'annule', erreur: 'Adresse exclue' });
      for (const p of prospects)
        if (p.email === e) p.statut = motif === 'refus' ? 'refus' : motif === 'adresse_rejetee' ? 'rejete' : 'desinscrit';
    },
    verifierConnexion: () => Promise.reject(new Error(INDISPONIBLE)),
    rechercher: () => Promise.reject(new Error(INDISPONIBLE)),
    extraireEmail: () => Promise.reject(new Error(INDISPONIBLE)),
    envoyerTest: () => Promise.reject(new Error(INDISPONIBLE)),
  };
}

let instance: ProspectionApi | null = null;
export function getProspectionApi(): ProspectionApi {
  if (!instance) {
    const sb = getClient();
    instance = sb ? supabaseProspection(sb) : demoProspection();
  }
  return instance;
}
