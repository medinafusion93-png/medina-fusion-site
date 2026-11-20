import { CONTACT } from '../data/config';

const POINTS = [
  {
    titre: 'Facture en règle',
    texte: 'Prix affichés HT, TVA à 10 % détaillée sur la facture, avec nos numéros SIREN et TVA.',
  },
  {
    titre: 'Paiement à réception de facture',
    texte: 'Par virement, carte bancaire ou chèque. Rien à avancer au moment de commander.',
  },
  {
    titre: 'Administrations et collectivités',
    texte: 'Facturation sur Chorus Pro, avec votre bon de commande.',
  },
  {
    titre: 'Simple à organiser',
    texte: `Commande ${CONTACT.delaiMinJours * 24} h à l’avance, livraison dans vos locaux dès ${CONTACT.minPersonnesLivraison} personnes.`,
  },
];

/** Ce que vérifie un acheteur pro avant de commander */
export default function Reassurance() {
  return (
    <section aria-labelledby="reassurance-titre" className="rounded-3xl border border-white/10 bg-ink-800 p-6 sm:p-8">
      <h2 id="reassurance-titre" className="section-title">
        Commander pour votre entreprise
      </h2>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2">
        {POINTS.map((p) => (
          <li key={p.titre} className="border-l-2 border-gold pl-4">
            <h3 className="font-semibold text-white">{p.titre}</h3>
            <p className="mt-1 text-sm leading-relaxed text-neutral-300">{p.texte}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
