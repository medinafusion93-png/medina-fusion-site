# Suivio — MVP pour clients pilotes

Application réelle (multi-entreprises) issue du prototype `prototypes/suivio/`.
Les demandes sont centralisées, les réponses préparées par l'IA, et chaque devis est suivi jusqu'à la décision du client, avec des relances automatiques validées par l'équipe.

> Suivio est un nom provisoire : je n'ai vérifié ni la marque ni le nom de domaine.

## Contenu

```
suivio/
├── src/                         Application web (React + TypeScript + Vite)
│   ├── pages/                   Connexion, création d'espace, formulaire public, tableau de bord,
│   │                            demandes, fiche dossier, devis, relances, paramètres
│   ├── stats.ts                 Indicateurs et liste « À traiter »
│   └── __tests__/               Tests unitaires (vitest)
├── supabase/
│   ├── schema.sql               Tables, sécurité (RLS), règles automatiques, fonctions
│   ├── test-schema.mjs          Tests de sécurité et des règles (PGlite)
│   ├── cron.sql                 Envoi automatique des relances toutes les 15 min
│   └── functions/
│       ├── _shared/logic.ts     Règles de l'assistant (partagées app + serveur)
│       ├── _shared/http.ts      Accès base, e-mails, erreurs
│       ├── assistant/           Résumé, infos manquantes, brouillon (IA Claude)
│       ├── send/                Envoi d'une réponse validée
│       ├── followups/           Envoi des relances programmées (cron)
│       └── inbound/             Réponse du client reçue par e-mail
└── netlify.toml                 Déploiement (site Netlify séparé du site traiteur)
```

## Ce qui est en place

