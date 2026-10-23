-- =====================================================================
--  SUIVIO — schéma Supabase (MVP clients pilotes)
--
--  Multi-entreprises : chaque ligne porte company_id, et la Row Level Security
--  limite chaque utilisateur aux entreprises dont il est membre.
--  Rôles : admin (tout), gestion (dossiers, devis, relances), lecture (consultation).
--
--  À exécuter dans Supabase → SQL Editor. Ré-exécutable sans erreur.
--  Vérifié par : npm run test:sql (PGlite)
-- =====================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  lang text not null default 'fr' check (lang in ('fr', 'en')),
  timezone text not null default 'Europe/Paris',
  contact_hours text not null default 'Lun–ven 8h00–18h00',
  -- fenêtre d'envoi des relances (heure locale de l'entreprise)
  send_start_hour int not null default 8 check (send_start_hour between 0 and 23),
  send_end_hour int not null default 19 check (send_end_hour between 1 and 24),
  send_saturday boolean not null default false,
  zone text not null default '',
  quote_validity_days int not null default 30 check (quote_validity_days between 1 and 365),
  seq_delays int[] not null default '{3,7,14}',
  seq_templates text[] not null default '{relance_1,relance_2,relance_3}',
  form_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- volumes inclus (contrôle des coûts)
  limit_requests int not null default 300,
  limit_ai int not null default 900,
  limit_emails int not null default 1000,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('admin', 'gestion', 'lecture')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table if not exists invitations (
  company_id uuid not null references companies (id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  role text not null check (role in ('admin', 'gestion', 'lecture')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (company_id, email)
);

create table if not exists templates (
  company_id uuid not null references companies (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  subject text not null default '',
  body text not null check (length(body) <= 5000),
  primary key (company_id, key)
);

create table if not exists dossiers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  ref_num int not null,
  ref text not null,
  created_at timestamptz not null default now(),
  source text not null default 'Formulaire web',
  kind text not null default 'particulier' check (kind in ('particulier', 'entreprise')),
  name text not null check (length(name) between 1 and 120),
  company_name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  postcode text not null default '',
  city text not null default '',
  need text not null default '' check (need in ('', 'installation', 'entretien', 'depannage')),
  equipment text not null default '',
  brand text not null default '',
  description text not null default '' check (length(description) <= 4000),
  availability text not null default '',
  owner_id uuid,
  status text not null default 'nouvelle'
    check (status in ('nouvelle', 'attente_infos', 'a_chiffrer', 'devis_envoye', 'gagne', 'perdu', 'clos')),
  next_action text not null default '',
  next_action_at timestamptz,
  first_response_at timestamptz,
  category_confirmed boolean not null default false,
  urgent_ack boolean not null default false,
  ai jsonb,
  ai_at timestamptz,
  -- jeton placé dans l'adresse de réponse des e-mails (reply+<jeton>@domaine)
  reply_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  unique (company_id, ref_num)
);
create index if not exists dossiers_company_status on dossiers (company_id, status);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  dossier_id uuid not null references dossiers (id) on delete cascade,
  author_id uuid,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  dossier_id uuid not null references dossiers (id) on delete cascade,
  ref text not null check (length(ref) between 1 and 60),
  amount_ht numeric(12, 2) check (amount_ht is null or amount_ht >= 0),
  sent_on date,
  due_on date,
  status text not null default 'a_preparer'
    check (status in ('a_preparer', 'envoye', 'en_attente', 'accepte', 'refuse', 'expire')),
  created_at timestamptz not null default now(),
  unique (company_id, ref)
);

create table if not exists sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  quote_id uuid not null references quotes (id) on delete cascade,
  dossier_id uuid not null references dossiers (id) on delete cascade,
  state text not null default 'active' check (state in ('active', 'suspendue', 'arretee', 'terminee')),
  stop_reason text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);
-- Anti-doublon : une seule séquence en cours par devis
create unique index if not exists sequences_one_open_per_quote on sequences (quote_id)
  where state in ('active', 'suspendue');

