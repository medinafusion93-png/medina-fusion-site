// =====================================================================
//  SUIVIO — outils communs des Edge Functions (Deno)
//  Accès à la base par l'API REST de Supabase :
//   - avec le jeton de l'utilisateur → la Row Level Security s'applique ;
//   - avec la clé service_role → réservé aux tâches serveur (relances, e-mails entrants).
// =====================================================================

export const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const env = (name: string): string => Deno.env.get(name) ?? '';

const base = () => env('SUPABASE_URL');

interface RestOptions {
  method?: string;
  body?: unknown;
  /** jeton de l'utilisateur ; sans jeton, la clé service_role est utilisée */
  token?: string;
  prefer?: string;
}

export async function rest<T = unknown>(path: string, o: RestOptions = {}): Promise<T> {
  const key = o.token ? env('SUPABASE_ANON_KEY') : env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${base()}/rest/v1/${path}`, {
    method: o.method ?? 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${o.token ?? key}`,
      'Content-Type': 'application/json',
      ...(o.prefer ? { Prefer: o.prefer } : {}),
    },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = (JSON.parse(text) as { message?: string }).message ?? text; } catch { /* texte brut */ }
    throw new HttpError(res.status >= 500 ? 502 : 400, msg.slice(0, 300));
  }
  return (text ? JSON.parse(text) : null) as T;
}

export const rpc = <T = unknown>(name: string, args: Record<string, unknown>, token?: string) =>
  rest<T>(`rpc/${name}`, { method: 'POST', body: args, token });

/** Utilisateur connecté (jeton vérifié par Supabase Auth) */
export async function currentUser(req: Request): Promise<{ id: string; token: string }> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Connexion requise');
  const res = await fetch(`${base()}/auth/v1/user`, { headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new HttpError(401, 'Session expirée, reconnectez-vous');
  const u = (await res.json()) as { id?: string };
  if (!u.id) throw new HttpError(401, 'Session invalide');
  return { id: u.id, token };
}

/** Dossier + entreprise + rôle de l'utilisateur ; refuse si le rôle ne permet pas d'agir */
export async function loadDossierForEditor(dossierId: string, user: { id: string; token: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(dossierId)) throw new HttpError(400, 'Dossier invalide');
  const [d] = await rest<Record<string, unknown>[]>(`dossiers?id=eq.${dossierId}&select=*`, { token: user.token });
  if (!d) throw new HttpError(404, 'Dossier introuvable');
  const companyId = String(d.company_id);
  const [m] = await rest<{ role: string }[]>(`memberships?company_id=eq.${companyId}&user_id=eq.${user.id}&select=role`, { token: user.token });
  if (!m || !['admin', 'gestion'].includes(m.role)) throw new HttpError(403, 'Votre rôle ne permet pas cette action');
  const [c] = await rest<Record<string, unknown>[]>(`companies?id=eq.${companyId}&select=id,name,email,contact_hours,zone`, { token: user.token });
  let ownerName = String(c?.name ?? '');
  if (d.owner_id) {
    const [o] = await rest<{ display_name: string }[]>(`memberships?company_id=eq.${companyId}&user_id=eq.${d.owner_id}&select=display_name`, { token: user.token });
    if (o?.display_name) ownerName = o.display_name;
  }
  return { d, c: c as Record<string, unknown>, ownerName };
}

export async function logEvent(e: { company_id: string; dossier_id: string; type: string; text: string; body?: string }, user: { id: string; token: string }) {
  await rest('events', { method: 'POST', token: user.token, body: { ...e, body: e.body ?? '', actor_id: user.id }, prefer: 'return=minimal' });
}

/** Envoi d'un e-mail via Resend (https://resend.com) */
export async function sendEmail(m: { to: string; subject: string; text: string; fromName: string; replyTo?: string | null }): Promise<void> {
  const key = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM');
  if (!key || !from) throw new HttpError(503, "L'envoi d'e-mails n'est pas configuré (RESEND_API_KEY, EMAIL_FROM)");
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${m.fromName.replace(/[<>"]/g, '')} <${from}>`,
      to: [m.to],
      subject: m.subject,
      text: m.text,
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
    }),
  });
  if (!res.ok) throw new HttpError(502, `Envoi refusé par le fournisseur d'e-mails (${res.status}) : ${(await res.text()).slice(0, 200)}`);
}

/** Enveloppe commune : CORS, méthode, erreurs lisibles */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Erreur serveur, réessayez' }, 500);
    }
  });
}

/** Comparaison en temps constant des secrets partagés */
export function sameSecret(a: string | null, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
