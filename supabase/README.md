# Espace administrateur — base de données Supabase

L’espace admin est sur **`/admin`**. Sans configuration, il s’ouvre en **mode démo** (données fictives, rien n’est enregistré).

## Mise en service (une seule fois)

1. Créer un compte gratuit sur **supabase.com** → **New project**
   (nom : `medina-fusion`, région : **Europe (Paris / Frankfurt)**, noter le mot de passe de la base).
2. **Authentication → Users → Add user → Create new user** : ton email + un mot de passe solide,
   cocher **Auto Confirm User**.
3. **SQL Editor → New query** : coller tout le contenu de [`schema.sql`](./schema.sql) → **Run**.
   (La dernière instruction donne les droits admin à `medina.fusion93@gmail.com` ; modifier l’email si besoin.)
4. **Authentication → Sign In / Providers** : désactiver **Allow new users to sign up**.
5. **Project Settings → API** : copier **Project URL** et la clé **anon public**.
6. **Netlify → Site configuration → Environment variables** : ajouter
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = clé anon public

   puis **Deploys → Trigger deploy**.

## Sécurité

- La clé **anon** est publique par conception : toute la protection est **côté serveur** (Row Level Security).
- Un visiteur peut uniquement **déposer une demande** via la fonction `nouvelle_demande` (statut forcé à « demande »).
  Il ne peut **rien lire ni modifier**.
- Seuls les comptes présents dans la table `admins` voient et modifient les données.
- Ne jamais mettre la clé **service_role** dans le site ou dans Netlify.
- Vérification automatique : `npm run test:sql`.

## Sauvegardes

- Espace admin → **Clients → 💾 Sauvegarde complète** (JSON) et **Export Excel** : à faire chaque semaine.
- Offre Supabase Pro : sauvegardes automatiques quotidiennes (optionnel).
- Le projet gratuit se met en pause après 7 jours sans aucune activité : le relancer d’un clic depuis supabase.com.