create table if not exists sequence_steps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  sequence_id uuid not null references sequences (id) on delete cascade,
  position int not null,
  day_offset int not null,
  due_at timestamptz not null,
  template_key text not null,
  subject text not null default '',
  body text not null,
  status text not null default 'a_valider'
    check (status in ('a_valider', 'programmee', 'envoi', 'envoyee', 'annulee', 'echec')),
  attempts int not null default 0,
  last_error text not null default '',
  validated_by uuid,
  sent_at timestamptz,
  unique (sequence_id, position)
);
create index if not exists steps_due on sequence_steps (status, due_at);

create table if not exists events (
  id bigint generated always as identity primary key,
  company_id uuid not null references companies (id) on delete cascade,
  dossier_id uuid references dossiers (id) on delete cascade,
  at timestamptz not null default now(),
  type text not null check (type in ('create', 'sys', 'ai', 'out', 'in', 'quote', 'follow', 'status', 'note')),
  text text not null,
  body text not null default '',
  actor_id uuid
);
create index if not exists events_dossier on events (dossier_id, at);

create table if not exists usage_monthly (
  company_id uuid not null references companies (id) on delete cascade,
  month date not null,
  requests int not null default 0,
  ai_calls int not null default 0,
  emails int not null default 0,
  primary key (company_id, month)
);

-- ---------------------------------------------------------------------------
-- Droits : fonctions d'appartenance
-- ---------------------------------------------------------------------------

create or replace function my_role(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from memberships where company_id = c and user_id = auth.uid()
$$;

create or replace function is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where company_id = c and user_id = auth.uid())
$$;

create or replace function can_edit(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where company_id = c and user_id = auth.uid() and role in ('admin', 'gestion'))
$$;

create or replace function is_admin(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where company_id = c and user_id = auth.uid() and role = 'admin')
$$;

-- Vrai pour les connexions des utilisateurs (pas pour le serveur / service_role)
create or replace function is_end_user() returns boolean
language sql stable as $$ select current_user in ('anon', 'authenticated') $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table companies enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;
alter table templates enable row level security;
alter table dossiers enable row level security;
alter table notes enable row level security;
alter table quotes enable row level security;
alter table sequences enable row level security;
alter table sequence_steps enable row level security;
alter table events enable row level security;
alter table usage_monthly enable row level security;

drop policy if exists companies_select on companies;
create policy companies_select on companies for select using (is_member(id));
drop policy if exists companies_update on companies;
create policy companies_update on companies for update using (is_admin(id)) with check (is_admin(id));

drop policy if exists memberships_select on memberships;
create policy memberships_select on memberships for select using (is_member(company_id));
drop policy if exists memberships_update on memberships;
create policy memberships_update on memberships for update using (is_admin(company_id)) with check (is_admin(company_id));
drop policy if exists memberships_delete on memberships;
create policy memberships_delete on memberships for delete using (is_admin(company_id));

drop policy if exists invitations_all on invitations;
create policy invitations_all on invitations for all using (is_admin(company_id)) with check (is_admin(company_id));

drop policy if exists templates_select on templates;
create policy templates_select on templates for select using (is_member(company_id));
drop policy if exists templates_write on templates;
create policy templates_write on templates for all using (is_admin(company_id)) with check (is_admin(company_id));

drop policy if exists usage_select on usage_monthly;
create policy usage_select on usage_monthly for select using (is_member(company_id));

-- Tables métier : lecture pour les membres, écriture pour admin / gestion
do $$
declare t text;
begin
  foreach t in array array['dossiers', 'notes', 'quotes', 'sequences', 'sequence_steps'] loop
    execute format('drop policy if exists %1$s_select on %1$s', t);
    execute format('create policy %1$s_select on %1$s for select using (is_member(company_id))', t);
    execute format('drop policy if exists %1$s_insert on %1$s', t);
    execute format('create policy %1$s_insert on %1$s for insert with check (can_edit(company_id))', t);
    execute format('drop policy if exists %1$s_update on %1$s', t);
    execute format('create policy %1$s_update on %1$s for update using (can_edit(company_id)) with check (can_edit(company_id))', t);
  end loop;
end $$;
drop policy if exists quotes_delete on quotes;
create policy quotes_delete on quotes for delete using (is_admin(company_id));
drop policy if exists notes_delete on notes;
create policy notes_delete on notes for delete using (is_admin(company_id));

