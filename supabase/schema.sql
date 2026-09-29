-- =====================================================================
--  MEDINA FUSION — Espace administrateur : schéma Supabase
--  À coller en entier dans Supabase → SQL Editor → « Run ».
--  Le script peut être relancé sans risque (idempotent).
-- =====================================================================

-- ---------- Administrateurs autorisés ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- Vrai si l'utilisateur connecté fait partie des administrateurs
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Clients ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom text not null default '',
  entreprise text not null default '',
  telephone text not null default '',
  email text not null default '',
  adresse text not null default '',
  notes text not null default '',
  -- 9 derniers chiffres du téléphone : « 06 12… » et « +33 6 12… » donnent la même clé
  telephone_cle text generated always as (right(regexp_replace(telephone, '\D', '', 'g'), 9)) stored
);

create unique index if not exists clients_email_unique on public.clients (lower(email)) where email <> '';
create index if not exists clients_telephone_cle on public.clients (telephone_cle) where telephone_cle <> '';

-- ---------- Commandes / devis ----------
create table if not exists public.commandes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_id uuid references public.clients (id) on delete set null,
  source text not null default 'admin' check (source in ('site', 'admin')),
  type text not null default 'commande' check (type in ('commande', 'degustation')),
  statut text not null default 'demande'
    check (statut in ('demande', 'devis_envoye', 'confirmee', 'en_preparation', 'livree', 'annulee')),
  paiement_statut text not null default 'en_attente' check (paiement_statut in ('en_attente', 'acompte', 'paye')),
  montant_encaisse numeric(10, 2) not null default 0 check (montant_encaisse >= 0),
  date_prestation date,
  heure text not null default '',
  nb_personnes integer check (nb_personnes is null or nb_personnes >= 0),
  mode text not null default 'livraison' check (mode in ('livraison', 'retrait')),
  adresse text not null default '',
  -- [{ "nom": "...", "quantite": 2, "prix_unitaire": 15.9 }]  (prix HT)
  lignes jsonb not null default '[]'::jsonb check (jsonb_typeof(lignes) = 'array'),
  total_ht numeric(10, 2) not null default 0,
  tva_taux numeric(4, 3) not null default 0.10,
  allergies text not null default '',
  notes text not null default '',
  parrain text not null default '',
  numero_devis text,
  numero_facture text
);

-- Référence de suivi (ex. lien « Demander une dégustation » d’une campagne de prospection)
alter table public.commandes add column if not exists ref text not null default '';

create index if not exists commandes_date on public.commandes (date_prestation);
create index if not exists commandes_client on public.commandes (client_id);
create index if not exists commandes_statut on public.commandes (statut);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists commandes_touch on public.commandes;
create trigger commandes_touch before update on public.commandes
  for each row execute function public.touch_updated_at();

-- ---------- Numérotation des devis / factures ----------
create table if not exists public.compteurs (
  type text not null check (type in ('devis', 'facture')),
  annee integer not null,
  valeur integer not null default 0,
  primary key (type, annee)
);

