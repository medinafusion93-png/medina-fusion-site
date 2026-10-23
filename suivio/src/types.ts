import type { Analysis, Need } from '../supabase/functions/_shared/logic.ts';

export type Role = 'admin' | 'gestion' | 'lecture';
export type DossierStatus = 'nouvelle' | 'attente_infos' | 'a_chiffrer' | 'devis_envoye' | 'gagne' | 'perdu' | 'clos';
export type QuoteStatus = 'a_preparer' | 'envoye' | 'en_attente' | 'accepte' | 'refuse' | 'expire';
export type StepStatus = 'a_valider' | 'programmee' | 'envoi' | 'envoyee' | 'annulee' | 'echec';
export type SequenceState = 'active' | 'suspendue' | 'arretee' | 'terminee';

export interface Company {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  lang: 'fr' | 'en';
  timezone: string;
  contact_hours: string;
  send_start_hour: number;
  send_end_hour: number;
  send_saturday: boolean;
  zone: string;
  quote_validity_days: number;
  seq_delays: number[];
  seq_templates: string[];
  form_token: string;
  limit_requests: number;
  limit_ai: number;
  limit_emails: number;
}

export interface Membership {
  company_id: string;
  user_id: string;
  role: Role;
  display_name: string;
}

export interface Invitation {
  company_id: string;
  email: string;
  role: Role;
  display_name: string;
}

export interface Template {
  company_id: string;
  key: string;
  name: string;
  subject: string;
  body: string;
}

export interface Dossier {
  id: string;
  company_id: string;
  ref: string;
  created_at: string;
  source: string;
  kind: 'particulier' | 'entreprise';
  name: string;
  company_name: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  city: string;
  need: Need | '';
  equipment: string;
  brand: string;
  description: string;
  availability: string;
  owner_id: string | null;
  status: DossierStatus;
  next_action: string;
  next_action_at: string | null;
  first_response_at: string | null;
  category_confirmed: boolean;
  urgent_ack: boolean;
  ai: (Analysis & { notice?: string }) | null;
  ai_at: string | null;
}

export interface Note {
  id: string;
  dossier_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface Quote {
  id: string;
  company_id: string;
  dossier_id: string;
  ref: string;
  amount_ht: number | null;
  sent_on: string | null;
  due_on: string | null;
  status: QuoteStatus;
  created_at: string;
}

export interface Sequence {
  id: string;
  company_id: string;
  quote_id: string;
  dossier_id: string;
  state: SequenceState;
  stop_reason: string;
  created_at: string;
}

export interface Step {
  id: string;
  sequence_id: string;
  position: number;
  day_offset: number;
  due_at: string;
  template_key: string;
  subject: string;
  body: string;
  status: StepStatus;
  attempts: number;
  last_error: string;
  sent_at: string | null;
}

export interface EventRow {
  id: number;
  dossier_id: string | null;
  at: string;
  type: 'create' | 'sys' | 'ai' | 'out' | 'in' | 'quote' | 'follow' | 'status' | 'note';
  text: string;
  body: string;
  actor_id: string | null;
}

export interface Usage {
  month: string;
  requests: number;
  ai_calls: number;
  emails: number;
}
