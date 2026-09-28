// Normalise les données reçues du site traiteur Medina Fusion
// + prépare 3 documents SANS PRIX : bon cuisine, étiquette colis, bon de livraison
const body = $input.first().json.body || $input.first().json;
const items = Array.isArray(body.items) ? body.items : [];
const type = body.type === 'degustation' ? 'degustation' : 'commande';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dateFr = (iso) => (iso && iso.includes('-') ? iso.split('-').reverse().join('/') : iso || '-');
const nbArticles = items.reduce((s, i) => s + Number(i.quantite || 0), 0);
const nbPlateaux = items
  .filter((i) => /plateau|assiette/i.test(i.nom || ''))
  .reduce((s, i) => s + Number(i.quantite || 0), 0);
const date = dateFr(body.date);
const adresse = body.adresse || 'Adresse non renseignée';
const maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(body.adresse || '');

const font = 'font-family:Arial,Helvetica,sans-serif;';
const h3 = (t) => '<h3 style="margin:18px 0 6px;font-size:15px;letter-spacing:1px;text-transform:uppercase;color:#111">' + t + '</h3>';
const ligne = (label, valeur) =>
  '<tr><td style="padding:5px 0;color:#666;width:130px;vertical-align:top">' + label +
  '</td><td style="padding:5px 0;font-weight:bold;color:#111">' + valeur + '</td></tr>';
const alerte = body.notes
  ? '<div style="margin:14px 0;padding:12px 14px;background:#fef2f2;border-left:5px solid #dc2626;color:#991b1b;font-size:16px"><b>⚠️ REMARQUES / ALLERGIES :</b><br>' + esc(body.notes) + '</div>'
  : '';
const listePlats = (couleur, avecCases) =>
  '<table style="width:100%;border-collapse:collapse">' +
  items.map((i) =>
    '<tr style="border-bottom:1px solid #eee">' +
    (avecCases ? '<td style="width:28px;font-size:20px;color:#999">☐</td>' : '') +
    '<td style="padding:9px 10px;font-size:22px;font-weight:bold;color:' + couleur + ';width:60px;text-align:center;background:#fff7ed">' + esc(i.quantite) + '</td>' +
    '<td style="padding:9px 10px;font-size:17px;color:#111">' + esc(i.nom) + '</td></tr>'
  ).join('') + '</table>';
const cadre = (couleur, titre, contenu) =>
  '<div style="' + font + 'max-width:600px;margin:0 auto 24px;border:2px solid ' + couleur + ';border-radius:10px;overflow:hidden">' +
  '<div style="background:' + couleur + ';color:#fff;padding:14px 18px;font-size:20px;font-weight:bold">' + titre + '</div>' +
  '<div style="padding:16px 18px">' + contenu + '</div></div>';
const bandeauDate = (extra) =>
  '<div style="background:#111;color:#fff;padding:12px 14px;border-radius:6px;font-size:18px">📅 <b>' + esc(date) + '</b>' + (extra || '') + '</div>';

// ---------- 1. BON DE CUISINE (sans prix) ----------
let bonCuisine;
if (type === 'degustation') {
  bonCuisine = cadre('#7c3aed', '🎁 DEMANDE DE DÉGUSTATION',
    '<p style="font-size:16px;margin:0 0 10px">Aucun plat à préparer pour l’instant : le client souhaite une <b>dégustation gratuite</b>. À recontacter pour fixer un rendez-vous.</p>' +
    alerte + h3('Client') + '<table style="width:100%;font-size:15px">' +
    ligne('Entreprise', esc(body.entreprise || '-')) + ligne('Contact', esc(body.contact || '-')) +
    ligne('Téléphone', esc(body.tel || '-')) + ligne('Email', esc(body.email || '-')) + '</table>');
} else {
  bonCuisine = cadre('#d97706', '🍽️ BON DE CUISINE',
    bandeauDate('<br><span style="font-size:15px">Client : ' + esc(body.entreprise || '-') + '</span>') +
    h3('À préparer') + listePlats('#d97706', true) +
    '<p style="margin:6px 0 0;color:#666;font-size:13px">Total : ' + nbArticles + ' article(s)' + (nbPlateaux ? ' dont ' + nbPlateaux + ' plateau(x)' : '') + '</p>' +
    alerte);
}

