# Medina Fusion — Site Traiteur

React 19 + TypeScript (strict) + Tailwind CSS 3, build Vite. Déploiement Netlify (`netlify.toml`).

## Démarrer

```bash
npm install
cp .env.example .env   # URLs des webhooks n8n
npm run dev            # http://localhost:5173
npm test               # tests unitaires (catalogue, panier, payload, validation)
npm run build          # typecheck + build → dist/
```

## Où modifier quoi

| Besoin | Fichier |
|---|---|
| Prix, produits, formules | `src/data/products.ts` (garder les `id` stables) |
| Coordonnées, SIRET, lien avis Google | `src/data/config.ts` |
| URLs webhooks | variables d'environnement (voir ci-dessous) |
| Images | `public/banner.jpg`, `public/logo.png`, `public/plateaux/{signature,shawarma,vegetarienne,sans-gluten}.jpg` |

Une image absente n'empêche pas l'affichage (repli visuel automatique).

## Webhooks n8n

| Variable | Rôle |
|---|---|
| `VITE_WEBHOOK_COMMANDE_URL` | POST des commandes (`type: "commande"`) |
| `VITE_WEBHOOK_DEGUSTATION_URL` | Optionnel. Si vide, la dégustation part sur le webhook commande avec `type: "degustation"` |
| `VITE_WEBHOOK_TIMEOUT_MS` | Délai avant fallback (défaut 10000) |

Sur Netlify : *Site configuration → Environment variables*, puis redéployer (Vite injecte les variables au build).

Flux d'envoi : POST JSON → si 2xx, écran de confirmation + panier vidé ; sinon (timeout, réseau, non-2xx, URL absente) → message d'erreur + ouverture du mailto pré-rempli. WhatsApp reste un lien `wa.me` direct, indépendant du webhook.

Le workflow n8n doit accepter le CORS depuis le domaine du site (option *Allowed Origins* du nœud Webhook).
