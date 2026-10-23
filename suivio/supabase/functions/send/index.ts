// =====================================================================
//  SUIVIO — Edge Function « send »
//  POST { dossier_id, text, mode: 'email' | 'manual' } (rôle admin ou gestion)
//   - email  : envoie la réponse validée par l'utilisateur (Resend)
//   - manual : enregistre une réponse faite par un autre moyen (téléphone, SMS…)
//
//  Secrets : RESEND_API_KEY, EMAIL_FROM (adresse d'un domaine vérifié),
//            INBOUND_DOMAIN (facultatif, pour rattacher les réponses du client).
// =====================================================================

import { currentUser, env, HttpError, json, loadDossierForEditor, logEvent, rest, rpc, sendEmail, serve } from '../_shared/http.ts';
import { nextStatusAfterReply, replyAddress, TO_COMPLETE } from '../_shared/logic.ts';

serve(async (req) => {
  const user = await currentUser(req);
  const body = (await req.json().catch(() => ({}))) as { dossier_id?: string; text?: string; mode?: string };
  const text = String(body.text ?? '').trim();
  const mode = body.mode === 'manual' ? 'manual' : 'email';
  if (!text) throw new HttpError(400, 'Le message est vide');
  if (text.length > 8000) throw new HttpError(400, 'Message trop long');
  if (text.includes(TO_COMPLETE)) throw new HttpError(400, 'Le message contient encore une zone « À compléter »');

  const { d, c } = await loadDossierForEditor(String(body.dossier_id ?? ''), user);
  const companyId = String(c.id);

  if (mode === 'email') {
    const to = String(d.email ?? '');
    if (!to) throw new HttpError(400, "Ce client n'a pas d'adresse e-mail : répondez par téléphone puis enregistrez la réponse");
    if (!(await rpc<boolean>('use_quota', { c: companyId, kind: 'email' }))) throw new HttpError(429, "Volume d'e-mails du mois atteint");
    await sendEmail({
      to, subject: `Votre demande ${d.ref} — ${c.name}`, text, fromName: String(c.name),
      replyTo: replyAddress(String(d.reply_token), env('INBOUND_DOMAIN')) ?? (String(c.email ?? '') || null),
    });
  }

  await logEvent({
    company_id: companyId, dossier_id: String(d.id), type: 'out',
    text: mode === 'email' ? `Réponse envoyée par e-mail à ${d.email}` : 'Réponse enregistrée (faite par téléphone, SMS ou autre)',
    body: text,
  }, user);
  const ai = d.ai as { missing?: unknown[] } | null;
  const missing = Array.isArray(ai?.missing) ? ai.missing.length : 0;
  // le statut et la prochaine action n'évoluent qu'avant le devis
  const early = ['nouvelle', 'attente_infos'].includes(String(d.status));
  await rest(`dossiers?id=eq.${d.id}`, {
    method: 'PATCH', token: user.token, prefer: 'return=minimal',
    body: {
      ...(d.first_response_at ? {} : { first_response_at: new Date().toISOString() }),
      ...(early ? {
        status: nextStatusAfterReply(String(d.status), missing),
        next_action: missing ? 'Attendre les informations du client' : 'Établir le devis et l’associer au dossier',
        next_action_at: new Date(Date.now() + 86400e3).toISOString(),
      } : {}),
    },
  });
  return json({ ok: true });
});