| Exigence | Où |
|---|---|
| Authentification (lien magique par e-mail) | `pages/Login.tsx`, Supabase Auth |
| Séparation stricte des données entre entreprises | `company_id` sur chaque table + Row Level Security (`schema.sql`) |
| Rôles Admin / Gestion / Lecture, vérifiés **dans la base** | fonctions `is_member`, `can_edit`, `is_admin` + politiques RLS |
| Journal des actions non modifiable | table `events` + déclencheur `events_immutable` |
| Anti-doublon des relances | index unique « une séquence en cours par devis » + réservation `for update skip locked` |
| Arrêt automatique des relances | déclencheurs : réponse du client, devis accepté / refusé / expiré |
| Aucune relance sans validation | seul le serveur passe une relance en « envoyée » (déclencheur `step_transition`) |
| Fenêtre d'envoi (heures, samedi) | `claim_due_steps`, réglable dans Relances |
| Reprises en cas d'erreur | 3 tentatives espacées, puis « Échec » visible dans Relances et au tableau de bord |
| Contrôle des coûts | quotas mensuels (demandes, IA, e-mails) par entreprise, `use_quota` |
| Export et suppression | `export_company` (JSON), `delete_dossier` (droit à l'effacement), `delete_company` |
| Secrets côté serveur uniquement | clés IA et e-mail dans les secrets Supabase, jamais dans l'application web |
| Formulaire public protégé | jeton par entreprise, champ piège anti-robots, 30 demandes/h maximum, aucun accès en lecture |

**Garde-fous de l'IA :**
- Le texte du client est transmis comme une donnée, entre balises. Les consignes qu'il contient sont ignorées et signalées.
- Le téléphone et l'e-mail du client ne sont **pas** envoyés à l'IA : seule leur présence l'est.
- Si un brouillon contient un prix, un créneau, une garantie ou un diagnostic, il est remplacé par le brouillon des règles.
- En cas d'urgence possible, le brouillon contient une zone « À compléter » qui bloque l'envoi.
- Sans clé IA, quand le quota est atteint, ou en cas de refus ou d'erreur du modèle, l'analyse se fait par règles locales et l'interface l'indique.

## Vérifications faites

```bash
npm install
npm run test:sql     # sécurité et règles métier sur un Postgres local : tous les tests passent
npm test             # règles de l'assistant, indicateurs : 19 tests
npm run build        # vérification des types + build de production
```
- Les 4 fonctions serveur passent la vérification de types Deno (`deno check`).
- J'ai testé l'interface dans un navigateur avec des données simulées : connexion, formulaire public, tableau de bord, dossier, devis, relances, paramètres, affichage mobile.

**Pas encore testé en conditions réelles :** un vrai projet Supabase, l'envoi par Resend, l'appel à l'API Claude et la réception d'e-mails. C'est la première chose à faire lors de la mise en service (étape 9).

---

## Mise en service (environ 1 h)

### 1. Supabase
1. supabase.com → **New project** (région **Europe**).
2. **SQL Editor** → coller tout [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → URL Configuration** : *Site URL* = l'adresse Netlify de l'application (étape 4), et ajouter la même adresse dans *Redirect URLs*.
4. Pendant les pilotes, il est conseillé de désactiver **Allow new users to sign up** (Authentication → Sign In / Providers). Tu crées alors toi-même les comptes des pilotes (Authentication → Users → *Invite user*).

### 2. E-mails (Resend)
1. resend.com → ajouter et **vérifier un domaine** (enregistrements DNS SPF / DKIM fournis par Resend).
2. Créer une clé API.

### 3. Fonctions serveur
```bash
cd suivio
npx supabase login
npx supabase link --project-ref VOTRE_PROJET
npx supabase functions deploy assistant send
npx supabase functions deploy followups inbound --no-verify-jwt
npx supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  RESEND_API_KEY=re_... \
  EMAIL_FROM=devis@votre-domaine.fr \
  CRON_SECRET=$(openssl rand -hex 24) \
  INBOUND_SECRET=$(openssl rand -hex 24) \
  APP_ORIGIN=https://votre-app.netlify.app
```
Facultatif :
- `ANTHROPIC_MODEL` : par défaut `claude-opus-5-5`, avec un effort réduit pour limiter le coût.
- `INBOUND_DOMAIN` : voir l'étape 6.

### 4. Application web (Netlify)
New site → même dépôt GitHub → **Base directory** : `suivio`. Variables d'environnement :
- `VITE_SUPABASE_URL` = Project URL
- `VITE_SUPABASE_ANON_KEY` = clé *anon public*

### 5. Relances automatiques
Dans [`supabase/cron.sql`](supabase/cron.sql), remplacer `VOTRE_PROJET` et `REMPLACER_PAR_CRON_SECRET` par la même valeur que le secret, puis l'exécuter dans le SQL Editor.

### 6. Réponses des clients par e-mail (facultatif mais recommandé)
- Avec `INBOUND_DOMAIN=in.votre-domaine.fr`, les e-mails partent avec l'adresse de réponse `reply+<jeton>@in.votre-domaine.fr`.
- Configurer la réception de ce domaine chez votre fournisseur. Pour chaque e-mail reçu, appeler :
  ```
  POST https://VOTRE_PROJET.supabase.co/functions/v1/inbound
  En-tête : x-inbound-secret: <INBOUND_SECRET>
  Corps   : { "to": "...", "from": "...", "text": "..." }
  ```
  Un scénario n8n (déclencheur e-mail → requête HTTP) suffit.
- La réponse rejoint l'historique du dossier et les relances s'arrêtent.
- Sans cette étape, l'équipe clique « Enregistrer une réponse du client » : l'effet est le même.

### 7. Premier client pilote
1. Ouvrir l'application → recevoir le lien de connexion → **Créer votre espace**.
2. **Paramètres** : zone d'intervention, horaires, modèles de messages, inviter l'équipe.
3. Copier le **lien du formulaire client** (ou le code d'intégration) pour le site de l'entreprise.

### 8. Développement local
```bash
cd suivio && cp .env.example .env   # renseigner les deux valeurs
npm install && npm run dev          # http://localhost:5173
```

### 9. Recette avant le premier pilote (à faire une fois en réel)
1. Déposer une demande via le formulaire public → elle apparaît dans « Demandes ».
2. « Préparer le résumé » → vérifier que la source affichée est « IA ».
3. Envoyer une réponse à **ta propre adresse** → la recevoir, puis y répondre → la réponse apparaît dans l'historique (si l'étape 6 est faite).
4. Associer un devis → programmer les relances → mettre la 1re échéance à maintenant dans Supabase (Table editor) → attendre 15 min → relance reçue.
5. Passer le devis en « Accepté » → les relances restantes passent en « Annulée ».

## Coûts techniques (hypothèses)
- Supabase Pro : ~25 $/mois. Netlify : gratuit au démarrage.
- Resend : gratuit jusqu'à 3 000 e-mails/mois, puis offre payante.
- IA : environ 0,07 $ par analyse avec Claude Opus 5.5 (tarifs publics, octobre 2026). `ANTHROPIC_MODEL=claude-sonnet-5-5` divise ce coût par deux environ ; à comparer sur la qualité des résumés en français.

## À faire avant une commercialisation plus large
- Facturation des abonnements (Stripe).
- SMS.
- Interface anglaise complète.
- Mise à jour en direct entre plusieurs utilisateurs.
- Pagination au-delà de 2 000 dossiers.
- Supervision des erreurs (Sentry).
- Conditions générales et contrat de sous-traitance RGPD. Ces documents se rédigent avec un juriste : les fonctions techniques ci-dessus facilitent la conformité, elles ne la garantissent pas.
