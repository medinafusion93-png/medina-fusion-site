// Normalise les données reçues du site traiteur Medina Fusion
// + prépare le bon de commande cuisine (email HTML)
const body = $input.first().json.body || $input.first().json;
const items = Array.isArray(body.items) ? body.items : [];
const type = body.type === 'degustation' ? 'degustation' : 'commande';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eur = (n) => Number(n || 0).toFixed(2).replace('.', ',') + ' €';
const dateFr = (iso) => (iso && iso.includes('-') ? iso.split('-').reverse().join('/') : iso || '-');
const nbArticles = items.reduce((s, i) => s + Number(i.quantite || 0), 0);

// ---- Version texte (secours) ----
const resume = [
  type === 'degustation' ? 'DEMANDE DE DEGUSTATION GRATUITE' : 'NOUVELLE COMMANDE TRAITEUR',
  '',
  ...items.map((i) => i.quantite + ' x ' + i.nom),
  '',
  'Livraison : ' + dateFr(body.date) + ' - ' + (body.adresse || '-'),
  'Client : ' + (body.entreprise || '-') + ' / ' + (body.contact || '-') + ' / ' + (body.tel || '-'),
  'Remarques : ' + (body.notes || '-'),
].join('\n');

// ---- Bon de commande cuisine (HTML) ----
const ligne = (label, valeur) =>
  '<tr><td style="padding:6px 0;color:#666;width:150px;vertical-align:top">' + label +
  '</td><td style="padding:6px 0;font-weight:bold;color:#111">' + esc(valeur || '-') + '</td></tr>';

const titre = type === 'degustation' ? '🎁 DEMANDE DE DÉGUSTATION' : '🍽️ BON DE COMMANDE CUISINE';
const couleur = type === 'degustation' ? '#7c3aed' : '#d97706';

const tableauPlats = items.length
  ? '<table style="width:100%;border-collapse:collapse;margin:8px 0 4px">' +
    items.map((i) =>
      '<tr style="border-bottom:1px solid #eee">' +
      '<td style="padding:10px 12px;font-size:22px;font-weight:bold;color:' + couleur + ';width:70px;text-align:center;background:#fff7ed">' + esc(i.quantite) + '</td>' +
      '<td style="padding:10px 12px;font-size:17px;color:#111">' + esc(i.nom) + '</td></tr>'
    ).join('') +
    '</table><p style="margin:4px 0 0;color:#666;font-size:13px">Total : ' + nbArticles + ' article(s)</p>'
  : '<p style="font-size:16px;color:#111">Aucun plat à préparer : le client souhaite <b>une dégustation gratuite</b>. À recontacter pour fixer un rendez-vous.</p>';

const alerte = body.notes
  ? '<div style="margin:16px 0;padding:12px 14px;background:#fef2f2;border-left:5px solid #dc2626;color:#991b1b;font-size:16px"><b>⚠️ REMARQUES / ALLERGIES :</b><br>' + esc(body.notes) + '</div>'
  : '';

const resumeHtml =
  '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;border:2px solid ' + couleur + ';border-radius:10px;overflow:hidden">' +
  '<div style="background:' + couleur + ';color:#fff;padding:14px 18px;font-size:20px;font-weight:bold">' + titre + '</div>' +
  '<div style="padding:16px 18px">' +
  '<div style="background:#111;color:#fff;padding:12px 14px;border-radius:6px;font-size:18px">📅 <b>' + esc(dateFr(body.date)) + '</b>' +
  '<br><span style="font-size:15px">📍 ' + esc(body.adresse || 'Adresse non renseignée') + '</span></div>' +
  (items.length ? '<h3 style="margin:18px 0 4px;font-size:16px;text-transform:uppercase;color:#111">À préparer</h3>' : '') +
  tableauPlats + alerte +
  '<h3 style="margin:18px 0 4px;font-size:16px;text-transform:uppercase;color:#111">Client</h3>' +
  '<table style="width:100%;font-size:15px">' +
  ligne('Entreprise', body.entreprise) + ligne('Contact', body.contact) +
  ligne('Téléphone', body.tel) + ligne('Email', body.email) +
  (body.parrain ? ligne('Recommandé par', body.parrain) : '') +
  (type === 'commande' ? ligne('Montant', eur(body.total)) : '') +
  '</table></div></div>';

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
    resume_cuisine: resume,
    resume_cuisine_html: resumeHtml
  }
}];
