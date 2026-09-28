# Codes des étapes n8n — workflow « Medina Fusion - Commande Traiteur »

| Fichier | Étape n8n | Rôle |
|---|---|---|
| `2-normaliser-commande.js` | 2. Normaliser Commande (Code) | Lit le JSON du site, ajoute `type`, `parrain`, `resume_cuisine_html` (bon de cuisine) |
| `8-generer-facture-html.js` | 8. Générer Facture HTML (Code) | Facture détaillée : lignes, HT, TVA 10 %, TTC → `facture_html` |

Étape « Prévenir la cuisine » (Gmail) : Type d'e-mail = HTML, Message = `{{ $json.resume_cuisine_html }}`.

`PRIX_SITE_TTC` (étape 8) : `true` si les prix affichés sur le site sont TTC.
