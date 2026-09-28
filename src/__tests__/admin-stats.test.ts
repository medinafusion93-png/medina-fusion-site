import { describe, expect, it } from 'vitest';
import { dashboardStats, matches, montants, periodes, telCle, totalHT } from '../admin/stats';
import type { Commande } from '../admin/types';

const base: Commande = {
  id: 'x', created_at: '', updated_at: '', client_id: null, source: 'admin', type: 'commande', statut: 'confirmee',
  paiement_statut: 'en_attente', montant_encaisse: 0, date_prestation: null, heure: '', nb_personnes: null,
  mode: 'livraison', adresse: '', lignes: [], total_ht: 0, tva_taux: 0.1, allergies: '', notes: '', parrain: '',
  numero_devis: null, numero_facture: null,
};
const c = (p: Partial<Commande>): Commande => ({ ...base, id: Math.random().toString(), ...p });

// Mercredi 14 octobre 2026
const TODAY = new Date(2026, 9, 14);

describe('admin : montants', () => {
  it('HT, TVA 10 %, TTC, encaissé, reste', () => {
    expect(montants({ total_ht: 100, tva_taux: 0.1, montant_encaisse: 30 })).toEqual({ ht: 100, tva: 10, ttc: 110, encaisse: 30, reste: 80 });
    expect(montants({ total_ht: 100, tva_taux: 0.1, montant_encaisse: 200 }).reste).toBe(0);
    expect(totalHT([{ nom: 'a', quantite: 3, prix_unitaire: 15.9 }, { nom: 'b', quantite: 2, prix_unitaire: 4 }])).toBe(55.7);
  });
});

describe('admin : périodes', () => {
  it('semaine du lundi au dimanche, mois civil', () => {
    const p = periodes(TODAY);
    expect(p.jour).toEqual({ debut: '2026-10-14', fin: '2026-10-14' });
    expect(p.semaine).toEqual({ debut: '2026-10-12', fin: '2026-10-18' });
    expect(p.mois).toEqual({ debut: '2026-10-01', fin: '2026-10-31' });
  });
});

describe('admin : tableau de bord', () => {
  const commandes = [
    c({ date_prestation: '2026-10-14', total_ht: 100, montant_encaisse: 110, paiement_statut: 'paye' }), // aujourd’hui, payée
    c({ date_prestation: '2026-10-16', total_ht: 200, statut: 'en_preparation', montant_encaisse: 50 }), // semaine
    c({ date_prestation: '2026-10-28', total_ht: 300, statut: 'livree' }), // mois
    c({ date_prestation: '2026-10-15', total_ht: 1000, statut: 'devis_envoye' }), // devis : pas une vente
    c({ date_prestation: '2026-10-15', total_ht: 500, statut: 'annulee' }), // annulée : exclue
    c({ date_prestation: null, total_ht: 80, statut: 'demande', source: 'site' }), // demande : exclue
  ];
  const s = dashboardStats(commandes, TODAY);

  it('ne compte que confirmée / en préparation / livrée dans les ventes', () => {
    expect(s.jour).toEqual({ nb: 1, ttc: 110 });
    expect(s.semaine).toEqual({ nb: 2, ttc: 330 });
    expect(s.mois).toEqual({ nb: 3, ttc: 660 });
    expect(s.confirmeTTC).toBe(660);
    expect(s.encaisse).toBe(160);
    expect(s.resteAPayer).toBe(500); // 0 + 170 + 330
  });

  it('compte les devis en attente et les demandes à traiter', () => {
    expect(s.devisEnAttente).toBe(1);
    expect(s.devisEnAttenteTTC).toBe(1100);
    expect(s.demandesATraiter).toBe(1);
  });

  it('liste les prochaines prestations (hors annulées / livrées), par date', () => {
    expect(s.prochaines.map((x) => x.date_prestation)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
  });
});

describe('admin : recherche et doublons', () => {
  it('recherche sans accents, multi-mots, par date française', () => {
    expect(matches('societe gene', 'Société Générale')).toBe(true);
    expect(matches('12/10/2026', '2026-10-12')).toBe(true);
    expect(matches('xyz', 'ACME')).toBe(false);
  });
  it('clé téléphone identique pour 06… et +33 6…', () => {
    expect(telCle('06 12 34 56 78')).toBe(telCle('+33 6 12 34 56 78'));
  });
});
