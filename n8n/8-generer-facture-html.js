// Génère la facture HTML Medina Fusion (e-mail + conversion PDF à l'étape suivante)
// Mise en page 100 % tableaux + styles en ligne : s'affiche pareil dans Gmail, Outlook et en PDF.
// ⚙️ Les prix du site sont-ils TTC (TVA comprise) ? true = oui, false = ce sont des prix HT
const PRIX_SITE_TTC = false;
const TVA = 0.10;

// ⚙️ Informations légales de l'entreprise (modifier ici uniquement)
const SOCIETE = {
  nom: 'MEDINA FUSION',
  activite: 'Traiteur libano-tunisien',
  adresse: '288 rue Étienne Marcel',
  ville: '93170 Bagnolet',
  forme: 'SAS à associé unique au capital de 1 000 €',
  rcs: 'RCS Bobigny 948 772 264',
  tvaIntra: 'FR20948772264', // numéro de TVA intracommunautaire
  email: 'Medina.fusion93@gmail.com',
  tel: '06 62 28 68 43',
};

const prev = $input.first().json;
const cmd = $('2. Normaliser Commande').first().json;
const items = Array.isArray(cmd.items) ? cmd.items : [];
const numero = prev.id_commande || ('CMD' + Date.now());

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = (n) => Math.round(n * 100) / 100;
const eur = (n) => r2(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
const dateFr = (iso) => (iso && iso.includes('-') ? iso.split('-').reverse().join('/') : iso || '—');
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

// ---------- Styles ----------
const OR = '#b7791f';
const FOND = '#faf7f2';
const police = 'font-family:Helvetica,Arial,sans-serif;';
const etiquette = 'font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:' + OR + ';font-weight:bold;padding-bottom:6px;';
const cell = 'padding:10px 12px;border-bottom:1px solid #e8e2d8;font-size:13px;color:#222;vertical-align:top;';
const th = 'padding:10px 12px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#fff;background:#1c1c1c;';

const bloc = (titre, contenu, cote) =>
  '<td width="50%" style="vertical-align:top;' + (cote === 'g' ? 'padding-right:8px' : 'padding-left:8px') + '">' +
  '<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" style="background:' + FOND + ';border-radius:8px">' +
  '<tr><td style="padding:14px 16px;' + police + 'font-size:13px;line-height:1.6;color:#222">' +
  '<div style="' + etiquette + '">' + titre + '</div>' + contenu + '</td></tr></table></td>';

const lignesHtml = lignes.length
  ? lignes.map((l, i) =>
      '<tr style="background:' + (i % 2 ? '#fcfaf7' : '#ffffff') + '">' +
      '<td style="' + cell + '">' + esc(l.nom) + '</td>' +
      '<td style="' + cell + 'text-align:center">' + l.q + '</td>' +
      '<td style="' + cell + 'text-align:right;white-space:nowrap">' + (l.puHT ? eur(l.puHT) : '—') + '</td>' +
      '<td style="' + cell + 'text-align:right;white-space:nowrap;font-weight:bold">' +
      (l.totalHT ? eur(l.totalHT) : '<span style="color:#2f855a">Offert</span>') + '</td></tr>'
    ).join('')
  : '<tr><td colspan="4" style="' + cell + 'text-align:center;color:#888">Aucune prestation</td></tr>';

const ligneTotal = (libelle, valeur) =>
  '<tr><td style="padding:5px 0;' + police + 'font-size:13px;color:#555">' + libelle + '</td>' +
  '<td style="padding:5px 0;' + police + 'font-size:13px;text-align:right;white-space:nowrap">' + valeur + '</td></tr>';

// ---------- Document ----------
const facture_html =
'<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>Facture ' + esc(numero) + ' — ' + SOCIETE.nom + '</title>' +
'<style>@page{size:A4;margin:14mm}</style></head>' +
'<body style="margin:0;padding:0;background:#ffffff">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;' + police + 'color:#222">' +

// 1. En-tête : émetteur à gauche, titre FACTURE à droite
'<tr><td>' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
'<td style="vertical-align:top">' +
'<div style="font-family:Georgia,serif;font-size:28px;font-weight:bold;color:' + OR + ';letter-spacing:1px">' + SOCIETE.nom + '</div>' +
'<div style="font-size:12px;color:#555;line-height:1.6;margin-top:4px">' + SOCIETE.activite + '<br>' +
SOCIETE.adresse + ', ' + SOCIETE.ville + '<br>' + SOCIETE.forme + '<br>' + SOCIETE.rcs +
(SOCIETE.tvaIntra ? '<br>N° TVA : ' + SOCIETE.tvaIntra : '') + '<br>' + SOCIETE.email + ' · ' + SOCIETE.tel + '</div></td>' +
'<td style="vertical-align:top;text-align:right">' +
'<div style="font-size:30px;font-weight:bold;color:#1c1c1c;letter-spacing:3px">FACTURE</div>' +
'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0 auto;font-size:13px;line-height:1.7">' +
'<tr><td style="color:#555;padding-right:10px;text-align:right">N°</td><td style="font-weight:bold;text-align:right">' + esc(numero) + '</td></tr>' +
'<tr><td style="color:#555;padding-right:10px;text-align:right">Date d’émission</td><td style="font-weight:bold;text-align:right">' + aujourdhui + '</td></tr>' +
'<tr><td style="color:#555;padding-right:10px;text-align:right">Échéance</td><td style="font-weight:bold;text-align:right">À réception</td></tr>' +
'</table></td></tr></table></td></tr>' +

'<tr><td style="padding:18px 0"><div style="height:3px;background:' + OR + ';line-height:3px;font-size:0">&nbsp;</div></td></tr>' +

// 2. Client + prestation
'<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
bloc('Facturé à',
  '<b style="font-size:15px">' + esc(cmd.entreprise || cmd.contact || 'Client') + '</b>' +
  (cmd.entreprise && cmd.contact ? '<br>' + esc(cmd.contact) : '') +
  (cmd.adresse ? '<br>' + esc(cmd.adresse) : '') +
  (cmd.email ? '<br>' + esc(cmd.email) : '') + (cmd.telephone ? '<br>' + esc(cmd.telephone) : ''), 'g') +
bloc('Prestation',
  'Date : <b>' + esc(dateFr(cmd.date_livraison)) + (cmd.heure_livraison ? ' à ' + esc(cmd.heure_livraison) : '') + '</b>' +
  (cmd.nb_plateaux ? '<br>' + esc(cmd.nb_plateaux) + ' plateau(x)' : '') +
  '<br>Livraison : ' + esc(cmd.adresse || '—') +
  (cmd.notes ? '<br><i style="color:#666">Remarques : ' + esc(cmd.notes) + '</i>' : ''), 'd') +
'</tr></table></td></tr>' +

// 3. Détail des prestations
'<tr><td style="padding-top:22px">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
'<thead><tr>' +
'<th align="left" style="' + th + '">Désignation</th>' +
'<th align="center" width="60" style="' + th + '">Qté</th>' +
'<th align="right" width="120" style="' + th + '">Prix unit. HT</th>' +
'<th align="right" width="120" style="' + th + '">Total HT</th>' +
'</tr></thead><tbody>' + lignesHtml + '</tbody></table></td></tr>' +

// 4. Totaux
'<tr><td style="padding-top:18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
'<td></td><td width="300">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
ligneTotal('Sous-total HT', eur(sousTotalHT)) +
ligneTotal('TVA ' + Math.round(TVA * 100) + ' %', eur(montantTVA)) +
'<tr><td colspan="2" style="padding-top:8px">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + OR + ';border-radius:6px"><tr>' +
'<td style="padding:12px 14px;' + police + 'font-size:17px;font-weight:bold;color:#fff">TOTAL TTC</td>' +
'<td style="padding:12px 14px;' + police + 'font-size:19px;font-weight:bold;color:#fff;text-align:right;white-space:nowrap">' + eur(totalTTC) + '</td>' +
'</tr></table></td></tr></table></td></tr></table></td></tr>' +

// 5. Conditions et mentions légales
'<tr><td style="padding-top:28px">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e2d8;border-radius:8px"><tr>' +
'<td style="padding:12px 16px;font-size:11px;line-height:1.6;color:#555">' +
'<div style="' + etiquette + '">Conditions de règlement</div>' +
'Paiement à réception de facture. Moyens de paiement acceptés : virement bancaire, carte bancaire, chèque, espèces ' +
'(dans la limite de 1 000 € entre professionnels). Pas d’escompte pour paiement anticipé.<br>' +
'En cas de retard de paiement : pénalités au taux de 3 fois le taux d’intérêt légal et indemnité forfaitaire pour frais de ' +
'recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce). Prix en euros hors taxes, TVA 10 % en sus.' +
'</td></tr></table></td></tr>' +

// 6. Pied de page
'<tr><td style="padding-top:22px;border-top:1px solid #e8e2d8;text-align:center;font-size:11px;color:#888;line-height:1.6">' +
'Merci pour votre confiance !<br>' + SOCIETE.nom + ' — ' + SOCIETE.adresse + ', ' + SOCIETE.ville + ' — ' + SOCIETE.forme + ' — ' + SOCIETE.rcs + (SOCIETE.tvaIntra ? ' — TVA ' + SOCIETE.tvaIntra : '') +
'</td></tr>' +

'</table></td></tr></table></body></html>';

return [{ json: { ...prev, facture_html, sous_total_ht: sousTotalHT, tva: montantTVA, total_ttc: totalTTC } }];