-- Journal : lecture membres, ajout admin / gestion, jamais de modification
drop policy if exists events_select on events;
create policy events_select on events for select using (is_member(company_id));
drop policy if exists events_insert on events;
create policy events_insert on events for insert with check (can_edit(company_id) and actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Intégrité
-- ---------------------------------------------------------------------------

-- Numérotation D-0001 par entreprise
create or replace function trg_dossier_ref() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('dossier_ref:' || new.company_id::text));
  select coalesce(max(ref_num), 0) + 1 into new.ref_num from dossiers where company_id = new.company_id;
  new.ref := 'D-' || lpad(new.ref_num::text, 4, '0');
  return new;
end $$;
drop trigger if exists dossier_ref on dossiers;
create trigger dossier_ref before insert on dossiers for each row execute function trg_dossier_ref();

-- Champs protégés : un utilisateur ne change ni l'entreprise, ni la référence, ni le jeton de réponse
create or replace function trg_dossier_protect() returns trigger language plpgsql as $$
begin
  if is_end_user() and (new.company_id <> old.company_id or new.ref <> old.ref or new.ref_num <> old.ref_num
      or new.reply_token <> old.reply_token or new.created_at <> old.created_at) then
    raise exception 'Champ non modifiable';
  end if;
  return new;
end $$;
drop trigger if exists dossier_protect on dossiers;
create trigger dossier_protect before update on dossiers for each row execute function trg_dossier_protect();

-- Le journal est en ajout seul (sauf purge RGPD explicite)
create or replace function trg_events_immutable() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('suivio.purge', true), '') <> 'on' then
    raise exception 'Le journal des actions ne peut pas être modifié';
  end if;
  return coalesce(old, new);
end $$;
drop trigger if exists events_immutable on events;
create trigger events_immutable before update or delete on events for each row execute function trg_events_immutable();

-- Toujours au moins un administrateur par entreprise
create or replace function trg_keep_one_admin() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('suivio.purge', true), '') = 'on' then return coalesce(new, old); end if;
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (select 1 from memberships where company_id = old.company_id and role = 'admin' and user_id <> old.user_id) then
    raise exception 'Il faut au moins un administrateur';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists keep_one_admin on memberships;
create trigger keep_one_admin before update or delete on memberships for each row execute function trg_keep_one_admin();

-- Les relances : un utilisateur valide, retire ou remet en attente ; seul le serveur envoie
create or replace function trg_step_transition() returns trigger language plpgsql as $$
begin
  if is_end_user() then
    if new.status in ('envoi', 'envoyee', 'echec') and new.status <> old.status then
      raise exception 'Seul le serveur peut marquer une relance comme envoyée';
    end if;
    if old.status in ('envoi', 'envoyee') and new.status <> old.status then
      raise exception 'Relance déjà envoyée';
    end if;
    if new.sequence_id <> old.sequence_id or new.company_id <> old.company_id or new.sent_at is distinct from old.sent_at then
      raise exception 'Champ non modifiable';
    end if;
    if new.status = 'programmee' and old.status <> 'programmee' then new.validated_by := auth.uid(); end if;
  end if;
  return new;
end $$;
drop trigger if exists step_transition on sequence_steps;
create trigger step_transition before update on sequence_steps for each row execute function trg_step_transition();

-- ---------------------------------------------------------------------------
-- Règles métier automatiques
-- ---------------------------------------------------------------------------

