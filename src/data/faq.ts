import { CONTACT } from './config';

/** Questions fréquentes — textes à ajuster librement */
export const FAQ: { q: string; r: string }[] = [
  {
    q: 'Quel est le délai pour commander ?',
    r: `Passez commande au moins ${CONTACT.delaiMinJours * 24} h avant la date souhaitée. Pour une demande plus urgente, appelez-nous ou écrivez-nous sur WhatsApp au ${CONTACT.whatsappAffiche}.`,
  },
  {
    q: 'À partir de combien de personnes livrez-vous ?',
    r: `Nous livrons à partir de ${CONTACT.minPersonnesLivraison} personnes. Certaines formules ont un minimum plus élevé, indiqué sur chaque carte.`,
  },
  {
    q: 'Où livrez-vous ?',
    r: `Nous sommes basés à Bagnolet (${CONTACT.adresse}). Indiquez votre adresse dans le formulaire : nous vous confirmons la livraison avec votre commande.`,
  },
  {
    q: 'Les prix sont-ils HT ou TTC ?',
    r: 'Les prix affichés sont hors taxes. La TVA à 10 % s’ajoute ; le total TTC est détaillé dans votre panier avant l’envoi.',
  },
  {
    q: 'Proposez-vous des options végétariennes et sans gluten ?',
    r: 'Oui : assiette végétarienne aux falafels, plateaux sans gluten (végétarien ou viande). Le simulateur « Votre menu selon votre budget » les répartit automatiquement.',
  },
  {
    q: 'Comment signaler une allergie ?',
    r: 'Précisez-la dans le champ « Remarques » du formulaire : elle apparaît en évidence sur la fiche de notre cuisine. En cas de doute sur un plat, contactez-nous avant de commander.',
  },
  {
    q: 'Puis-je goûter avant de commander ?',
    r: 'Oui, les entreprises peuvent demander une dégustation gratuite via le bouton « Demander une Dégustation Gratuite ».',
  },
  {
    q: 'Comment modifier ou annuler une commande ?',
    r: `Contactez-nous au plus vite par email (${CONTACT.email}) ou sur WhatsApp au ${CONTACT.whatsappAffiche}.`,
  },
];
