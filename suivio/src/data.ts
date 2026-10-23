import { must, supabase } from './supabase';
import type { Dossier, EventRow, Note, Quote, Sequence, Step, Template } from './types';

export async function loadOverview(companyId: string) {
  const [dossiers, quotes, sequences] = await Promise.all([
    supabase.from('dossiers').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(2000),
    supabase.from('quotes').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('sequences').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
  ]);
  const seqs = must(sequences) as Sequence[];
  const steps = seqs.length
    ? (must(await supabase.from('sequence_steps').select('*').eq('company_id', companyId).order('position')) as Step[])
    : [];
  return { dossiers: must(dossiers) as Dossier[], quotes: must(quotes) as Quote[], sequences: seqs, steps };
}

export async function loadDossier(id: string) {
  const [d, events, notes, quotes, sequences] = await Promise.all([
    supabase.from('dossiers').select('*').eq('id', id).maybeSingle(),
    supabase.from('events').select('*').eq('dossier_id', id).order('at', { ascending: false }).order('id', { ascending: false }),
    supabase.from('notes').select('*').eq('dossier_id', id).order('created_at'),
    supabase.from('quotes').select('*').eq('dossier_id', id).order('created_at', { ascending: false }),
    supabase.from('sequences').select('*').eq('dossier_id', id).order('created_at', { ascending: false }),
  ]);
  const seqs = must(sequences) as Sequence[];
  const steps = seqs.length
    ? (must(await supabase.from('sequence_steps').select('*').in('sequence_id', seqs.map((s) => s.id)).order('position')) as Step[])
    : [];
  return {
    dossier: must(d) as Dossier | null, events: must(events) as EventRow[], notes: must(notes) as Note[],
    quotes: must(quotes) as Quote[], sequences: seqs, steps,
  };
}

export async function loadTemplates(companyId: string) {
  return must(await supabase.from('templates').select('*').eq('company_id', companyId).order('key')) as Template[];
}

export async function logEvent(companyId: string, dossierId: string, userId: string, type: EventRow['type'], text: string, body = '') {
  must(await supabase.from('events').insert({ company_id: companyId, dossier_id: dossierId, actor_id: userId, type, text, body }));
}
