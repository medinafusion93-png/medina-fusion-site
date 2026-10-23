// =====================================================================
//  SUIVIO — Edge Function « inbound » : réponse d'un client reçue par e-mail
//  En-tête requis : x-inbound-secret = secret INBOUND_SECRET
//  Corps JSON : { to: string | string[], from: string, text: string }
//  À brancher sur la réception d'e-mails de votre fournisseur (ou un scénario n8n
//  qui reçoit les e-mails de reply+…@INBOUND_DOMAIN et appelle cette URL).
//  Effet : l'e-mail rejoint l'historique du dossier et ses relances s'arrêtent.
// =====================================================================

import { env, HttpError, json, rpc, sameSecret, serve } from '../_shared/http.ts';
import { bareEmail, stripQuoted, tokenFromRecipients } from '../_shared/logic.ts';

serve(async (req) => {
  if (!sameSecret(req.headers.get('x-inbound-secret'), env('INBOUND_SECRET'))) throw new HttpError(401, 'Accès refusé');
  const b = (await req.json().catch(() => ({}))) as { to?: string | string[]; from?: string; text?: string };
  const dossier = await rpc<string | null>('record_inbound', {
    p_token: tokenFromRecipients(b.to ?? ''),
    p_from: bareEmail(String(b.from ?? '')),
    p_text: stripQuoted(String(b.text ?? '')),
  });
  return json({ matched: !!dossier });
});