create or replace function stop_sequences(p_quote uuid, p_dossier uuid, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare s record; n int := 0;
begin
  for s in select * from sequences
    where state in ('active', 'suspendue') and ((p_quote is not null and quote_id = p_quote) or (p_dossier is not null and dossier_id = p_dossier))
    for update
  loop
    update sequences set state = 'arretee', stop_reason = upper(left(p_reason, 1)) || substr(p_reason, 2) where id = s.id;
    update sequence_steps set status = 'annulee' where sequence_id = s.id and status in ('a_valider', 'programmee', 'echec');
    insert into events (company_id, dossier_id, type, text) values (s.company_id, s.dossier_id, 'follow', 'Relances arrêtées : ' || p_reason);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function stop_sequences(uuid, uuid, text) from public, anon, authenticated;

create or replace function quote_status_label(s text) returns text language sql immutable as $$
  select case s when 'a_preparer' then 'À préparer' when 'envoye' then 'Envoyé' when 'en_attente' then 'En attente'
    when 'accepte' then 'Accepté' when 'refuse' then 'Refusé' when 'expire' then 'Expiré' else s end
$$;

-- Changement de statut d'un devis : arrêt des relances + statut du dossier
create or replace function trg_quote_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare open_states text[] := array['envoye', 'en_attente'];
begin
  if tg_op = 'UPDATE' and new.status = old.status then return new; end if;
  insert into events (company_id, dossier_id, type, text, actor_id)
  values (new.company_id, new.dossier_id, 'quote',
    case when tg_op = 'INSERT' then 'Devis ' || new.ref || ' associé — statut : ' || quote_status_label(new.status)
         else 'Devis ' || new.ref || ' : statut changé en ' || quote_status_label(new.status) end, auth.uid());
  if tg_op = 'UPDATE' and old.status = any (open_states) and not new.status = any (open_states) then
    perform stop_sequences(new.id, null, 'statut du devis changé : ' || quote_status_label(new.status));
  end if;
  update dossiers set
    status = case new.status
      when 'accepte' then 'gagne' when 'refuse' then 'perdu'
      when 'envoye' then 'devis_envoye' when 'en_attente' then 'devis_envoye'
      when 'a_preparer' then 'a_chiffrer' else status end,
    next_action = case new.status
      when 'accepte' then 'Planifier l''intervention dans le logiciel métier'
      when 'refuse' then ''
      when 'expire' then 'Devis expiré : relancer ou clore'
      when 'envoye' then 'Programmer les relances du devis'
      else next_action end,
    next_action_at = case when new.status = 'refuse' then null else now() end
  where id = new.dossier_id;
  return new;
end $$;
drop trigger if exists quote_status on quotes;
create trigger quote_status after insert or update of status on quotes for each row execute function trg_quote_status();

-- Réponse du client (événement « in ») : arrêt des relances du dossier
create or replace function trg_client_reply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'in' and new.dossier_id is not null then
    perform stop_sequences(null, new.dossier_id, 'le client a répondu');
    update quotes set status = 'en_attente' where dossier_id = new.dossier_id and status = 'envoye';
    update dossiers set next_action = 'Répondre au client', next_action_at = now() where id = new.dossier_id;
  end if;
  return new;
end $$;
drop trigger if exists client_reply on events;
create trigger client_reply after insert on events for each row execute function trg_client_reply();

-- ---------------------------------------------------------------------------
-- Fonctions appelées par l'application
-- ---------------------------------------------------------------------------

-- Création d'une entreprise : l'utilisateur en devient administrateur
create or replace function create_company(p_name text, p_display_name text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if (select count(*) from memberships where user_id = auth.uid() and role = 'admin') >= 3 then
    raise exception 'Nombre maximum d''entreprises atteint';
  end if;
  insert into companies (name) values (trim(p_name)) returning id into c;
  insert into memberships (company_id, user_id, role, display_name) values (c, auth.uid(), 'admin', coalesce(nullif(trim(p_display_name), ''), 'Administrateur'));
  insert into templates (company_id, key, name, subject, body) values
    (c, 'accuse', 'Accusé de réception', 'Votre demande {ref_dossier}',
     E'Bonjour {client},\n\nNous avons bien reçu votre demande et reviendrons vers vous pendant nos horaires d''ouverture ({horaires}).\n\nCordialement,\n{entreprise}'),
    (c, 'relance_1', 'Relance 1 — prise de nouvelles', 'Votre devis {ref}',
     E'Bonjour {client},\n\nNous vous avons transmis le devis {ref} le {date_devis}. Avez-vous pu le consulter ?\nNous restons disponibles pour répondre à vos questions.\n\nCordialement,\n{responsable} — {entreprise}'),
    (c, 'relance_2', 'Relance 2 — point d''étape', 'Votre devis {ref}',
     E'Bonjour {client},\n\nJe me permets de revenir vers vous au sujet du devis {ref}. Souhaitez-vous que nous en parlions par téléphone ou que nous ajustions certains éléments ?\n\nCordialement,\n{responsable} — {entreprise}'),
    (c, 'relance_3', 'Relance 3 — avant échéance', 'Votre devis {ref} arrive à échéance',
     E'Bonjour {client},\n\nLe devis {ref} arrive à échéance le {echeance}. Sans retour de votre part, nous considérerons que le projet est en pause. Vous pouvez nous recontacter à tout moment.\n\nCordialement,\n{responsable} — {entreprise}');
  return c;
end $$;

-- Rattache les invitations en attente à l'utilisateur connecté (même adresse e-mail)
create or replace function accept_invitations() returns int
language plpgsql security definer set search_path = public as $$
declare mail text; n int;
begin
  select lower(email) into mail from auth.users where id = auth.uid();
  if mail is null then return 0; end if;
  insert into memberships (company_id, user_id, role, display_name)
    select company_id, auth.uid(), role, display_name from invitations where email = mail
    on conflict (company_id, user_id) do nothing;
  get diagnostics n = row_count;
  delete from invitations where email = mail;
  return n;
end $$;

-- Formulaire public : nom de l'entreprise et horaires uniquement
create or replace function public_form_info(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', name, 'contact_hours', contact_hours, 'lang', lang) from companies where form_token = p_token
$$;

-- Formulaire public : dépôt d'une demande (seul accès en écriture des visiteurs)
create or replace function submit_request(p_token text, p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare c companies; d dossiers; m date := date_trunc('month', now())::date; used int;
  f_name text := left(trim(coalesce(p->>'name', '')), 120);
  f_phone text := left(trim(coalesce(p->>'phone', '')), 40);
  f_email text := lower(left(trim(coalesce(p->>'email', '')), 160));
  f_cp text := left(trim(coalesce(p->>'postcode', '')), 10);
  f_desc text := left(trim(coalesce(p->>'description', '')), 4000);
  f_need text := coalesce(p->>'need', '');
begin
  select * into c from companies where form_token = p_token;
  if c.id is null then raise exception 'Formulaire introuvable'; end if;
  -- champ piège rempli uniquement par les robots : on répond comme si tout allait bien
  if coalesce(p->>'website', '') <> '' then return 'ok'; end if;
  if f_name = '' or f_desc = '' or f_cp = '' then raise exception 'Nom, code postal et description sont obligatoires'; end if;
  if f_phone = '' and f_email = '' then raise exception 'Téléphone ou e-mail obligatoire'; end if;
  if f_email <> '' and f_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Adresse e-mail invalide'; end if;
  if f_need not in ('', 'installation', 'entretien', 'depannage') then f_need := ''; end if;
  if (select count(*) from dossiers where company_id = c.id and source = 'Formulaire web' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de demandes en peu de temps, réessayez plus tard';
  end if;
  select coalesce(requests, 0) into used from usage_monthly where company_id = c.id and month = m;
  if coalesce(used, 0) >= c.limit_requests * 2 then raise exception 'Formulaire temporairement indisponible'; end if;

  insert into dossiers (company_id, source, kind, name, company_name, phone, email, address, postcode, city, need, equipment, brand, description, availability,
                        owner_id, next_action, next_action_at)
  values (c.id, 'Formulaire web', case when p->>'kind' = 'entreprise' then 'entreprise' else 'particulier' end, f_name,
          left(coalesce(p->>'company_name', ''), 120), f_phone, f_email, left(coalesce(p->>'address', ''), 200), f_cp,
          left(coalesce(p->>'city', ''), 80), f_need, left(coalesce(p->>'equipment', ''), 80), left(coalesce(p->>'brand', ''), 80), f_desc,
          left(coalesce(p->>'availability', ''), 200),
          (select user_id from memberships where company_id = c.id and role = 'admin' order by created_at limit 1),
          'Première réponse au client', now() + interval '2 hours')
  returning * into d;
  insert into events (company_id, dossier_id, type, text, body) values (c.id, d.id, 'create', 'Demande reçue (formulaire web)', f_desc);
  insert into usage_monthly (company_id, month, requests) values (c.id, m, 1)
    on conflict (company_id, month) do update set requests = usage_monthly.requests + 1;
  return d.ref;
end $$;

-- Remplace les variables d'un modèle de message
create or replace function render_template(p_body text, q quotes, d dossiers, c companies) returns text
language sql stable security definer set search_path = public as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(p_body,
    '{client}', d.name), '{ref}', q.ref), '{date_devis}', coalesce(to_char(q.sent_on, 'DD/MM/YYYY'), '')),
    '{echeance}', coalesce(to_char(q.due_on, 'DD/MM/YYYY'), '')),
    '{responsable}', coalesce((select display_name from memberships where company_id = c.id and user_id = d.owner_id), c.name)),
    '{entreprise}', c.name), '{horaires}', c.contact_hours), '{ref_dossier}', d.ref)
