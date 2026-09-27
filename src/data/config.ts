/** Coordonnées, liens et configuration — source unique pour tout le site. */

const env = import.meta.env;

export const CONTACT = {
  nom: 'MEDINA FUSION',
  email: 'Medina.fusion93@gmail.com',
  whatsappAffiche: '06 62 28 68 43',
  whatsappIntl: '33662286843',
  adresse: '288 rue Étienne Marcel, 93170 Bagnolet',
  siret: '948 772 264 0001',
  googleAvisUrl: 'https://share.google/HVEHFzjLZ2GRYmoaY',
  googleNote: '4,8',
  googleAvis: '700+',
  minPersonnesLivraison: 6,
} as const;

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
