// Tests de la logique pure de la fonction serveur (aucun appel réseau, aucun envoi)
import { describe, expect, it } from 'vitest';
import {
  ajouterJoursOuvres, autoriseParRobots, construireMime, dansFenetre, extraireEmails, lireResultats, piedDeMessage, remplir, urlRecherche,
} from '../../supabase/functions/prospection/index';

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const deB64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

describe('fonction prospection : API Recherche d’entreprises', () => {
  it('construit l’URL officielle near_point avec les filtres de catégorie', () => {
    const u = new URL(urlRecherche({ lat: 48.8693, lon: 2.4181, rayon: 2, categorie: 'formation' }));
    expect(u.origin + u.pathname).toBe('https://recherche-entreprises.api.gouv.fr/near_point');
    expect(u.searchParams.get('long')).toBe('2.4181');
    expect(u.searchParams.get('radius')).toBe('2');
    expect(u.searchParams.get('activite_principale')).toBe('85.59A,85.59B');
    expect(u.searchParams.get('etat_administratif')).toBe('A');
    expect(() => urlRecherche({ lat: 0, lon: 0, rayon: 1, categorie: 'inconnue' })).toThrow();
  });

  it('ne reprend que les champs présents dans la réponse (aucune coordonnée inventée)', () => {
    const r = lireResultats({
      total_results: 2,
      total_pages: 1,
      results: [
        {
          siren: '123456789', nom_complet: 'ACME FORMATION', activite_principale: '85.59A', tranche_effectif_salarie: '11',
          matching_etablissements: [{ adresse: '10 RUE X 93170 BAGNOLET', code_postal: '93170', libelle_commune: 'BAGNOLET' }],
          dirigeants: [{ prenoms: 'Jean', nom: 'DUPONT', qualite: 'Président' }],
        },
        { siren: '', nom_complet: 'SANS SIREN' },
      ],
    });
    expect(r.total).toBe(2);
    expect(r.resultats).toHaveLength(1);
    const a = r.resultats[0]!;
    expect(a).toEqual({
      siren: '123456789', nom: 'ACME FORMATION', activite: '', naf: '85.59A', effectif: '10-19', adresse: '10 RUE X 93170 BAGNOLET',
      code_postal: '93170', ville: 'BAGNOLET', dirigeants: ['Jean DUPONT (Président)'],
    });
    expect(Object.keys(a)).not.toContain('email');
    expect(lireResultats(null)).toEqual({ resultats: [], total: 0, pages: 0 });
  });
});

describe('fonction prospection : e-mails publics', () => {
  it('extrait les adresses, écarte les faux positifs, privilégie le domaine du site', () => {
    const html = `<a href="mailto:Contact@acme.fr">écrire</a> photo@2x.png info@gmail.com rh&#64;acme.fr test@example.com`;
    expect(extraireEmails(html, 'www.acme.fr')).toEqual(['contact@acme.fr', 'rh@acme.fr', 'info@gmail.com']);
  });
  it('respecte robots.txt', () => {
    const robots = 'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /contact\n';
    expect(autoriseParRobots(robots, '/contact')).toBe(false);
    expect(autoriseParRobots(robots, '/mentions-legales')).toBe(true);
    expect(autoriseParRobots('', '/contact')).toBe(true);
  });
});

describe('fonction prospection : calendrier d’envoi', () => {
  it('fenêtre horaire de Paris, jours ouvrés seulement', () => {
    expect(dansFenetre(new Date('2026-10-05T08:30:00Z'), 9, 18)).toBe(true); // lundi 10 h 30 Paris
    expect(dansFenetre(new Date('2026-10-05T06:30:00Z'), 9, 18)).toBe(false); // 8 h 30
    expect(dansFenetre(new Date('2026-10-03T10:00:00Z'), 9, 18)).toBe(false); // samedi
  });
  it('relance à +5 jours ouvrés', () => {
    expect(ajouterJoursOuvres(new Date('2026-10-02T10:00:00Z'), 5).toISOString().slice(0, 10)).toBe('2026-10-09');
  });
});

describe('fonction prospection : message', () => {
  it('variables et pied de message obligatoire', () => {
    expect(remplir('Bonjour {{ entreprise }} de {{ville}}{{inconnue}}', { entreprise: 'ACME', ville: 'Bagnolet' })).toBe('Bonjour ACME de Bagnolet');
    const pied = piedDeMessage({ entreprise: 'ACME', adresse: '288 rue Étienne Marcel, 93170 Bagnolet', lienDesinscription: 'https://mf.fr/desinscription?t=x' });
    expect(pied).toContain('Medina Fusion — 288 rue Étienne Marcel');
    expect(pied).toContain('Vous recevez ce message car ACME');
    expect(pied).toContain('gratuit, immédiat) : https://mf.fr/desinscription?t=x');
  });
  it('MIME : expéditeur configurable encodé, désinscription en en-tête, texte + HTML', () => {
    const raw = construireMime({
      deNom: 'Imad – Medina Fusion', deEmail: 'imad@mf.fr', a: 'contact@acme.fr', objet: 'Dégustation offerte', texte: 'Bonjour é',
      html: '<p>Bonjour é</p>', lienDesinscription: 'https://mf.fr/desinscription?t=x',
    });
    const mime = deB64(raw.replace(/-/g, '+').replace(/_/g, '/'));
    expect(mime).toContain(`From: =?UTF-8?B?${b64('Imad – Medina Fusion')}?= <imad@mf.fr>`);
    expect(mime).toContain('To: <contact@acme.fr>');
    expect(mime).toContain('List-Unsubscribe: <https://mf.fr/desinscription?t=x>');
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).toContain('Content-Type: text/html; charset=UTF-8');
    expect(mime).toContain(b64('Bonjour é'));
  });
});
