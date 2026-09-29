import { describe, expect, it } from 'vitest';
import {
  apercu, domaine, joursOuvres, messageLinkedIn, MODELE, parisVersUtc, planifier, selectionner, statsCampagne, trouverDoublon,
  type Envoi, type Prospect,
} from '../admin/prospection';
import type { Commande } from '../admin/types';

const P = (x: Partial<Prospect>): Prospect => ({
  id: Math.random().toString(36).slice(2), created_at: '', token: '11111111-2222-3333-4444-555555555555', siren: null, nom: 'ACME',
  categorie: '', activite: '', naf: '', effectif: '', adresse: '', code_postal: '', ville: '', site: '', email: '', email_statut: 'a_trouver',
  email_source: '', telephone: '', linkedin_entreprise: '', contact_nom: '', contact_fonction: '', linkedin_contact: '', source: '',
  collecte_le: '', statut: 'nouveau', notes: '', client_id: null, ...x,
});

describe('prospection : doublons', () => {
  const existants = [P({ id: 'a', siren: '123456789', nom: 'Atelier Graphique SARL', code_postal: '93100', email: 'contact@atelier.fr', site: 'https://www.atelier.fr/contact' })];
  it('par SIREN, e-mail, domaine du site, nom + code postal', () => {
    expect(trouverDoublon({ siren: '123456789' }, existants)?.raison).toBe('même SIREN');
    expect(trouverDoublon({ email: 'CONTACT@atelier.fr' }, existants)?.raison).toBe('même e-mail');
    expect(trouverDoublon({ site: 'atelier.fr' }, existants)?.raison).toBe('même site');
    expect(trouverDoublon({ nom: 'Atelier graphique', code_postal: '93100' }, existants)?.raison).toBe('même nom et code postal');
    expect(trouverDoublon({ nom: 'Autre', siren: '987654321' }, existants)).toBeNull();
    expect(trouverDoublon({ id: 'a', siren: '123456789' }, existants)).toBeNull();
  });
  it('domaine', () => {
    expect(domaine('https://www.exemple.fr/page')).toBe('exemple.fr');
    expect(domaine('exemple.fr')).toBe('exemple.fr');
    expect(domaine('')).toBe('');
  });
});

describe('prospection : sélection des destinataires', () => {
  it('écarte sans e-mail, rejetés, exclus, arrêtés, déjà contactés et doublons d’adresse', () => {
    const ok = P({ id: 'ok', email: 'a@x.fr', email_statut: 'trouvee' });
    const s = selectionner(
      [
        ok,
        P({ id: 'sans' }),
        P({ id: 'rej', email: 'b@x.fr', email_statut: 'rejetee' }),
        P({ id: 'exc', email: 'c@x.fr', email_statut: 'verifiee' }),
        P({ id: 'stop', email: 'd@x.fr', email_statut: 'verifiee', statut: 'repondu' }),
        P({ id: 'deja', email: 'e@x.fr', email_statut: 'verifiee' }),
        P({ id: 'dbl', email: 'A@x.fr', email_statut: 'verifiee' }),
      ],
      new Set(['c@x.fr']),
      new Set(['deja']),
    );
    expect(s.retenus.map((p) => p.id)).toEqual(['ok']);
    expect(s.ecartes.map((e) => e.prospect.id)).toEqual(['sans', 'rej', 'exc', 'stop', 'deja', 'dbl']);
  });
});

