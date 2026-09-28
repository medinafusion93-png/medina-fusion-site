import { CONTACT, TVA_RATE, WEBHOOKS } from '../data/config';
import type { CartLine, CustomerInfo, OrderPayload, OrderType } from '../types';
import { formatPrice, round2 } from './format';

export function buildPayload(
  info: CustomerInfo,
  lines: CartLine[],
  total: number,
  type: OrderType,
): OrderPayload {
  const payload: OrderPayload = {
    entreprise: info.entreprise.trim(),
    contact: info.contact.trim(),
    email: info.email.trim(),
    tel: info.tel.trim(),
    date: info.date,
    adresse: info.adresse.trim(),
    notes: info.notes.trim(),
    items: lines.map(({ nom, quantite, prix_unitaire }) => ({ nom, quantite, prix_unitaire })),
    total,
    type,
  };
  const parrain = info.parrain.trim();
  if (parrain) payload.parrain = parrain;
  return payload;
}

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export function buildSubject(p: OrderPayload): string {
  const label = p.type === 'degustation' ? 'Demande de dégustation gratuite' : 'Commande traiteur';
  return `${label} — ${p.entreprise || 'Nouveau client'}${p.date ? ` — ${formatDate(p.date)}` : ''}`;
}

/** Corps texte commun email + WhatsApp */
export function buildMessage(p: OrderPayload): string {
  const out: string[] = [];
  if (p.type === 'degustation') {
    out.push('Bonjour Medina Fusion,', '', 'Nous souhaitons demander une dégustation gratuite.', '');
  } else {
    out.push('Bonjour Medina Fusion,', '', 'Voici notre commande traiteur :', '');
    for (const l of p.items) {
      out.push(`• ${l.quantite} × ${l.nom} — ${formatPrice(l.quantite * l.prix_unitaire)} HT`);
    }
    const tva = round2(p.total * TVA_RATE);
    out.push(
      '',
      `Sous-total HT : ${formatPrice(p.total)}`,
      `TVA 10 % : ${formatPrice(tva)}`,
      `TOTAL TTC : ${formatPrice(round2(p.total + tva))}`,
      '',
    );
  }
  out.push('— Coordonnées —');
  const field = (label: string, value?: string) => {
    if (value) out.push(`${label} : ${value}`);
  };
  field('Entreprise', p.entreprise);
  field('Contact', p.contact);
  field('Email', p.email);
  field('Téléphone', p.tel);
  field('Date souhaitée', formatDate(p.date));
  field('Adresse de livraison', p.adresse);
  field('Recommandé par', p.parrain);
  field('Remarques', p.notes);
  out.push('', 'Merci !');
  return out.join('\n');
}

export function mailtoUrl(p: OrderPayload): string {
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(buildSubject(p))}&body=${encodeURIComponent(buildMessage(p))}`;
}

export function whatsappUrl(p: OrderPayload): string {
  return `https://wa.me/${CONTACT.whatsappIntl}?text=${encodeURIComponent(`*${buildSubject(p)}*\n\n${buildMessage(p)}`)}`;
}

/**
 * POST vers le webhook n8n. Renvoie true si 2xx, false sinon
 * (URL absente, timeout, erreur réseau, statut non-2xx) → l’appelant bascule sur mailto.
 */
export async function postToWebhook(
  p: OrderPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const url = p.type === 'degustation' ? WEBHOOKS.degustation : WEBHOOKS.commande;
  if (!url) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOKS.timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