$$;

-- Crée la séquence de relances d'un devis (anti-doublon garanti par l'index unique)
create or replace function create_sequence(p_quote uuid, p_validate boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare q quotes; d dossiers; c companies; s uuid; i int; due timestamptz; tkey text; t templates;
begin
  select * into q from quotes where id = p_quote;
  if q.id is null or not can_edit(q.company_id) then raise exception 'Devis introuvable ou action non autorisée'; end if;
  if q.status not in ('envoye', 'en_attente') then raise exception 'Les relances ne concernent que les devis envoyés ou en attente'; end if;
  if exists (select 1 from sequences where quote_id = q.id and state in ('active', 'suspendue')) then
    raise exception 'Une séquence est déjà en cours pour ce devis';
  end if;
  select * into d from dossiers where id = q.dossier_id;
  select * into c from companies where id = q.company_id;
  if d.email = '' then raise exception 'Le client n''a pas d''adresse e-mail : relances par e-mail impossibles'; end if;
  insert into sequences (company_id, quote_id, dossier_id, created_by) values (q.company_id, q.id, q.dossier_id, auth.uid()) returning id into s;
  for i in 1 .. coalesce(array_length(c.seq_delays, 1), 0) loop
    due := coalesce(q.sent_on, current_date)::timestamptz + make_interval(days => c.seq_delays[i]) + make_interval(hours => c.send_start_hour + 1);
    if due <= now() then due := now() + make_interval(days => i); end if;
    tkey := coalesce(c.seq_templates[i], 'relance_1');
    select * into t from templates where company_id = c.id and key = tkey;
    if t.key is null then raise exception 'Modèle % introuvable', tkey; end if;
    insert into sequence_steps (company_id, sequence_id, position, day_offset, due_at, template_key, subject, body, status, validated_by)
    values (c.id, s, i, c.seq_delays[i], due, tkey, render_template(t.subject, q, d, c), render_template(t.body, q, d, c),
            case when p_validate then 'programmee' else 'a_valider' end, case when p_validate then auth.uid() end);
  end loop;
  insert into events (company_id, dossier_id, type, text, actor_id)
  values (c.id, d.id, 'follow', 'Séquence de relances créée pour ' || q.ref || case when p_validate then ' et validée' else ' (à valider)' end, auth.uid());
  update dossiers set next_action = case when p_validate then 'Attendre la réponse du client' else 'Valider les relances' end,
    next_action_at = (select min(due_at) from sequence_steps where sequence_id = s) where id = d.id;
  return s;
end $$;

-- Suspendre, reprendre ou arrêter une séquence
create or replace function set_sequence_state(p_seq uuid, p_state text) returns void
language plpgsql security definer set search_path = public as $$
declare s sequences; who text;
begin
  select * into s from sequences where id = p_seq for update;
  if s.id is null or not can_edit(s.company_id) then raise exception 'Séquence introuvable ou action non autorisée'; end if;
  select coalesce(nullif(display_name, ''), 'un membre') into who from memberships where company_id = s.company_id and user_id = auth.uid();
  if p_state = 'suspendue' and s.state = 'active' then
    update sequences set state = 'suspendue', stop_reason = 'Suspendue par ' || who where id = s.id;
    insert into events (company_id, dossier_id, type, text, actor_id) values (s.company_id, s.dossier_id, 'follow', 'Séquence de relances suspendue', auth.uid());
  elsif p_state = 'active' and s.state = 'suspendue' then
    update sequences set state = 'active', stop_reason = '' where id = s.id;
    update sequence_steps set due_at = now() + interval '1 day' where sequence_id = s.id and status in ('a_valider', 'programmee') and due_at <= now();
    insert into events (company_id, dossier_id, type, text, actor_id) values (s.company_id, s.dossier_id, 'follow', 'Séquence de relances reprise', auth.uid());
  elsif p_state = 'arretee' and s.state in ('active', 'suspendue') then
    update sequences set state = 'arretee', stop_reason = 'Arrêtée par ' || who where id = s.id;
    update sequence_steps set status = 'annulee' where sequence_id = s.id and status in ('a_valider', 'programmee', 'echec');
    insert into events (company_id, dossier_id, type, text, actor_id) values (s.company_id, s.dossier_id, 'follow', 'Relances arrêtées manuellement', auth.uid());
  else
    raise exception 'Changement d''état impossible';
  end if;
end $$;

-- Export complet des données d'une entreprise (admin)
create or replace function export_company(c uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin(c) then raise exception 'Réservé aux administrateurs'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'company', (select to_jsonb(x) - 'form_token' from companies x where id = c),
    'members', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from memberships x where company_id = c),
    'templates', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from templates x where company_id = c),
    'dossiers', (select coalesce(jsonb_agg(to_jsonb(x) - 'reply_token'), '[]') from dossiers x where company_id = c),
    'notes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from notes x where company_id = c),
    'quotes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from quotes x where company_id = c),
    'sequences', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from sequences x where company_id = c),
    'sequence_steps', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from sequence_steps x where company_id = c),
    'events', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]') from events x where company_id = c));
