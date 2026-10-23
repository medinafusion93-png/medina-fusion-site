// =====================================================================
//  SUIVIO — Edge Function « assistant »
//  POST { dossier_id } (utilisateur connecté, rôle admin ou gestion)
//  Prépare le résumé, les informations manquantes, la catégorie et un brouillon.
//
//  Secrets : ANTHROPIC_API_KEY (facultatif), ANTHROPIC_MODEL (facultatif).
//  Sans clé, quota atteint, refus ou erreur du modèle : analyse par règles locales,
//  signalée comme telle dans l'interface. Rien n'est envoyé au client ici.
// =====================================================================

import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1';
import { currentUser, env, json, loadDossierForEditor, logEvent, rest, rpc, serve } from '../_shared/http.ts';
import {
  AI_OUTPUT_SCHEMA, analyzeRules, isAiOutput, mergeAnalysis, systemPrompt, userPrompt,
  type Analysis, type CompanyContext, type DossierInput,
} from '../_shared/logic.ts';

const DEFAULT_MODEL = 'claude-opus-5-5';

async function askClaude(d: DossierInput, ctx: CompanyContext): Promise<{ output: unknown; notice: string }> {
  const client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY') });
  // Paramètres passés tels quels : `fallbacks` (repli automatique en cas de refus du modèle)
  // et `output_config.format` (sortie JSON conforme au schéma).
  const params: Record<string, unknown> = {
    model: env('ANTHROPIC_MODEL') || DEFAULT_MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: AI_OUTPUT_SCHEMA } },
    system: systemPrompt(ctx),
    messages: [{ role: 'user', content: userPrompt(d, ctx) }],
  };
  // deno-lint-ignore no-explicit-any
  const res = await client.beta.messages.create(params as any);
  if (res.stop_reason === 'refusal') return { output: null, notice: "L'IA a décliné cette demande : analyse par règles." };
  if (res.stop_reason === 'max_tokens') return { output: null, notice: "Réponse de l'IA incomplète : analyse par règles." };
  const text = res.content.find((b: { type: string }) => b.type === 'text') as { text?: string } | undefined;
  try {
    return { output: JSON.parse(text?.text ?? ''), notice: '' };
  } catch {
    return { output: null, notice: "Réponse de l'IA illisible : analyse par règles." };
  }
}

serve(async (req) => {
  const user = await currentUser(req);
  const { dossier_id } = (await req.json().catch(() => ({}))) as { dossier_id?: string };
  const { d, c, ownerName } = await loadDossierForEditor(String(dossier_id ?? ''), user);

  const input: DossierInput = {
    kind: d.kind === 'entreprise' ? 'entreprise' : 'particulier',
    name: String(d.name ?? ''), company_name: String(d.company_name ?? ''), phone: String(d.phone ?? ''), email: String(d.email ?? ''),
    address: String(d.address ?? ''), postcode: String(d.postcode ?? ''), city: String(d.city ?? ''),
    need: (['installation', 'entretien', 'depannage'].includes(String(d.need)) ? d.need : '') as DossierInput['need'],
    equipment: String(d.equipment ?? ''), brand: String(d.brand ?? ''), description: String(d.description ?? ''), availability: String(d.availability ?? ''),
  };
  const ctx: CompanyContext = { companyName: String(c.name), contactHours: String(c.contact_hours ?? ''), ownerName, zone: String(c.zone ?? '') };
  const rules = analyzeRules(input, ctx);

  let analysis: Analysis = rules;
  let notice = '';
  if (!env('ANTHROPIC_API_KEY')) {
    notice = "IA non configurée : analyse par règles locales.";
  } else if (!(await rpc<boolean>('use_quota', { c: c.id, kind: 'ai' }))) {
    notice = "Volume d'analyses IA du mois atteint : analyse par règles locales.";
  } else {
    try {
      const r = await askClaude(input, ctx);
      notice = r.notice;
      if (r.output && isAiOutput(r.output)) analysis = mergeAnalysis(r.output, rules, ctx);
      else if (r.output) notice = "Réponse de l'IA non conforme : analyse par règles.";
    } catch (e) {
      console.error('assistant', e);
      notice = "IA momentanément indisponible : analyse par règles locales.";
    }
  }

  await rest(`dossiers?id=eq.${d.id}`, {
    method: 'PATCH', token: user.token, prefer: 'return=minimal',
    body: { ai: { ...analysis, notice }, ai_at: new Date().toISOString() },
  });
  await logEvent({
    company_id: String(c.id), dossier_id: String(d.id), type: 'ai',
    text: analysis.source === 'ia' ? "Résumé et brouillon préparés par l'IA" : 'Résumé et brouillon préparés (règles locales)',
  }, user);
  return json({ analysis, notice });
});
