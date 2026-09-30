/** Coordonnées, liens et configuration — source unique pour tout le site. */

const env = import.meta.env;

export const CONTACT = {
  nom: 'MEDINA FUSION',
  email: 'Medina.fusion93@gmail.com',
  whatsappAffiche: '06 62 28 68 43',
  whatsappIntl: '33662286843',
  adresse: '288 rue Étienne Marcel, 93170 Bagnolet',
  /** Identité légale (extrait Kbis) */
  formeJuridique: 'SAS à associé unique',
  capital: '1 000 €',
  siren: '948 772 264',
  rcs: 'RCS Bobigny 948 772 264',
  presidente: 'Marwa Saidi (Ben Hamed)',
  tvaIntra: 'FR20948772264',
  instagram: 'medina_fusion',
  instagramUrl: 'https://www.instagram.com/medina_fusion/',
  instagramAbonnes: '32,9 K',
  googleAvisUrl: 'https://share.google/HVEHFzjLZ2GRYmoaY',
  googleNote: '4,8',
  googleAvis: '700+',
  minPersonnesLivraison: 6,
  /** Délai minimum entre la commande et la livraison (en jours) */
  delaiMinJours: 2,
} as const;

/** Les prix du catalogue sont HT ; TVA restauration/traiteur à 10 % */
export const TVA_RATE = 0.1;

export const ASSETS = {
  banner: '/banner.jpg',
  logo: '/logo.png',
} as const;

const commandeUrl = (env.VITE_WEBHOOK_COMMANDE_URL ?? '').trim();
const degustationUrl = (env.VITE_WEBHOOK_DEGUSTATION_URL ?? '').trim();
const timeout = Number(env.VITE_WEBHOOK_TIMEOUT_MS);

export const WEBHOOKS = {
  commande: commandeUrl,
  /** Workflow séparé si défini, sinon même webhook que la commande (type: "degustation") */
  degustation: degustationUrl || commandeUrl,
  timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 10_000,
} as const;

/**
 * Base de données de l’espace admin. La clé « anon » est publique par conception :
 * la sécurité est assurée côté serveur (Row Level Security, voir supabase/schema.sql).
 * Sans ces variables, /admin s’ouvre en mode démo et le site n’enregistre pas les demandes.
 */
export const SUPABASE = {
  url: (env.VITE_SUPABASE_URL || 'https://cnyjdpzazuekzwjwhzkc.supabase.co').replace(/[^\x21-\x7e]/g, '').replace(/\/$/, ''),
  // Retire espaces et caractères invisibles/non ASCII glissés au copier-coller
  anonKey: (env.VITE_SUPABASE_ANON_KEY ?? '').replace(/[^\x21-\x7e]/g, ''),
} as const;

/** Hébergeur du site (mentions légales) — à modifier en cas de changement d’hébergement */
export const HEBERGEUR = {
  nom: 'Netlify, Inc.',
  adresse: '101 2nd Street, San Francisco, CA 94105, États-Unis',
  site: 'https://www.netlify.com',
} as const;