describe('prospection : calendrier', () => {
  it('jours ouvrés (saute le week-end)', () => {
    // vendredi 2 oct. 2026
    expect(joursOuvres('2026-10-02', 3)).toEqual(['2026-10-02', '2026-10-05', '2026-10-06']);
    expect(joursOuvres('2026-10-03', 1)).toEqual(['2026-10-05']);
  });
  it('heure de Paris → UTC (été et hiver)', () => {
    expect(parisVersUtc('2026-07-01', 9).toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(parisVersUtc('2026-12-01', 9).toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });
  it('répartit selon la limite quotidienne et estime les relances à J+5 ouvrés', () => {
    const ps = Array.from({ length: 5 }, (_, i) => P({ id: `p${i}`, email: `p${i}@x.fr` }));
    const plan = planifier(ps, '2026-10-02', 2, 9, true);
    expect(plan.jours).toEqual([
      { date: '2026-10-02', nb: 2 },
      { date: '2026-10-05', nb: 2 },
      { date: '2026-10-06', nb: 1 },
    ]);
    expect(plan.relances.map((r) => r.date)).toEqual(['2026-10-09', '2026-10-12', '2026-10-13']);
    expect(plan.envois[4]!.planifie_pour).toBe('2026-10-06T07:00:00.000Z');
    expect(planifier(ps, '2026-10-02', 2, 9, false).relances).toEqual([]);
  });
});

describe('prospection : messages', () => {
  it('aperçu : variables, lien de dégustation suivi et pied de message obligatoire', () => {
    const m = apercu(P({ nom: 'ACME' }), { site_url: 'https://mf.fr/', expediteur_nom: 'Imad – Medina Fusion', adresse_postale: '288 rue Étienne Marcel, 93170 Bagnolet' }, MODELE.objet, MODELE.corps);
    expect(m.objet).toContain('ACME');
    expect(m.texte).toContain('https://mf.fr/?pf=11111111-2222-3333-4444-555555555555#commande');
    expect(m.texte).toContain('dégustation gratuite pour 2 personnes, sur rendez-vous et après confirmation');
    expect(m.texte).toContain('https://mf.fr/desinscription?t=11111111-2222-3333-4444-555555555555');
    expect(m.texte).toContain('Vous recevez ce message car ACME');
    expect(m.texte).not.toMatch(/\{\{/);
  });
  it('le modèle n’invente aucune relation antérieure', () => {
    expect(`${MODELE.corps} ${MODELE.corps_relance}`).not.toMatch(/comme convenu|suite à notre|notre échange|notre conversation|vous nous avez/i);
  });
  it('message LinkedIn à copier', () => {
    expect(messageLinkedIn({ nom: 'ACME', contact_nom: 'Sarah Martin' }, 'https://mf.fr', 'Imad – Medina Fusion')).toMatch(/^Bonjour Sarah,/);
  });
});

describe('prospection : statistiques réelles', () => {
  const e = (x: Partial<Envoi>): Envoi => ({
    id: Math.random().toString(), created_at: '', campagne_id: 'c1', prospect_id: 'p1', etape: 1, email: 'a@x.fr', statut: 'envoye',
    planifie_pour: '', envoye_le: '2026-10-01', repondu_le: null, erreur: '', ...x,
  });
  const base = { id: 'x', created_at: '', updated_at: '', client_id: null, source: 'site', type: 'commande', statut: 'demande', paiement_statut: 'en_attente', montant_encaisse: 0, date_prestation: null, heure: '', nb_personnes: null, mode: 'livraison', adresse: '', lignes: [], total_ht: 0, tva_taux: 0.1, allergies: '', notes: '', parrain: '', numero_devis: null, numero_facture: null } as Commande;
  it('ne compte que ce qui est enregistré', () => {
    const envois = [
      e({ prospect_id: 'p1', repondu_le: '2026-10-02' }),
      e({ prospect_id: 'p2', email: 'b@x.fr' }),
      e({ prospect_id: 'p2', email: 'b@x.fr', etape: 2 }),
      e({ prospect_id: 'p3', email: 'c@x.fr', statut: 'planifie', envoye_le: null }),
      e({ prospect_id: 'p4', campagne_id: 'autre' }),
    ];
    const prospects = [P({ id: 'p1', statut: 'client' }), P({ id: 'p2', statut: 'desinscrit' }), P({ id: 'p3', statut: 'desinscrit' })];
    const commandes = [
      { ...base, prospect_id: 'p1', type: 'degustation' as const },
      { ...base, prospect_id: 'p1', statut: 'confirmee' as const, total_ht: 250 },
      { ...base, prospect_id: 'p4', statut: 'confirmee' as const, total_ht: 999 },
    ];
    expect(statsCampagne('c1', envois, prospects, commandes)).toEqual({
      prospects: 3, planifies: 1, envoyes: 2, relancesEnvoyees: 1, echecs: 0, annules: 0, reponses: 1,
      desinscrits: 1, rejets: 0, degustations: 1, devis: 0, clients: 1, caHT: 250,
    });
  });
});
