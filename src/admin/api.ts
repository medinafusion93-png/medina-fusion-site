import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../data/config';
import type { Client, ClientInput, Commande, CommandeInput } from './types';

/** Accès aux données de l’espace admin (Supabase en production, mémoire en mode démo) */
export interface AdminApi {
  demo: boolean;
  getSessionEmail(): Promise<string | null>;
  onAuthChange(cb: (email: string | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  isAdmin(): Promise<boolean>;

  listClients(): Promise<Client[]>;
  saveClient(c: ClientInput): Promise<Client>;
  deleteClient(id: string): Promise<void>;

  listCommandes(): Promise<Commande[]>;
  saveCommande(c: CommandeInput): Promise<Commande>;
  deleteCommande(id: string): Promise<void>;
  prochainNumero(type: 'devis' | 'facture'): Promise<string>;
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/** Postgres renvoie les numeric en texte : on normalise */
function fixCommande(r: Record<string, unknown>): Commande {
  const c = r as unknown as Commande;
  return {
    ...c,
    total_ht: num(c.total_ht),
    tva_taux: num(c.tva_taux),
    montant_encaisse: num(c.montant_encaisse),
    lignes: Array.isArray(c.lignes)
      ? c.lignes.map((l) => ({ nom: String(l.nom ?? ''), quantite: num(l.quantite), prix_unitaire: num(l.prix_unitaire) }))
      : [],
  };
}

const traduire = (msg: string) => {
  if (/Invalid login credentials/i.test(msg)) return 'Email ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(msg)) return 'Adresse email non confirmée.';
  if (/duplicate key.*clients_email_unique/i.test(msg)) return 'Un client existe déjà avec cet email.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Connexion impossible. Vérifiez votre réseau.';
  return msg;
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(traduire(res.error.message));
  return res.data as T;
}

function supabaseApi(sb: SupabaseClient): AdminApi {
  return {
    demo: false,
    async getSessionEmail() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.email ?? null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user.email ?? null));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(traduire(error.message));
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin` });
      if (error) throw new Error(traduire(error.message));
    },
    async isAdmin() {
      const { data, error } = await sb.from('admins').select('user_id').limit(1);
      return !error && (data?.length ?? 0) > 0;
    },
    async listClients() {
      return unwrap(await sb.from('clients').select('*').order('created_at', { ascending: false }));
    },
    async saveClient({ id, ...c }) {
      const q = id ? sb.from('clients').update(c).eq('id', id) : sb.from('clients').insert(c);
      return unwrap(await q.select().single());
    },
    async deleteClient(id) {
      unwrap(await sb.from('clients').delete().eq('id', id));
    },
    async listCommandes() {
      const rows = unwrap(await sb.from('commandes').select('*').order('date_prestation', { ascending: false, nullsFirst: true }));
      return (rows as Record<string, unknown>[]).map(fixCommande);
    },
    async saveCommande({ id, ...c }) {
      const q = id ? sb.from('commandes').update(c).eq('id', id) : sb.from('commandes').insert(c);
      return fixCommande(unwrap(await q.select().single()));
    },
    async deleteCommande(id) {
      unwrap(await sb.from('commandes').delete().eq('id', id));
    },
    async prochainNumero(type) {
      return unwrap(await sb.rpc('prochain_numero', { p_type: type })) as string;
    },
  };
}

// ---------------------------------------------------------------------------
// Mode démo : données fictives en mémoire, rien n’est enregistré
// ---------------------------------------------------------------------------
function demoApi(): AdminApi {
  const uid = () => Math.random().toString(36).slice(2, 10);
  const now = new Date();
  const d = (offset: number) => {
    const x = new Date(now);
    x.setDate(now.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  const clients: Client[] = [
    { id: 'c1', created_at: d(-40), nom: 'Sarah Martin', entreprise: 'Atelier Graphique', telephone: '06 11 22 33 44', email: 'sarah@atelier.fr', adresse: '12 rue de Paris, 93100 Montreuil', notes: 'Préfère les livraisons avant 12 h.' },
    { id: 'c2', created_at: d(-20), nom: 'Karim B.', entreprise: 'Tech Bagnolet', telephone: '07 55 44 33 22', email: 'karim@techbagnolet.fr', adresse: '3 av. Gambetta, 93170 Bagnolet', notes: '' },
    { id: 'c3', created_at: d(-2), nom: 'Julie Petit', entreprise: 'Cabinet Petit & Associés', telephone: '01 43 00 00 00', email: 'julie@petit-associes.fr', adresse: '8 bd de Charonne, 75020 Paris', notes: '' },
  ];
  const cmd = (c: Partial<Commande>): Commande => ({
    id: uid(), created_at: d(-5), updated_at: d(-1), client_id: null, source: 'admin', type: 'commande',
    statut: 'demande', paiement_statut: 'en_attente', montant_encaisse: 0, date_prestation: d(3), heure: '12:30',
    nb_personnes: null, mode: 'livraison', adresse: '', lignes: [], total_ht: 0, tva_taux: 0.1, allergies: '',
    notes: '', parrain: '', numero_devis: null, numero_facture: null, ...c,
  });
  const commandes: Commande[] = [
    cmd({ client_id: 'c1', statut: 'confirmee', paiement_statut: 'acompte', montant_encaisse: 100, date_prestation: d(0), nb_personnes: 12, adresse: clients[0]!.adresse, lignes: [{ nom: 'Plateau Signature — beignets légumes', quantite: 12, prix_unitaire: 15.9 }, { nom: 'Citronnade maison', quantite: 12, prix_unitaire: 4 }], total_ht: 238.8, allergies: '1 personne sans gluten', numero_devis: 'D-2026-0003' }),
    cmd({ client_id: 'c2', source: 'site', statut: 'demande', date_prestation: d(2), nb_personnes: 20, adresse: clients[1]!.adresse, lignes: [{ nom: 'Plateau Shawarma — Poulet', quantite: 10, prix_unitaire: 15.9 }, { nom: 'Plateau Shawarma — Viande', quantite: 10, prix_unitaire: 15.9 }], total_ht: 318 }),
    cmd({ client_id: 'c3', statut: 'devis_envoye', date_prestation: d(6), heure: '19:00', nb_personnes: 30, lignes: [{ nom: 'Buffet Standard (par pers.)', quantite: 30, prix_unitaire: 35 }], total_ht: 1050, numero_devis: 'D-2026-0004' }),
    cmd({ client_id: 'c1', statut: 'livree', paiement_statut: 'paye', montant_encaisse: 145.2, date_prestation: d(-9), nb_personnes: 10, lignes: [{ nom: 'Formule Sandwich', quantite: 10, prix_unitaire: 13 }, { nom: 'Houmous', quantite: 2, prix_unitaire: 6 }], total_ht: 132, numero_devis: 'D-2026-0001', numero_facture: 'F-2026-0001' }),
    cmd({ client_id: 'c2', statut: 'annulee', date_prestation: d(-3), lignes: [{ nom: 'Formule Brunch (par pers.)', quantite: 8, prix_unitaire: 15 }], total_ht: 120 }),
    cmd({ client_id: 'c3', source: 'site', type: 'degustation', statut: 'demande', date_prestation: null, heure: '' }),
  ];
  const compteurs = { devis: 4, facture: 1 };
  let email: string | null = null;
  const listeners = new Set<(e: string | null) => void>();
  const emit = () => listeners.forEach((l) => l(email));
  const wait = () => new Promise((r) => setTimeout(r, 120));

  return {
    demo: true,
    async getSessionEmail() {
      return email;
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signIn(e) {
      await wait();
      email = e || 'demo@medina-fusion.fr';
      emit();
    },
    async signOut() {
      email = null;
      emit();
    },
    async resetPassword() {},
    async isAdmin() {
      return true;
    },
    async listClients() {
      await wait();
      return [...clients];
    },
    async saveClient({ id, ...c }) {
      await wait();
      if (c.email && clients.some((x) => x.id !== id && x.email.toLowerCase() === c.email.toLowerCase()))
        throw new Error('Un client existe déjà avec cet email.');
      if (id) {
        const i = clients.findIndex((x) => x.id === id);
        clients[i] = { ...clients[i]!, ...c };
        return clients[i]!;
      }
      const nc: Client = { ...c, id: uid(), created_at: new Date().toISOString() };
      clients.unshift(nc);
      return nc;
    },
    async deleteClient(id) {
      clients.splice(clients.findIndex((x) => x.id === id), 1);
      commandes.forEach((c) => c.client_id === id && (c.client_id = null));
    },
    async listCommandes() {
      await wait();
      return commandes.map((c) => ({ ...c, lignes: [...c.lignes] }));
    },
    async saveCommande({ id, ...c }) {
      await wait();
      if (id) {
        const i = commandes.findIndex((x) => x.id === id);
        commandes[i] = { ...commandes[i]!, ...c, updated_at: new Date().toISOString() };
        return commandes[i]!;
      }
      const nc: Commande = { ...c, id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      commandes.unshift(nc);
      return nc;
    },
    async deleteCommande(id) {
      commandes.splice(commandes.findIndex((x) => x.id === id), 1);
    },
    async prochainNumero(type) {
      compteurs[type] += 1;
      return `${type === 'devis' ? 'D' : 'F'}-${now.getFullYear()}-${String(compteurs[type]).padStart(4, '0')}`;
    },
  };
}

let instance: AdminApi | null = null;

export function getApi(): AdminApi {
  if (!instance) {
    instance =
      SUPABASE.url && SUPABASE.anonKey
        ? supabaseApi(createClient(SUPABASE.url, SUPABASE.anonKey, { auth: { persistSession: true, autoRefreshToken: true } }))
        : demoApi();
  }
  return instance;
}
