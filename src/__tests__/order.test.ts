import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data/config', async (orig) => {
  const mod = await orig<typeof import('../data/config')>();
  return {
    ...mod,
    WEBHOOKS: { commande: 'https://hook.test/commande', degustation: 'https://hook.test/degustation', timeoutMs: 50 },
  };
});

import { buildMessage, buildPayload, mailtoUrl, postToWebhook, whatsappUrl } from '../lib/order';
import { validate } from '../lib/validation';
import type { CustomerInfo } from '../types';

const info: CustomerInfo = {
  entreprise: ' ACME ',
  contact: 'Sam',
  email: 'sam@acme.fr',
  tel: '06 12 34 56 78',
  date: '2099-01-15',
  adresse: '1 rue de Paris',
  parrain: '',
  notes: 'Sans noix',
};
const lines = [{ id: 'houmous', nom: 'Houmous', quantite: 2, prix_unitaire: 6 }];

describe('payload n8n', () => {
  it('respecte le format attendu', () => {
    const p = buildPayload(info, lines, 12, 'commande');
    expect(p).toEqual({
      entreprise: 'ACME',
      contact: 'Sam',
      email: 'sam@acme.fr',
      tel: '06 12 34 56 78',
      date: '2099-01-15',
      adresse: '1 rue de Paris',
      notes: 'Sans noix',
      items: [{ nom: 'Houmous', quantite: 2, prix_unitaire: 6 }],
      total: 12,
      type: 'commande',
    });
    expect(buildPayload({ ...info, parrain: 'Foo' }, [], 0, 'degustation').parrain).toBe('Foo');
  });

  it('construit email et WhatsApp', () => {
    const p = buildPayload(info, lines, 12, 'commande');
    expect(buildMessage(p)).toContain('• 2 × Houmous');
    expect(buildMessage(p)).toMatch(/TOTAL TTC : 13,20\s€/);
    expect(buildMessage(p)).toContain('15/01/2099');
    expect(mailtoUrl(p)).toMatch(/^mailto:Medina\.fusion93@gmail\.com\?subject=/);
    expect(whatsappUrl(p)).toMatch(/^https:\/\/wa\.me\/33662286843\?text=/);
  });
});

describe('postToWebhook', () => {
  afterEach(() => vi.useRealTimers());
  const p = buildPayload(info, lines, 12, 'commande');

  it('succès sur 2xx, POST JSON vers la bonne URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(postToWebhook(p, fetchMock)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://hook.test/commande');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(p);
  });

  it('route la dégustation vers son webhook', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    await postToWebhook({ ...p, type: 'degustation' }, fetchMock);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://hook.test/degustation');
  });

  it('échec sur non-2xx, erreur réseau et timeout', async () => {
    await expect(postToWebhook(p, vi.fn().mockResolvedValue(new Response('', { status: 500 })))).resolves.toBe(false);
    await expect(postToWebhook(p, vi.fn().mockRejectedValue(new TypeError('network')))).resolves.toBe(false);
    const hanging = vi.fn(
      (_u: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))),
    );
    await expect(postToWebhook(p, hanging)).resolves.toBe(false);
  });
});

describe('validation', () => {
  it('commande : champs requis + formats', () => {
    expect(validate(info, 'commande')).toEqual({});
    const errs = validate({ ...info, email: 'nope', tel: '12', date: '2000-01-01', contact: '' }, 'commande');
    expect(Object.keys(errs).sort()).toEqual(['contact', 'date', 'email', 'tel']);
  });

  it('dégustation : entreprise + (email ou téléphone)', () => {
    const empty = { ...info, email: '', tel: '', contact: '', date: '', adresse: '' };
    expect(validate(empty, 'degustation')).toHaveProperty('email');
    expect(validate({ ...empty, tel: '0612345678' }, 'degustation')).toEqual({});
    expect(validate({ ...empty, entreprise: '', email: 'a@b.fr' }, 'degustation')).toHaveProperty('entreprise');
  });
});