-- Renvoie D-2026-0001 / F-2026-0001 (réservé aux administrateurs)
create or replace function public.prochain_numero(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_annee integer := extract(year from now())::integer;
  v_valeur integer;
begin
  if not public.is_admin() then
    raise exception 'Accès refusé';
  end if;
  if p_type not in ('devis', 'facture') then
    raise exception 'Type invalide';
  end if;
  insert into public.compteurs (type, annee, valeur) values (p_type, v_annee, 1)
  on conflict (type, annee) do update set valeur = public.compteurs.valeur + 1
  returning valeur into v_valeur;
  return (case p_type when 'devis' then 'D' else 'F' end) || '-' || v_annee || '-' || lpad(v_valeur::text, 4, '0');
end $$;

-- ---------- Réception des demandes du site (seul accès public) ----------
-- Le site appelle cette fonction ; elle ne permet QUE de déposer une demande,
-- jamais de lire des données. Statut forcé à « demande » (non confirmée).
create or replace function public.nouvelle_demande(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_commande uuid;
  v_email text := lower(left(trim(coalesce(p ->> 'email', '')), 200));
  v_tel text := left(trim(coalesce(p ->> 'tel', '')), 40);
  v_tel_cle text := right(regexp_replace(v_tel, '\D', '', 'g'), 9);
  v_lignes jsonb := coalesce(p -> 'items', '[]'::jsonb);
  v_date date;
begin
  if jsonb_typeof(v_lignes) <> 'array' or jsonb_array_length(v_lignes) > 100 then
    raise exception 'Lignes invalides';
  end if;
  if coalesce(p ->> 'entreprise', '') = '' and v_email = '' and v_tel = '' then
    raise exception 'Coordonnées manquantes';
  end if;

  begin
    v_date := nullif(p ->> 'date', '')::date;
  exception when others then
    v_date := null;
  end;

  -- Client existant ? (même email, sinon même téléphone)
  if v_email <> '' then
    select id into v_client from public.clients where lower(email) = v_email limit 1;
  end if;
  if v_client is null and length(v_tel_cle) = 9 then
    select id into v_client from public.clients where telephone_cle = v_tel_cle order by created_at limit 1;
  end if;

  if v_client is null then
    insert into public.clients (nom, entreprise, telephone, email, adresse)
    values (
      left(coalesce(p ->> 'contact', ''), 200),
      left(coalesce(p ->> 'entreprise', ''), 200),
      v_tel,
      v_email,
      left(coalesce(p ->> 'adresse', ''), 500)
    )
    returning id into v_client;
  else
    -- Complète seulement les informations manquantes, sans écraser
    update public.clients set
      nom = case when nom = '' then left(coalesce(p ->> 'contact', ''), 200) else nom end,
      entreprise = case when entreprise = '' then left(coalesce(p ->> 'entreprise', ''), 200) else entreprise end,
      telephone = case when telephone = '' then v_tel else telephone end,
      email = case when email = '' then v_email else email end,
      adresse = case when adresse = '' then left(coalesce(p ->> 'adresse', ''), 500) else adresse end
    where id = v_client;
  end if;

  insert into public.commandes (
    client_id, source, type, statut, date_prestation, heure, mode, adresse,
    lignes, total_ht, allergies, parrain, ref
  ) values (
    v_client,
    'site',
    case when p ->> 'type' = 'degustation' then 'degustation' else 'commande' end,
    'demande',
    v_date,
    left(coalesce(p ->> 'heure', ''), 10),
    'livraison',
    left(coalesce(p ->> 'adresse', ''), 500),
    v_lignes,
    greatest(0, least(coalesce((p ->> 'total')::numeric, 0), 1000000)),
    left(coalesce(p ->> 'notes', ''), 2000),
    left(coalesce(p ->> 'parrain', ''), 200),
    left(coalesce(p ->> 'ref', ''), 64)
  )
  returning id into v_commande;

  return v_commande;
end $$;

-- ---------- Sécurité : Row Level Security ----------
alter table public.admins enable row level security;
alter table public.clients enable row level security;
alter table public.commandes enable row level security;
alter table public.compteurs enable row level security;

drop policy if exists "admins: lecture de soi" on public.admins;
create policy "admins: lecture de soi" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "clients: admin" on public.clients;
create policy "clients: admin" on public.clients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "commandes: admin" on public.commandes;
create policy "commandes: admin" on public.commandes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Aucun accès direct pour les visiteurs anonymes
revoke all on public.admins, public.clients, public.commandes, public.compteurs from anon;
revoke all on function public.prochain_numero(text) from public, anon;
grant execute on function public.prochain_numero(text) to authenticated;
revoke all on function public.nouvelle_demande(jsonb) from public;
grant execute on function public.nouvelle_demande(jsonb) to anon, authenticated;

-- =====================================================================
--  DERNIÈRE ÉTAPE — à lancer APRÈS avoir créé ton compte dans
--  Authentication → Users → « Add user » (remplace l'email si besoin).
-- =====================================================================
insert into public.admins (user_id, email)
select id, email from auth.users where lower(email) = lower('medina.fusion93@gmail.com')
on conflict (user_id) do nothing;
