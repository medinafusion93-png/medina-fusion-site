# Codes des étapes n8n — workflow « Medina Fusion - Commande Traiteur »

| Fichier | Étape n8n | Rôle |
|---|---|---|
| `2-normaliser-commande.js` | 2. Normaliser Commande (Code) | Lit le JSON du site ; génère `bon_cuisine_html` (+ étiquette) et `bon_livraison_html`, **sans prix** |
| `8-generer-facture-html.js` | 8. Générer Facture HTML (Code) | Facture détaillée : lignes, HT, TVA 10 %, TTC → `facture_html` |

Étape « Prévenir la cuisine » (Gmail) : Type d'e-mail = HTML, Message = `{{ $json.bon_cuisine_html }}`.

Étape « Prévenir le livreur » (Gmail, après un IF `type = commande`) : Message = `{{ $json.bon_livraison_html }}`.

`PRIX_SITE_TTC` (étape 8) : `false` — les prix du site sont HT, la TVA 10 % est ajoutée.
