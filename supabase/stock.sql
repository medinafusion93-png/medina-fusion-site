-- =====================================================================
--  MEDINA FUSION — Module STOCK (ingrédients, recettes, mouvements)
--  À coller en entier dans Supabase → SQL Editor → « Run »,
--  APRÈS schema.sql. Peut être relancé sans risque (idempotent).
-- =====================================================================

-- ---------- Ingrédients ----------
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom text not null,
  unite text not null default 'kg',
  stock numeric(12, 3) not null default 0,
  seuil numeric(12, 3) not null default 0 check (seuil >= 0),
  prix_unitaire numeric(10, 2) not null default 0 check (prix_unitaire >= 0),
  fournisseur text not null default ''
);
create unique index if not exists ingredients_nom_unique on public.ingredients (lower(nom));

-- ---------- Recettes : quantité d'ingrédient pour UNE portion d'un produit ----------
-- « produit » = libellé exact de la ligne de commande (ex. « Plateau Shawarma — Poulet »)
create table if not exists public.recettes (
  id uuid primary key default gen_random_uuid(),
  produit text not null,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  quantite numeric(12, 3) not null check (quantite > 0),
  unique (produit, ingredient_id)
);
create index if not exists recettes_produit on public.recettes (produit);

-- ---------- Mouvements de stock ----------
-- quantite > 0 : entrée (achat, retour) ; < 0 : sortie (commande, perte)
create table if not exists public.mouvements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  type text not null check (type in ('entree', 'sortie', 'ajustement')),
  quantite numeric(12, 3) not null,
  commande_id uuid references public.commandes (id) on delete set null,
  note text not null default ''
);
create index if not exists mouvements_ingredient on public.mouvements (ingredient_id, created_at desc);

-- Chaque mouvement met à jour le stock de l'ingrédient
create or replace function public.appliquer_mouvement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ingredients set stock = stock + new.quantite where id = new.ingredient_id;
  return new;
end $$;

drop trigger if exists mouvements_stock on public.mouvements;
create trigger mouvements_stock after insert on public.mouvements
  for each row execute function public.appliquer_mouvement();

-- Sortie (signe = -1) ou retour (signe = +1) des ingrédients d'une liste de lignes
create or replace function public.mouvements_commande(p_commande uuid, p_lignes jsonb, p_signe integer, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mouvements (ingredient_id, type, quantite, commande_id, note)
  select r.ingredient_id,
         case when p_signe < 0 then 'sortie' else 'entree' end,
         p_signe * sum(r.quantite * coalesce((l ->> 'quantite')::numeric, 0)),
         p_commande,
         p_note
  from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) as l
  join public.recettes r on r.produit = l ->> 'nom'
  group by r.ingredient_id
  having sum(r.quantite * coalesce((l ->> 'quantite')::numeric, 0)) <> 0;
end $$;

-- Déduction automatique : quand une commande devient une vente (confirmée / en préparation / livrée)
-- les ingrédients sortent du stock ; si elle est annulée (ou repasse en devis) ils y reviennent.
create or replace function public.stock_commande()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ventes text[] := array['confirmee', 'en_preparation', 'livree'];
  old_vente boolean := false;
  new_vente boolean := new.statut = any (ventes);
  lignes_changees boolean := false;
begin
  if tg_op = 'UPDATE' then
    old_vente := old.statut = any (ventes);
    lignes_changees := old.lignes is distinct from new.lignes;
    if old_vente and (not new_vente or lignes_changees) then
      perform public.mouvements_commande(new.id, old.lignes, 1, 'Retour stock (commande modifiée ou annulée)');
    end if;
  end if;
  if new_vente and (not old_vente or lignes_changees) then
    perform public.mouvements_commande(new.id, new.lignes, -1, 'Commande confirmée');
  end if;
  return new;
end $$;

drop trigger if exists commandes_stock on public.commandes;
create trigger commandes_stock after insert or update of statut, lignes on public.commandes
  for each row execute function public.stock_commande();

-- ---------- Sécurité ----------
alter table public.ingredients enable row level security;
alter table public.recettes enable row level security;
alter table public.mouvements enable row level security;

drop policy if exists "ingredients: admin" on public.ingredients;
create policy "ingredients: admin" on public.ingredients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "recettes: admin" on public.recettes;
create policy "recettes: admin" on public.recettes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "mouvements: admin" on public.mouvements;
create policy "mouvements: admin" on public.mouvements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.ingredients, public.recettes, public.mouvements from anon;
revoke all on function public.mouvements_commande(uuid, jsonb, integer, text) from public, anon, authenticated;