// ---------- 2. ÉTIQUETTE À COLLER SUR LA COMMANDE (sans prix) ----------
const etiquette = type === 'degustation' ? '' :
  '<div style="' + font + 'max-width:420px;margin:0 auto 24px;border:3px dashed #111;border-radius:12px;padding:18px 20px">' +
  '<div style="text-align:center;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#b7791f;letter-spacing:1px">MEDINA FUSION</div>' +
  '<div style="text-align:center;font-size:11px;color:#888;margin-bottom:12px">✂️ Étiquette à découper et coller sur la commande</div>' +
  '<div style="font-size:24px;font-weight:bold;text-align:center;color:#111">' + esc(body.entreprise || '-') + '</div>' +
  '<div style="text-align:center;font-size:15px;color:#333;margin-top:2px">' + esc(body.contact || '') + '</div>' +
  '<div style="margin:12px 0;padding:8px;background:#111;color:#fff;text-align:center;border-radius:6px;font-size:16px">📅 ' + esc(date) + '</div>' +
  '<div style="font-size:14px;color:#111;line-height:1.6">' + items.map((i) => '☐ <b>' + esc(i.quantite) + ' ×</b> ' + esc(i.nom)).join('<br>') + '</div>' +
  (body.notes ? '<div style="margin-top:10px;padding:8px;border:2px solid #dc2626;color:#991b1b;font-size:14px;border-radius:6px"><b>⚠️ ' + esc(body.notes) + '</b></div>' : '') +
  '<div style="text-align:center;margin-top:12px;font-size:13px;color:#666">Bon appétit ! 😊</div></div>';

// ---------- 3. BON DE LIVRAISON (sans prix) ----------
const bonLivraison = type === 'degustation' ? '' : cadre('#2563eb', '🚚 BON DE LIVRAISON',
  bandeauDate() +
  h3('Adresse') +
  '<div style="font-size:18px;font-weight:bold;color:#111">📍 ' + esc(adresse) + '</div>' +
  (body.adresse ? '<p style="margin:8px 0 0"><a href="' + maps + '" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Ouvrir dans Google Maps</a></p>' : '') +
  h3('Contact sur place') + '<table style="width:100%;font-size:15px">' +
  ligne('Entreprise', esc(body.entreprise || '-')) + ligne('Contact', esc(body.contact || '-')) +
  ligne('Téléphone', body.tel ? '<a href="tel:' + esc(String(body.tel).replace(/\s/g, '')) + '" style="color:#2563eb">' + esc(body.tel) + '</a>' : '-') +
  '</table>' +
  h3('À livrer') +
  '<div style="font-size:17px;margin-bottom:8px"><b>' + nbArticles + '</b> article(s)' + (nbPlateaux ? ' dont <b>' + nbPlateaux + ' plateau(x) repas</b>' : '') + '</div>' +
  listePlats('#2563eb', true) + alerte +
  '<div style="margin-top:18px;padding:12px;border:1px solid #ddd;border-radius:6px;font-size:14px;color:#333">☐ Livré à ______ h ______ &nbsp;&nbsp; Signature client : ______________________</div>');

const bonCuisineHtml = bonCuisine + (etiquette ? '<div style="' + font + 'text-align:center;color:#888;font-size:12px;margin:0 0 8px">— Étiquette à imprimer —</div>' + etiquette : '');

return [{
  json: {
    type: type,
    entreprise: body.entreprise || 'Non renseigne',
    contact: body.contact || 'Non renseigne',
    email: body.email || '',
    telephone: body.tel || '',
    date_livraison: body.date || '',
    adresse: body.adresse || '',
    notes: body.notes || '',
    parrain: body.parrain || '',
    items: items, // [{nom, quantite, prix_unitaire}]
    total_vente: body.total || 0,
    nb_articles: nbArticles,
    nb_plateaux: nbPlateaux,
    bon_cuisine_html: bonCuisineHtml,
    bon_livraison_html: bonLivraison,
    // ancien nom conservé pour ne rien casser
    resume_cuisine_html: bonCuisineHtml
  }
}];
