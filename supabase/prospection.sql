-- =====================================================================
--  MEDINA FUSION — Module PROSPECTION (prospects, campagnes, envois, exclusions)
--  À coller dans Supabase → SQL Editor → « Run », APRÈS schema.sql (relancé
--  pour la colonne commandes.ref). Peut être relancé sans risque.
--  Aucun envoi n'est fait par ce script : les envois sont réalisés par la
--  fonction serveur « prospection » (supabase/functions/prospection).
-- =====================================================================

alter table public.commandes add column if not exists ref text not null default '';

-- ---------- Paramètres (une seule ligne, id = 1) ----------
create table if not exists public.prospection_parametres (
  id integer primary key default 1 check (id = 1),
  expediteur_nom text not null default 'Imad – Medina Fusion',
  expediteur_email text not null default '',
  limite_jour integer not null default 30 check (limite_jour between 1 and 500),
  heure_debut integer not null default 9 check (heure_debut between 0 and 23),
  heure_fin integer not null default 18 check (heure_fin between 1 and 24),
  site_url text not null default '',
  adresse_postale text not null default '288 rue Étienne Marcel, 93170 Bagnolet',
  relance_active boolean not null default true,
  -- Renseignés UNIQUEMENT par la fonction serveur après vérification réelle
  envoi_operationnel boolean not null default false,
  detection_reponses_ok boolean not null default false,
  derniere_verification timestamptz,
  dernier_passage timestamptz,
  derniere_erreur text not null default ''
);
insert into public.prospection_parametres (id) values (1) on conflict (id) do nothing;

-- ---------- Liste d'exclusion (désinscriptions, refus, adresses rejetées) ----------
create table if not exists public.prospection_exclusions (
  email text primary key check (email = lower(email)),
  motif text not null default 'desinscription'
    check (motif in ('desinscription', 'refus', 'adresse_rejetee', 'manuel')),
  created_at timestamptz not null default now()
);

-- ---------- Prospects ----------
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Jeton public (lien de désinscription et lien « Demander une dégustation »)
  token uuid not null unique default gen_random_uuid(),
  siren text,
  nom text not null,
  categorie text not null default '',
  activite text not null default '',
  naf text not null default '',
  effectif text not null default '',
  adresse text not null default '',
  code_postal text not null default '',
  ville text not null default '',
  site text not null default '',
  email text not null default '' check (email = lower(email)),
  -- a_trouver : aucune adresse ; trouvee : extraite d'une source publique (non confirmée) ;
  -- verifiee : confirmée par l'administrateur ou par une réponse ; rejetee : refusée par le serveur de messagerie
  email_statut text not null default 'a_trouver' check (email_statut in ('a_trouver', 'trouvee', 'verifiee', 'rejetee')),
  email_source text not null default '',
  telephone text not null default '',
  linkedin_entreprise text not null default '',
  contact_nom text not null default '',
  contact_fonction text not null default '',
  linkedin_contact text not null default '',
  source text not null default '',
  collecte_le timestamptz not null default now(),
  statut text not null default 'nouveau'
    check (statut in ('nouveau', 'contacte', 'repondu', 'degustation', 'devis', 'client', 'refus', 'desinscrit', 'rejete')),
  notes text not null default '',
  client_id uuid references public.clients (id) on delete set null
);
create unique index if not exists prospects_siren_unique on public.prospects (siren) where siren is not null and siren <> '';
create index if not exists prospects_email on public.prospects (email) where email <> '';

-- Un prospect dont l'adresse est dans la liste d'exclusion est marqué « désinscrit », même après un nouvel import
create or replace function public.prospect_verifier_exclusion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  if new.email <> '' and exists (select 1 from public.prospection_exclusions e where e.email = new.email) then
    new.statut := 'desinscrit';
  end if;
  return new;
end $$;
drop trigger if exists prospects_exclusion on public.prospects;
create trigger prospects_exclusion before insert or update of email on public.prospects
  for each row execute function public.prospect_verifier_exclusion();

-- ---------- Campagnes ----------
create table if not exists public.campagnes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom text not null,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'programmee', 'en_pause', 'terminee')),
  objet text not null default '',
  corps text not null default '',
  relance boolean not null default true,
  objet_relance text not null default '',
  corps_relance text not null default '',
  debut date,
  valide_le timestamptz
);

