// =====================================================================
//  SUIVIO — Edge Function « followups » (appelée par pg_cron toutes les 15 min)
//  En-tête requis : x-cron-secret = secret CRON_SECRET
//   1. passe en « Expiré » les devis échus (les relances s'arrêtent d'elles-mêmes) ;
//   2. réserve les relances validées arrivées à échéance, dans la fenêtre d'envoi ;
//   3. les envoie ; échec → nouvel essai (3 tentatives maximum).
//  Aucune relance non validée n'est jamais envoyée. La réservation empêche les doublons.
// =====================================================================

import { env, HttpError, json, rpc, sameSecret, sendEmail, serve } from '../_shared/http.ts';
import { replyAddress } from '../_shared/logic.ts';

interface DueStep {
  step_id: string; company_id: string; dossier_id: string; step_position: number; subject: string; body: string;
  to_email: string; company_name: string; company_email: string; reply_token: string;
}

serve(async (req) => {
  if (!sameSecret(req.headers.get('x-cron-secret'), env('CRON_SECRET'))) throw new HttpError(401, 'Accès refusé');
  if (!env('RESEND_API_KEY') || !env('EMAIL_FROM')) throw new HttpError(503, "L'envoi d'e-mails n'est pas configuré : aucune relance réservée");

  const expired = await rpc<number>('expire_quotes', {});
  const due = await rpc<DueStep[]>('claim_due_steps', { p_limit: 50 });
  let sent = 0, failed = 0;
  for (const s of due) {
    try {
      if (!(await rpc<boolean>('use_quota', { c: s.company_id, kind: 'email' }))) throw new Error("Volume d'e-mails du mois atteint");
      await sendEmail({
        to: s.to_email, subject: s.subject || 'Votre devis', text: s.body, fromName: s.company_name,
        replyTo: replyAddress(s.reply_token, env('INBOUND_DOMAIN')) ?? (s.company_email || null),
      });
      await rpc('finish_step', { p_step: s.step_id, p_ok: true, p_error: '' });
      sent++;
    } catch (e) {
      await rpc('finish_step', { p_step: s.step_id, p_ok: false, p_error: e instanceof Error ? e.message : String(e) });
      failed++;
    }
  }
  return json({ expired, sent, failed });
});
