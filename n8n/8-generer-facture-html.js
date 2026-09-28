// Génère la facture HTML Medina Fusion (convertie en PDF à l'étape suivante)
// ⚙️ Les prix du site sont-ils TTC (TVA comprise) ? true = oui, false = ce sont des prix HT
const PRIX_SITE_TTC = false;
const TVA = 0.10;

const prev = $input.first().json;
const cmd = $('2. Normaliser Commande').first().json;
const items = Array.isArray(cmd.items) ? cmd.items : [];
const numero = prev.id_commande || ('CMD' + Date.now());

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = (n) => Math.round(n * 100) / 100;
const eur = (n) => r2(n).toFixed(2).replace('.', ',') + ' €';
const dateFr = (iso) => (iso && iso.includes('-') ? iso.split('-').reverse().join('/') : iso || '-');
const aujourdhui = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

const lignes = items.map((i) => {
  const q = Number(i.quantite || 0);
  const pu = Number(i.prix_unitaire || 0);
  const puHT = PRIX_SITE_TTC ? pu / (1 + TVA) : pu;
  return { nom: i.nom, q, puHT, totalHT: r2(puHT * q) };
});
const sousTotalHT = r2(lignes.reduce((s, l) => s + l.totalHT, 0));
const montantTVA = r2(sousTotalHT * TVA);
const totalTTC = r2(sousTotalHT + montantTVA);

const td = 'padding:10px 12px;border-bottom:1px solid #e5e5e5;';
const lignesHtml = lignes.length
  ? lignes.map((l, i) =>
      '<tr style="background:' + (i % 2 ? '#fafafa' : '#fff') + '">' +
      '<td style="' + td + '">' + esc(l.nom) + '</td>' +
      '<td style="' + td + 'text-align:center">' + l.q + '</td>' +
      '<td style="' + td + 'text-align:right">' + eur(l.puHT) + '</td>' +
      '<td style="' + td + 'text-align:right;font-weight:bold">' + eur(l.totalHT) + '</td></tr>'
    ).join('')
  : '<tr><td colspan="4" style="' + td + 'text-align:center;color:#888">Aucune prestation</td></tr>';

const bloc = (titre, contenu) =>
  '<div style="flex:1;padding:14px 16px;background:#faf7f2;border-radius:8px">' +
  '<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#b7791f;font-weight:bold;margin-bottom:6px">' + titre + '</div>' +
  contenu + '</div>';

const facture_html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Facture ' + esc(numero) + '</title></head>' +
'<body style="margin:0;padding:36px 42px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#222">' +

// En-tête
'<table style="width:100%;border-collapse:collapse"><tr>' +
'<td style="vertical-align:top">' +
'<div style="font-family:Georgia,serif;font-size:30px;font-weight:bold;color:#b7791f;letter-spacing:1px">MEDINA FUSION</div>' +
'<div style="color:#555;margin-top:4px;line-height:1.5">Traiteur libano-tunisien<br>288 rue Étienne Marcel, 93170 Bagnolet<br>SIRET : 948 772 264 0001<br>Medina.fusion93@gmail.com · 06 62 28 68 43</div></td>' +
'<td style="vertical-align:top;text-align:right">' +
'<div style="font-size:26px;font-weight:bold;color:#111">FACTURE</div>' +
'<div style="margin-top:6px;line-height:1.6">N° <b>' + esc(numero) + '</b><br>Date d’émission : <b>' + aujourdhui + '</b></div></td>' +
'</tr></table>' +
'<div style="height:3px;background:#b7791f;margin:20px 0"></div>' +

// Client + livraison
'<div style="display:flex;gap:16px;margin-bottom:22px">' +
bloc('Facturé à',
  '<b style="font-size:15px">' + esc(cmd.entreprise) + '</b><br>' + esc(cmd.contact) +
  (cmd.email ? '<br>' + esc(cmd.email) : '') + (cmd.telephone ? '<br>' + esc(cmd.telephone) : '')) +
bloc('Livraison',
  'Date : <b>' + esc(dateFr(cmd.date_livraison)) + '</b><br>' + esc(cmd.adresse || '-') +
  (cmd.notes ? '<br><i style="color:#666">Remarques : ' + esc(cmd.notes) + '</i>' : '')) +
'</div>' +

// Tableau des prestations
'<table style="width:100%;border-collapse:collapse">' +
'<thead><tr style="background:#111;color:#fff">' +
'<th style="padding:10px 12px;text-align:left">Désignation</th>' +
'<th style="padding:10px 12px;text-align:center;width:70px">Qté</th>' +
'<th style="padding:10px 12px;text-align:right;width:120px">Prix unit. HT</th>' +
'<th style="padding:10px 12px;text-align:right;width:120px">Total HT</th>' +
'</tr></thead><tbody>' + lignesHtml + '</tbody></table>' +

// Totaux
'<table style="width:300px;margin:18px 0 0 auto;border-collapse:collapse;font-size:14px">' +
'<tr><td style="padding:6px 0;color:#555">Sous-total HT</td><td style="padding:6px 0;text-align:right">' + eur(sousTotalHT) + '</td></tr>' +
'<tr><td style="padding:6px 0;color:#555">TVA 10 %</td><td style="padding:6px 0;text-align:right">' + eur(montantTVA) + '</td></tr>' +
'<tr><td colspan="2" style="padding:0"><div style="margin-top:8px;padding:12px 14px;background:#b7791f;color:#fff;border-radius:6px;display:flex;justify-content:space-between;font-size:18px;font-weight:bold">' +
'<span>TOTAL TTC</span><span>' + eur(totalTTC) + '</span></div></td></tr></table>' +

// Pied de page
'<div style="margin-top:40px;padding-top:14px;border-top:1px solid #e5e5e5;color:#888;font-size:11px;text-align:center;line-height:1.6">' +
'Merci pour votre confiance ! · MEDINA FUSION — 288 rue Étienne Marcel, 93170 Bagnolet — SIRET 948 772 264 0001</div>' +
'</body></html>';

return [{ json: { ...prev, facture_html, sous_total_ht: sousTotalHT, tva: montantTVA, total_ttc: totalTTC } }];
