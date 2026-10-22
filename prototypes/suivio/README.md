# Suivio HVAC — prototype de démonstration

> **Suivio** est un nom provisoire. La disponibilité du nom de domaine et de la marque n'a pas été vérifiée.
> Produit de la marque **Medina Fusion Solution**.

**Promesse :** « Centralisez vos demandes, préparez vos réponses et suivez chaque devis jusqu'à une décision du client. »
Le produit complète le logiciel métier existant (devis, facturation, planning). Il ne le remplace pas.

---

## 1. Lancer le prototype

Aucun serveur, aucune dépendance : un seul fichier HTML.

```bash
# depuis la racine du dépôt
open prototypes/suivio/index.html          # macOS
xdg-open prototypes/suivio/index.html      # Linux
# ou : npx serve prototypes/suivio
```

- `app.html` : source (c'est aussi la version publiée en Artifact).
- `index.html` : document autonome généré par `./build.sh`. Le relancer après toute modification de `app.html`.
- Le dossier `prototypes/` est hors du build Vite : le site Medina Fusion n'est pas affecté.
- L'état de la démo est conservé dans le navigateur (localStorage). Bouton **Réinitialiser la démo** pour revenir aux 12 dossiers d'origine.

## 2. Ce qui fonctionne / ce qui est simulé

| Fonction | État |
|---|---|
| Formulaire client → création du dossier → apparition au tableau de bord | ✅ Fonctionne |
| Tableau de bord (6 indicateurs calculés en direct, liste « À traiter ») | ✅ Fonctionne |
| Liste des demandes : filtres par statut, besoin, recherche | ✅ Fonctionne |
| Fiche dossier : modifier, statut, responsable, prochaine action, notes internes, historique | ✅ Fonctionne |
| Devis : saisie manuelle (référence, montant HT, date, échéance), 6 statuts | ✅ Fonctionne |
| Relances : séquence configurable, aperçu, validation, suspension, arrêt, anti-doublon | ✅ Fonctionne |
| Arrêt automatique des relances (réponse client, changement de statut du devis, expiration) | ✅ Fonctionne |
| Rôles (Admin / Gestion / Lecture) avec droits appliqués à l'interface | ✅ Fonctionne (sans authentification) |
| Interface FR / EN | ✅ Structure en place (interface traduite en partie, contenus en français) |
| **Assistant IA** (résumé, extraction, infos manquantes, catégorie, brouillon) | 🟣 **Simulé** par des règles locales. Aucun appel à un modèle. |
| Signalement des situations potentiellement urgentes | 🟣 Simulé (mots-clés). Aucun diagnostic. |
| Détection des consignes injectées dans un message client | 🟣 Simulé (motifs). Le texte reste traité comme une donnée. |
| Envoi des réponses et relances (e-mail, SMS) | 🟣 **Simulé**. Rien ne sort du navigateur. |
| Réponse du client | 🟣 Simulée par un bouton dans la fiche dossier |
| Passage du temps | 🟣 Bouton « Avancer d'un jour » (date simulée : 22 oct. 2026) |
| Connexions (e-mail, SMS, logiciel de devis, agenda) | Indiquées « Simulé » ou « Non connecté » dans Paramètres |
| Paiement | ❌ Aucun |

**Données de démo :** entreprise fictive « Calora Services », 12 dossiers, 7 devis sur les 6 statuts, 4 séquences de relances (active, suspendue, 2 arrêtées). Les cas prévus pour la démo :
`D-1042` urgent (pas de chauffage + bébé), `D-1050` message avec consigne injectée, `D-1051` hors zone, `D-1044` relances à valider, `D-1049` devis expiré.

**Garde-fous de l'assistant (prototype et MVP) :** il ne propose ni prix, ni créneau, ni diagnostic, ni garantie. Rien ne part sans validation humaine. Avant validation, le message est contrôlé : un montant, une gratuité, un jour ou un horaire déclenche un avertissement à confirmer. Un brouillon pour une situation urgente contient une zone « à compléter par un humain » qui bloque la validation.

### Parcours de démonstration (suivi automatique sur le tableau de bord)

1. Formulaire client → « Remplir avec un exemple » → Envoyer.
2. La demande apparaît (indicateur « Nouvelles demandes » +1).
3. Ouvrir le dossier depuis le panneau « Parcours de démonstration ».
4. Lire le résumé → « Préparer une réponse » → Valider.
5. « Associer un devis » → saisir un montant → Enregistrer.
6. « Programmer une relance » → aperçu des 3 messages → créer.
7. « Simuler une réponse client » → la séquence s'arrête automatiquement.
8. Retour au tableau de bord : les indicateurs sont à jour, le parcours affiche 8/8.

---

## 3. Architecture

### Prototype (ce dépôt)
Un fichier HTML + JavaScript sans framework. Objectif : démontrer en rendez-vous, sans compte ni serveur, et sans risque d'envoi réel.

### MVP pour 2 à 5 clients pilotes — choix recommandé
Même pile que les outils Medina Fusion déjà en place (React + TypeScript + Vite, Netlify, Supabase, n8n), pour ne pas multiplier les technologies à maintenir seul :

| Brique | Choix | Pourquoi |
|---|---|---|
| Interface | React + TypeScript + Tailwind (Vite), Netlify | Déjà maîtrisé sur le site traiteur |
| Base de données + authentification | Supabase (Postgres, hébergement UE) | Auth intégrée, **Row Level Security** pour isoler chaque entreprise par `tenant_id` |
| Logique serveur | Supabase Edge Functions | Clés API (IA, e-mail, SMS) uniquement côté serveur |
| IA | API Claude, appelée depuis une Edge Function | Sorties structurées (JSON validé). Le texte client est passé comme donnée, jamais comme instruction |
| Relances | `pg_cron` + table de file d'attente avec clé d'idempotence | Pas de doublon même en cas de reprise après erreur |
| E-mail / SMS | Fournisseur transactionnel (ex. Brevo, Resend) | Webhooks de réponse pour arrêter les relances |
| Automatisations spécifiques | n8n (optionnel) | Imports CSV, connecteurs à la demande |

### Indispensable avant d'ouvrir le MVP à des pilotes
- Authentification (e-mail + lien magique), invitation des membres.
- Séparation stricte des données : `tenant_id` sur chaque table + politiques RLS + tests automatiques d'isolation.
- Rôles et droits vérifiés **côté serveur** (pas seulement dans l'interface).
- Journal des actions non modifiable (qui, quoi, quand).
- Sauvegardes quotidiennes (incluses Supabase Pro), test de restauration documenté.
- Export (CSV / JSON) et suppression des données d'une entreprise ou d'un client final.
- Secrets uniquement côté serveur, rotation possible.
- Gestion des erreurs : nouvelles tentatives avec délai croissant, file des envois en échec visible par l'admin.
- Contrôle des coûts : plafond mensuel d'appels IA et de SMS par entreprise, alerte à 80 %.

### Avant une commercialisation plus large
Facturation de l'abonnement (Stripe), réception des e-mails entrants (adresse dédiée par entreprise), connecteurs vers 1 ou 2 logiciels métier du secteur (à choisir selon les pilotes), supervision (Sentry, alertes), conditions générales et DPA, interface anglaise complète, documentation d'aide.

### À vérifier selon le pays (avec un juriste — non couvert par ce prototype)
- **France / UE :** RGPD (rôle de sous-traitant, contrat art. 28, registre, durée de conservation, droits des personnes, hébergement et transferts hors UE des fournisseurs IA/e-mail/SMS), règles CNIL sur les relances par e-mail et SMS, obligations de transparence de l'AI Act sur les contenus générés.
- **Belgique, Suisse, Québec :** loi locale de protection des données (LPD suisse, Loi 25 au Québec).
- **Marchés anglophones :** UK GDPR, CASL (Canada), règles SMS américaines (TCPA) si les États-Unis sont visés.

Ces fonctions techniques facilitent la conformité, elles ne la garantissent pas.

---

## 4. Modèle économique (hypothèses à tester)

### Coûts techniques estimés
Hypothèses par entreprise cliente : 150 demandes/mois, 3 appels IA par demande (~3 000 tokens en entrée, ~600 en sortie chacun), 600 e-mails, 100 SMS.

Coût IA par demande (tarifs API publics, octobre 2026) :
- Claude Opus 5.5 (4 $ / 20 $ par million de tokens) : ~0,07 $ → ~11 $/mois par client
- Claude Sonnet 5.5 (2 $ / 10 $) : ~0,036 $ → ~5,4 $/mois par client
- Claude Haiku 5.5 (0,10 $ / 0,50 $) : ~0,002 $ → ~0,30 $/mois par client

À mesurer sur les pilotes : la qualité des résumés en français détermine le modèle retenu.

| Poste (€/mois, estimations) | 5 clients | 10 clients | 30 clients |
|---|---|---|---|
| Hébergement fixe (Supabase Pro, Netlify, domaine, supervision) | ~60 | ~60 | ~120 |
| IA (base Sonnet 5.5) | ~25 | ~50 | ~150 |
| E-mail transactionnel | ~0–15 | ~20 | ~40 |
| SMS (~0,07 €/SMS, 100/client) | ~35 | ~70 | ~210 |
| **Total technique** | **~130** | **~200** | **~520** |

Le coût principal n'est pas technique : c'est votre temps d'installation et de support. À suivre en heures par client.

### Offre initiale proposée

| | **Logiciel seul** | **Accompagné (agence)** |
|---|---|---|
| Installation | 390 € (configuration, import, modèles) | 990 € (audit du parcours devis, modèles rédigés, formation) |
| Abonnement | **290 €/mois** HT | **690 €/mois** HT |
| Inclus | 3 utilisateurs, 300 demandes/mois, 1 000 e-mails, 100 SMS, IA incluse | Idem + revue mensuelle des devis en attente, ajustement des relances, point mensuel de 30 min, rapport mensuel |
| Support | E-mail, réponse sous 1 jour ouvré, pas de téléphone | E-mail prioritaire + visio mensuelle |
| Dépassements | 0,10 €/demande au-delà de 300, 0,09 €/SMS, 19 €/utilisateur supplémentaire | Idem |
| Engagement | Mensuel | 3 mois minimum |

### 790 €/mois est-il justifiable ?
- **Logiciel seul : non, pas au départ.** L'outil complète un logiciel métier déjà payé ; sans intégration ni historique de résultats, 790 € sera comparé au prix de ce logiciel. À demander pendant les entretiens : combien paient-ils aujourd'hui pour leur logiciel de devis ?
- **Offre accompagnée : possible, à une condition.** Pour une entreprise de 1 à 3 M€, un devis d'installation signé en plus par mois peut représenter plus que 790 € de marge, mais **seulement si les pilotes le mesurent**. Sans mesure, ne pas l'affirmer.
- **Positionnement recommandé :** démarrer à 290 € (logiciel) et 690 € (accompagné). Monter vers 790 € quand au moins deux pilotes montrent une amélioration mesurée (délai de réponse, taux de décision sur les devis).

---

## 5. Validation commerciale

### Démo en 3 minutes
| Temps | Montrer | Message |
|---|---|---|
| 0:00–0:30 | Tableau de bord | « Le matin, vous voyez ce qui attend une action. Rien d'autre. » |
| 0:30–1:00 | Formulaire client → nouvelle demande | « Toutes les demandes arrivent au même endroit, avec les infos utiles. » |
| 1:00–1:45 | Fiche dossier : résumé, infos manquantes, brouillon | « L'assistant prépare, vous validez. Il ne donne jamais de prix ni de créneau. » Montrer `D-1042` (urgent) et `D-1050` (consigne ignorée). |
| 1:45–2:30 | Associer un devis → programmer les relances | « Les relances partent seules après votre validation. » |
| 2:30–3:00 | Réponse simulée → relances arrêtées, indicateurs à jour | « Le client répond, les relances s'arrêtent. Pas de relance gênante. » |

### 5 questions à poser au dirigeant
1. Par quels canaux arrivent vos demandes aujourd'hui, et combien par semaine ?
2. Combien de devis envoyés le mois dernier sont encore sans réponse ? Comment le savez-vous ?
3. Qui relance les devis, quand, et que se passe-t-il quand cette personne est absente ?
4. Quel logiciel utilisez-vous pour les devis, et combien vous coûte-t-il par mois ?
5. Si vous pouviez changer une seule chose dans le traitement des demandes, ce serait quoi ?

### Proposition de pilote payant
- Durée : 8 semaines, 2 entreprises.
- Prix : 390 € de mise en place (déduits de l'installation en cas de poursuite) + 190 €/mois pendant le pilote.
- Inclus : configuration, import des devis en cours, 2 points de suivi.
- Engagement du client : saisir ses devis dans l'outil, 20 min d'entretien au début et à la fin.
- Sortie libre à la fin, export des données fourni.

### Indicateurs avant / après
Mesurer les 4 semaines précédentes (à partir de leurs e-mails et du logiciel de devis), puis pendant le pilote :
- Délai médian de première réponse.
- Part des demandes traitées sans aller-retour pour informations manquantes.
- Part des devis ayant reçu une décision (accepté ou refusé) avant échéance.
- Nombre de devis expirés sans relance.
- Temps hebdomadaire passé sur les relances (déclaratif).
- Usage réel : connexions par semaine, part des brouillons validés.

### Critères de décision à la fin du pilote
- **Continuer** si au moins 1 des 2 entreprises passe en abonnement payant ET le délai de réponse ou le taux de décision s'améliore nettement (objectif indicatif : −30 % de délai ou +15 points de décisions).
- **Modifier** si l'outil est utilisé mais sans effet mesurable : revoir le canal (e-mail entrant, SMS) ou le moment du parcours visé.
- **Arrêter ou pivoter** si l'outil n'est plus ouvert après 3 semaines, ou si aucun pilote n'accepte de payer.

Aucune hausse de ventes n'est promise tant qu'elle n'est pas mesurée.
