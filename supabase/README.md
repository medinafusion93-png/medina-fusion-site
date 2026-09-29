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

## Module stock (ingrédients, recettes, mouvements)

Après `schema.sql`, exécuter **[`stock.sql`](./stock.sql)** de la même façon (SQL Editor → Run).
- Le stock baisse automatiquement quand une commande passe en « Confirmée / En préparation / Livrée »,
  selon les recettes (quantité par portion), et remonte si elle est annulée ou repasse en devis.
- Les demandes du site (statut « Demande reçue ») ne touchent pas au stock.

## Module rentabilité (charges, bénéfice, seuil)

Exécuter **[`finance.sql`](./finance.sql)** (SQL Editor → Run). Page admin **💰 Rentabilité** :
bénéfice estimé du mois, seuil de rentabilité, rentabilité par plat, simulation « Et si… ? », historique 6 mois.

## Module prospection (recherche d’entreprises, campagnes e-mail)

Page admin **🎯 Prospection**. Rien n’est simulé : sans les services ci-dessous, les boutons serveur
affichent une erreur claire et aucun envoi ne part.

### Ce qui marche dès l’installation SQL
1. Relancer **[`schema.sql`](./schema.sql)** (ajoute la colonne `commandes.ref`), puis exécuter **[`prospection.sql`](./prospection.sql)**.
2. Prospects (ajout manuel, doublons SIREN / e-mail / site / nom + CP), statuts, liens et message LinkedIn à copier,
   liste d’exclusion définitive, préparation des campagnes, page publique `/desinscription`,
   lien « Demander une dégustation » (`?pf=<jeton>`) qui relie la demande du site au prospect.

### Services à connecter (côté serveur uniquement — jamais dans Netlify ni dans le site)
| Service | Rôle | Coût |
|---|---|---|
| API Recherche d’entreprises (data.gouv) | recherche par ville / rayon / type | gratuit, sans clé |
| Supabase Edge Function `prospection` | recherche, extraction d’e-mail public, envois, relances | inclus (500 000 appels / mois en gratuit) |
| Gmail API (Google Cloud, OAuth) | envoi, détection des réponses et des adresses rejetées | gratuit |
| Nom de domaine + Google Workspace (recommandé) | adresse pro `imad@votre-domaine.fr`, SPF/DKIM/DMARC | ~10 €/an + ~7 €/mois |

**Pourquoi Gmail / Google Workspace ?** Les plateformes d’e-mailing (Brevo, Mailjet, Mailchimp, SendGrid…)
interdisent dans leurs conditions l’envoi à des contacts non inscrits : utilisées pour de la prospection,
le compte est suspendu. Envoyer depuis sa propre boîte professionnelle, à faible volume, avec des messages
individuels et une désinscription simple, correspond à la prospection B2B admise en France (CNIL : contact
professionnel, message en rapport avec sa fonction, opposition possible à tout moment). Les adresses de
messageries grand public (gmail.com, orange.fr…) sont écartées des campagnes tant qu’elles ne sont pas vérifiées.

**1. Déployer la fonction** (ordinateur, une seule fois) :
```
npx supabase login
npx supabase link --project-ref cnyjdpzazuekzwjwhzkc
npx supabase functions deploy prospection --no-verify-jwt
```
(`--no-verify-jwt` : la fonction vérifie elle-même que l’appelant est administrateur, et le passage automatique par `CRON_SECRET`.)

**2. Google Cloud → Gmail API** :
- console.cloud.google.com → nouveau projet → **API et services → Bibliothèque → Gmail API → Activer**.
- **Écran de consentement OAuth** : type Externe, ajouter votre adresse en « utilisateur test »
  (ou type Interne avec Google Workspace).
- **Identifiants → Créer → ID client OAuth → Application Web**, URI de redirection :
  `https://developers.google.com/oauthplayground`.
- Sur **developers.google.com/oauthplayground** : ⚙️ → *Use your own OAuth credentials* (ID + secret),
  portée `https://www.googleapis.com/auth/gmail.modify`, *Authorize APIs* avec le compte d’envoi,
  puis *Exchange authorization code for tokens* → copier le **Refresh token**.
- Avec un écran de consentement « Externe / Test », le refresh token expire au bout de 7 jours :
  publier l’application (usage personnel) ou utiliser Google Workspace (type Interne).

**3. Secrets** (Supabase → Edge Functions → Secrets) :
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `CRON_SECRET` (une longue phrase aléatoire).

**4. Dans l’admin** : Paramètres → adresse du site + **Vérifier la connexion** → campagne → **Envoyer un test**
(part uniquement vers votre propre adresse). La programmation reste bloquée tant que ce test n’a pas réussi.

**5. Passage automatique** : exécuter **[`prospection-cron.sql`](./prospection-cron.sql)** après y avoir mis le `CRON_SECRET`.
Toutes les 15 minutes : réponses détectées → prospect « A répondu » et relance annulée ; retours
« mailer-daemon » → adresse rejetée et exclue ; envois dus dans la fenêtre horaire (lun.–ven.) et la limite
quotidienne (10 au plus par passage) ; une relance à J+5 ouvrés **uniquement si la lecture de la boîte fonctionne**.

### Délivrabilité et règles
- Domaine propre : enregistrements **SPF**, **DKIM** (Workspace → Gmail → Authentifier les e-mails) et **DMARC** (`p=none` au début).
- Limites Gmail : ~500 destinataires/jour (compte gratuit), 2 000 (Workspace). Commencer à 20–30/jour.
- Chaque message contient l’identité de l’expéditeur, la raison du contact et un lien de désinscription gratuit
  (plus l’en-tête `List-Unsubscribe`). Pied de message non modifiable.
- E-mails : uniquement adresses professionnelles publiées (site officiel, pages contact / mentions légales),
  `robots.txt` respecté, source et date conservées. « Trouvé » ≠ « vérifié ».
- L’API officielle ne fournit ni e-mail, ni téléphone, ni site : ils se complètent à la main ou depuis le site officiel.
- LinkedIn : liens de recherche et message à copier seulement. Aucune automatisation (non autorisé par LinkedIn).
- Jours fériés non gérés par le calendrier d’envoi : mettre la campagne en pause ces jours-là.

## Sécurité

- La clé **anon** est publique par conception : toute la protection est **côté serveur** (Row Level Security).
- Un visiteur peut uniquement **déposer une demande** via la fonction `nouvelle_demande` (statut forcé à « demande »).
  Il ne peut **rien lire ni modifier**.
- Seuls les comptes présents dans la table `admins` voient et modifient les données.
- Ne jamais mettre la clé **service_role** dans le site ou dans Netlify.
- Clés Gmail et `service_role` : uniquement dans les secrets des Edge Functions (jamais dans Netlify).
- Vérification automatique : `npm run test:sql`.

## Sauvegardes

- Espace admin → **Clients → 💾 Sauvegarde complète** (JSON) et **Export Excel** : à faire chaque semaine.
- Offre Supabase Pro : sauvegardes automatiques quotidiennes (optionnel).
- Le projet gratuit se met en pause après 7 jours sans aucune activité : le relancer d’un clic depuis supabase.com.
