-- =====================================================================
--  MEDINA FUSION — Module RENTABILITÉ (charges fixes et frais par commande)
--  À coller dans Supabase → SQL Editor → « Run », après schema.sql.
--  Peut être relancé sans risque (idempotent).
-- =====================================================================

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  libelle text not null,
  montant numeric(10, 2) not null default 0 check (montant >= 0),
  -- 'mensuel' : montant HT par mois (loyer, salaires…)
  -- 'par_commande' : montant HT ajouté à chaque commande vendue (livraison, emballage…)
  type text not null default 'mensuel' check (type in ('mensuel', 'par_commande')),
  categorie text not null default ''
);

alter table public.charges enable row level security;
drop policy if exists "charges: admin" on public.charges;
create policy "charges: admin" on public.charges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.charges from anon;