-- ---------- Envois (1 = premier message, 2 = relance) ----------
create table if not exists public.envois (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  campagne_id uuid not null references public.campagnes (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  etape integer not null default 1 check (etape in (1, 2)),
  email text not null check (email = lower(email)),
  statut text not null default 'planifie' check (statut in ('planifie', 'envoye', 'echec', 'annule')),
  planifie_pour timestamptz not null default now(),
  envoye_le timestamptz,
  message_id text,
  thread_id text,
  repondu_le timestamptz,
  erreur text not null default '',
  unique (campagne_id, prospect_id, etape)
);
create index if not exists envois_a_traiter on public.envois (statut, planifie_pour);
create index if not exists envois_prospect on public.envois (prospect_id);

-- Garde-fou : jamais d'envoi planifié vers une adresse exclue
create or replace function public.envoi_verifier_exclusion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.statut = 'planifie' and exists (select 1 from public.prospection_exclusions e where e.email = lower(new.email)) then
    raise exception 'Adresse exclue (désinscription ou refus) : %', new.email;
  end if;
  return new;
end $$;
drop trigger if exists envois_exclusion on public.envois;
create trigger envois_exclusion before insert or update of statut, email on public.envois
  for each row execute function public.envoi_verifier_exclusion();

-- Ajout à la liste d'exclusion : prospects marqués et envois planifiés annulés
create or replace function public.exclusion_appliquer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.envois set statut = 'annule', erreur = 'Adresse exclue'
    where email = new.email and statut = 'planifie';
  update public.prospects
    set statut = case when new.motif = 'adresse_rejetee' then 'rejete' when new.motif = 'refus' then 'refus' else 'desinscrit' end,
        email_statut = case when new.motif = 'adresse_rejetee' then 'rejetee' else email_statut end
    where email = new.email;
  return new;
end $$;
drop trigger if exists exclusions_appliquer on public.prospection_exclusions;
create trigger exclusions_appliquer after insert on public.prospection_exclusions
  for each row execute function public.exclusion_appliquer();

-- ---------- Désinscription publique (lien dans chaque e-mail) ----------
-- Seul accès public : à partir du jeton du lien, ajoute l'adresse à la liste d'exclusion.
create or replace function public.prospect_desinscrire(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  select email into v_email from public.prospects where token = p_token;
  if v_email is null then return false; end if;
  if v_email <> '' then
    insert into public.prospection_exclusions (email, motif) values (v_email, 'desinscription') on conflict (email) do nothing;
  end if;
  update public.prospects set statut = 'desinscrit' where token = p_token;
  update public.envois set statut = 'annule', erreur = 'Désinscription'
    where prospect_id in (select id from public.prospects where token = p_token) and statut = 'planifie';
  return true;
end $$;

-- ---------- Lien avec les demandes du site (dégustation, devis, commande) ----------
alter table public.commandes add column if not exists prospect_id uuid references public.prospects (id) on delete set null;

create or replace function public.commande_lier_prospect()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.prospect_id is null and new.ref ~ '^[0-9a-f-]{36}$' then
    select id into new.prospect_id from public.prospects where token = new.ref::uuid;
  end if;
  return new;
end $$;
drop trigger if exists commandes_lier_prospect on public.commandes;
create trigger commandes_lier_prospect before insert on public.commandes
  for each row execute function public.commande_lier_prospect();

-- Avancement du prospect selon ses demandes réelles (ne recule jamais, ne touche pas aux désinscrits)
create or replace function public.prospect_avancement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rang_actuel integer;
  cible text;
  rangs constant text[] := array['nouveau', 'contacte', 'repondu', 'degustation', 'devis', 'client'];
begin
  if new.prospect_id is null then return new; end if;
  cible := case
    when new.statut in ('confirmee', 'en_preparation', 'livree') then 'client'
    when new.statut = 'devis_envoye' then 'devis'
    when new.type = 'degustation' then 'degustation'
    else 'repondu' end;
  select array_position(rangs, statut) into rang_actuel from public.prospects where id = new.prospect_id;
  if rang_actuel is not null and array_position(rangs, cible) > rang_actuel then
    update public.prospects set statut = cible, client_id = coalesce(client_id, new.client_id) where id = new.prospect_id;
    -- Une demande reçue vaut réponse : plus de relance
    update public.envois set statut = 'annule', erreur = 'Demande reçue' where prospect_id = new.prospect_id and statut = 'planifie';
  end if;
  return new;
end $$;
drop trigger if exists commandes_avancement_prospect on public.commandes;
create trigger commandes_avancement_prospect after insert or update of statut on public.commandes
  for each row execute function public.prospect_avancement();

-- ---------- Sécurité ----------
alter table public.prospection_parametres enable row level security;
alter table public.prospection_exclusions enable row level security;
alter table public.prospects enable row level security;
alter table public.campagnes enable row level security;
alter table public.envois enable row level security;

do $$
declare t text;
begin
  foreach t in array array['prospection_parametres', 'prospection_exclusions', 'prospects', 'campagnes', 'envois'] loop
    execute format('drop policy if exists "%s: admin" on public.%I', t, t);
    execute format('create policy "%s: admin" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- L'administrateur ne peut pas s'attribuer lui-même un envoi « opérationnel » :
-- ces colonnes sont écrites par la fonction serveur (clé service_role, hors RLS).
revoke insert, update, delete on public.prospection_parametres from authenticated;
grant update (expediteur_nom, expediteur_email, limite_jour, heure_debut, heure_fin, site_url, adresse_postale, relance_active)
  on public.prospection_parametres to authenticated;

revoke all on function public.prospect_desinscrire(uuid) from public;
grant execute on function public.prospect_desinscrire(uuid) to anon, authenticated;