end $$;

-- Effacement d'un client final (droit à l'effacement) : dossier, devis, relances, historique
create or replace function delete_dossier(p_dossier uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select company_id into c from dossiers where id = p_dossier;
  if c is null or not is_admin(c) then raise exception 'Réservé aux administrateurs'; end if;
  perform set_config('suivio.purge', 'on', true);
  delete from dossiers where id = p_dossier;
  perform set_config('suivio.purge', 'off', true);
end $$;

-- Suppression définitive d'une entreprise et de toutes ses données
create or replace function delete_company(c uuid, p_confirm text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(c) then raise exception 'Réservé aux administrateurs'; end if;
  if p_confirm is distinct from (select name from companies where id = c) then raise exception 'Confirmation incorrecte : saisissez le nom exact de l''entreprise'; end if;
  perform set_config('suivio.purge', 'on', true);
  delete from companies where id = c;
  perform set_config('suivio.purge', 'off', true);
end $$;

-- ---------------------------------------------------------------------------
-- Fonctions réservées au serveur (Edge Functions, clé service_role)
-- ---------------------------------------------------------------------------

-- Consomme une unité de quota ; renvoie false si le volume du mois est atteint
create or replace function use_quota(c uuid, kind text) returns boolean
language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', now())::date; lim int; cur int;
begin
  select case kind when 'ai' then limit_ai when 'email' then limit_emails else null end into lim from companies where id = c;
  if lim is null then raise exception 'Quota inconnu'; end if;
  insert into usage_monthly (company_id, month) values (c, m) on conflict do nothing;
  select case kind when 'ai' then ai_calls else emails end into cur from usage_monthly where company_id = c and month = m for update;
  if cur >= lim then return false; end if;
  if kind = 'ai' then update usage_monthly set ai_calls = ai_calls + 1 where company_id = c and month = m;
  else update usage_monthly set emails = emails + 1 where company_id = c and month = m; end if;
  return true;
end $$;

-- Réserve les relances à envoyer (à l'échéance, séquence active, dans la fenêtre d'envoi)
create or replace function claim_due_steps(p_limit int default 50) returns table (
  step_id uuid, company_id uuid, dossier_id uuid, step_position int, subject text, body text,
  to_email text, company_name text, company_email text, reply_token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select st.id from sequence_steps st
      join sequences s on s.id = st.sequence_id and s.state = 'active'
      join companies c on c.id = st.company_id
    where st.status = 'programmee' and st.due_at <= now()
      and extract(hour from now() at time zone c.timezone) >= c.send_start_hour
      and extract(hour from now() at time zone c.timezone) < c.send_end_hour
      and extract(isodow from now() at time zone c.timezone) <= case when c.send_saturday then 6 else 5 end
    order by st.due_at
    limit p_limit
    for update of st skip locked
  )
  update sequence_steps st set status = 'envoi', attempts = st.attempts + 1
  from due, sequences s, dossiers d, companies c
  where st.id = due.id and s.id = st.sequence_id and d.id = s.dossier_id and c.id = st.company_id
  returning st.id, st.company_id, d.id, st.position, st.subject, st.body, d.email, c.name, c.email, d.reply_token;
end $$;

-- Résultat d'un envoi : succès, nouvel essai différé, ou échec définitif après 3 tentatives
create or replace function finish_step(p_step uuid, p_ok boolean, p_error text default '') returns void
language plpgsql security definer set search_path = public as $$
declare st sequence_steps; s sequences;
begin
  select * into st from sequence_steps where id = p_step for update;
  if st.id is null or st.status <> 'envoi' then return; end if;  -- idempotent
  select * into s from sequences where id = st.sequence_id;
  if p_ok then
    update sequence_steps set status = 'envoyee', sent_at = now(), last_error = '' where id = st.id;
    insert into events (company_id, dossier_id, type, text, body) values (st.company_id, s.dossier_id, 'follow', 'Relance ' || st.position || ' envoyée par e-mail', st.body);
  elsif st.attempts < 3 then
    update sequence_steps set status = 'programmee', due_at = now() + make_interval(mins => 30 * st.attempts), last_error = left(p_error, 500) where id = st.id;
  else
    update sequence_steps set status = 'echec', last_error = left(p_error, 500) where id = st.id;
    insert into events (company_id, dossier_id, type, text, body) values (st.company_id, s.dossier_id, 'follow', 'Relance ' || st.position || ' non envoyée après 3 tentatives', left(p_error, 500));
  end if;
  if not exists (select 1 from sequence_steps where sequence_id = s.id and status in ('a_valider', 'programmee', 'envoi')) then
    update sequences set state = 'terminee', stop_reason = 'Toutes les relances ont été envoyées' where id = s.id and state = 'active';
  end if;
end $$;

-- Devis arrivés à échéance → Expiré (les déclencheurs arrêtent les relances)
create or replace function expire_quotes() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update quotes set status = 'expire' where status in ('envoye', 'en_attente') and due_on < current_date;
  get diagnostics n = row_count;
  return n;
end $$;

-- E-mail entrant : rattaché au dossier par le jeton de l'adresse de réponse, sinon par l'expéditeur
create or replace function record_inbound(p_token text, p_from text, p_text text) returns uuid
language plpgsql security definer set search_path = public as $$
declare d dossiers;
begin
  if coalesce(p_token, '') <> '' then select * into d from dossiers where reply_token = p_token; end if;
  if d.id is null and coalesce(p_from, '') <> '' then
    select * into d from dossiers where email = lower(trim(p_from)) and status not in ('perdu', 'clos') order by created_at desc limit 1;
  end if;
  if d.id is null then return null; end if;
  insert into events (company_id, dossier_id, type, text, body) values (d.company_id, d.id, 'in', 'Réponse du client reçue par e-mail', left(coalesce(p_text, ''), 8000));
  return d.id;
end $$;

-- Les visiteurs n'ont accès qu'au formulaire ; les fonctions serveur sont fermées aux utilisateurs
revoke execute on function use_quota(uuid, text), claim_due_steps(int), finish_step(uuid, boolean, text), expire_quotes(), record_inbound(text, text, text)
  from public, anon, authenticated;
revoke execute on function create_company(text, text), accept_invitations(), create_sequence(uuid, boolean), set_sequence_state(uuid, text),
  export_company(uuid), delete_dossier(uuid), delete_company(uuid, text), render_template(text, quotes, dossiers, companies) from public, anon;
grant execute on function public_form_info(text), submit_request(text, jsonb) to anon, authenticated;
grant execute on function create_company(text, text), accept_invitations(), create_sequence(uuid, boolean), set_sequence_state(uuid, text),
  export_company(uuid), delete_dossier(uuid), delete_company(uuid, text) to authenticated;
