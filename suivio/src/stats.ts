import type { Dossier, Quote, Sequence, Step } from './types';
import { inZone } from '../supabase/functions/_shared/logic.ts';

const OPEN = ['envoye', 'en_attente'];

export function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export interface Metrics {
  nouv: number;
  info: number;
  pending: number;
  validate: number;
  accepted: number;
  acceptedAmount: number;
  firstResp: number | null;
  firstRespN: number;
}

export function metrics(dossiers: Dossier[], quotes: Quote[], sequences: Sequence[], steps: Step[], now = Date.now()): Metrics {
  const active = new Set(sequences.filter((s) => s.state === 'active').map((s) => s.id));
  const resp = dossiers
    .filter((d) => d.first_response_at && new Date(d.created_at).getTime() > now - 60 * 86400e3)
    .map((d) => new Date(d.first_response_at!).getTime() - new Date(d.created_at).getTime());
  const acc = quotes.filter((q) => q.status === 'accepte');
  return {
    nouv: dossiers.filter((d) => d.status === 'nouvelle').length,
    info: dossiers.filter((d) => d.status === 'attente_infos').length,
    pending: quotes.filter((q) => OPEN.includes(q.status)).length,
    validate: steps.filter((p) => p.status === 'a_valider' && active.has(p.sequence_id)).length,
    accepted: acc.length,
    acceptedAmount: acc.reduce((s, q) => s + Number(q.amount_ht ?? 0), 0),
    firstResp: median(resp),
    firstRespN: resp.length,
  };
}

export interface Todo { sev: 'crit' | 'warn' | 'blue' | ''; dossier: Dossier; why: string; page?: 'followups' }

export function todos(dossiers: Dossier[], quotes: Quote[], sequences: Sequence[], steps: Step[], zone: string, now = Date.now()): Todo[] {
  const byId = new Map(dossiers.map((d) => [d.id, d]));
  const out: Todo[] = [];
  for (const d of dossiers) {
    const early = ['nouvelle', 'attente_infos'].includes(d.status);
    if (d.ai?.urgent && early && !d.urgent_ack) out.push({ sev: 'crit', dossier: d, why: 'Situation potentiellement urgente : à examiner par un humain' });
    else if (d.ai?.injection && d.status === 'nouvelle') out.push({ sev: 'warn', dossier: d, why: "Message contenant des consignes adressées à l'assistant (ignorées)" });
    else if (!inZone(d.postcode, zone) && !['perdu', 'clos', 'gagne'].includes(d.status)) out.push({ sev: 'warn', dossier: d, why: "Adresse hors zone d'intervention déclarée" });
    else if (d.status === 'nouvelle') out.push({ sev: 'blue', dossier: d, why: d.ai ? 'Nouvelle demande sans réponse' : 'Nouvelle demande : résumé à préparer' });
  }
  for (const s of sequences.filter((x) => x.state === 'active')) {
    const n = steps.filter((p) => p.sequence_id === s.id && p.status === 'a_valider').length;
    const failed = steps.filter((p) => p.sequence_id === s.id && p.status === 'echec').length;
    const d = byId.get(s.dossier_id);
    if (d && n) out.push({ sev: 'warn', dossier: d, why: `${n} relance${n > 1 ? 's' : ''} à valider`, page: 'followups' });
    if (d && failed) out.push({ sev: 'crit', dossier: d, why: `${failed} relance${failed > 1 ? 's' : ''} non envoyée${failed > 1 ? 's' : ''} (échec)`, page: 'followups' });
  }
  for (const q of quotes) {
    const d = byId.get(q.dossier_id);
    if (!d) continue;
    const left = q.due_on ? Math.ceil((new Date(`${q.due_on}T23:59:59`).getTime() - now) / 86400e3) : null;
    if (q.status === 'expire' && d.status === 'devis_envoye') out.push({ sev: '', dossier: d, why: `Devis ${q.ref} expiré sans décision` });
    else if (OPEN.includes(q.status) && left !== null && left <= 7) out.push({ sev: '', dossier: d, why: `Devis ${q.ref} : échéance dans ${left} j` });
    else if (q.status === 'a_preparer') out.push({ sev: '', dossier: d, why: `Devis ${q.ref} à préparer` });
  }
  const order = { crit: 0, warn: 1, blue: 2, '': 3 };
  return out.sort((a, b) => order[a.sev] - order[b.sev]);
}
