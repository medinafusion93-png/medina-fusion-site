import { useEffect, type ReactNode } from 'react';
import { CONTACT, HEBERGEUR, TVA_RATE } from '../data/config';

function Section({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="font-display text-2xl font-bold text-gold-light">{titre}</h2>
      {children}
    </section>
  );
}

function Article({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-white">{titre}</h3>
      <div className="mt-1 space-y-2">{children}</div>
    </div>
  );
}

const tva = `${Math.round(TVA_RATE * 100)} %`;

/** Page publique /mentions-legales : mentions légales, CGV, politique de confidentialité */
export default function MentionsLegales() {
  useEffect(() => {
    document.title = 'Mentions légales, CGV et confidentialité · Medina Fusion';
    if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView();
  }, []);

  return (
    <main className="mx-auto max-w-3xl space-y-12 px-4 py-10 text-sm leading-relaxed text-neutral-300 sm:px-6">
      <header>
        <a href="/" className="text-xs text-neutral-400 underline">
          ← Retour au site
        </a>
        <p className="mt-4 font-display text-3xl font-bold text-gold-light">{CONTACT.nom}</p>
        <nav className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Sommaire">
          {[
            ['#mentions', 'Mentions légales'],
            ['#cgv', 'Conditions générales de vente'],
            ['#confidentialite', 'Confidentialité'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full border border-gold/40 px-3 py-1 hover:border-gold">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="mentions" titre="Mentions légales">
        <Article titre="Éditeur du site">
          <p>
            {CONTACT.nom}, {CONTACT.formeJuridique} au capital de {CONTACT.capital}
            <br />
            Siège social : {CONTACT.adresse}
            <br />
            {CONTACT.rcs} · N° TVA intracommunautaire : {CONTACT.tvaIntra}
            <br />
            E-mail : {CONTACT.email} · Téléphone : {CONTACT.whatsappAffiche}
          </p>
          <p>Directrice de la publication : {CONTACT.presidente}, Présidente.</p>
        </Article>
        <Article titre="Hébergement">
          <p>
            {HEBERGEUR.nom}, {HEBERGEUR.adresse} — {HEBERGEUR.site}
          </p>
        </Article>
        <Article titre="Propriété intellectuelle">
          <p>
            Les textes, photographies, logos et éléments graphiques de ce site sont la propriété de {CONTACT.nom}. Toute reproduction sans
            autorisation écrite est interdite.
          </p>
        </Article>
      </Section>

      <Section id="cgv" titre="Conditions générales de vente">
        <Article titre="1. Champ d’application">
          <p>
            Les présentes conditions s’appliquent aux prestations de traiteur (plateaux repas, buffets, formules, boissons, desserts, matériel
            et accessoires) commandées auprès de {CONTACT.nom} via le site, par e-mail ou par WhatsApp. Elles s’adressent principalement aux
            professionnels (entreprises, associations, organismes).
          </p>
        </Article>
        <Article titre="2. Commande">
          <p>
            La commande est envoyée depuis le site avec la date, l’heure et l’adresse de livraison. Elle devient définitive après
            confirmation de notre part (e-mail, téléphone ou devis accepté). Les commandes doivent être passées au moins{' '}
            {CONTACT.delaiMinJours * 24} h avant la prestation. La livraison est assurée à partir de {CONTACT.minPersonnesLivraison} personnes ;
            certaines formules ont un minimum indiqué sur leur fiche.
          </p>
        </Article>
        <Article titre="3. Prix">
          <p>
            Les prix sont indiqués en euros hors taxes. La TVA applicable ({tva} pour la restauration) est ajoutée et détaillée dans le
            panier, le devis et la facture. Les prix applicables sont ceux en vigueur au jour de la commande.
          </p>
        </Article>
        <Article titre="4. Paiement">
          <p>
            Paiement à réception de facture, par virement bancaire, carte bancaire, chèque ou espèces (espèces limitées à 1 000 € entre
            professionnels). Pas d’escompte pour paiement anticipé. Tout retard de paiement entraîne des pénalités au taux de 3 fois le taux
            d’intérêt légal et, pour les professionnels, une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5
            du Code de commerce).
          </p>
        </Article>
        <Article titre="5. Livraison">
          <p>
            Les commandes sont livrées à l’adresse et à l’heure convenues. Le client s’assure qu’une personne est présente pour la
            réception et signale immédiatement toute anomalie (produit manquant ou endommagé) au livreur ou par téléphone.
          </p>
        </Article>
        <Article titre="6. Modification et annulation">
          <p>
            Toute modification ou annulation doit être signalée le plus tôt possible par e-mail ou WhatsApp. Une annulation moins de{' '}
            {CONTACT.delaiMinJours * 24} h avant la prestation peut donner lieu à la facturation des denrées déjà achetées ou préparées.
          </p>
        </Article>
        <Article titre="7. Matériel">
          <p>
            Les chauffe-plats mis à disposition restent la propriété de {CONTACT.nom}. Ils sont installés à la livraison et récupérés après
            la prestation. Le matériel perdu ou endommagé peut être facturé à son prix de remplacement.
          </p>
        </Article>
        <Article titre="8. Allergènes et conservation">
          <p>
            Les allergènes (parmi les 14 allergènes majeurs) sont indiqués sous chaque plat. Le client signale toute allergie ou restriction
            dans le champ « Remarques » de la commande. Les plats froids doivent être conservés au réfrigérateur (entre 0 et 4 °C) et les
            plats doivent être consommés le jour de la livraison.
          </p>
        </Article>
        <Article titre="9. Droit de rétractation">
          <p>
            Conformément à l’article L221-28 du Code de la consommation, le droit de rétractation ne s’applique pas à la fourniture de
            denrées susceptibles de se détériorer rapidement ni aux prestations de restauration fournies à une date déterminée.
          </p>
        </Article>
        <Article titre="10. Litiges">
          <p>
            Les présentes conditions sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité ;
            à défaut, entre professionnels, le tribunal de commerce de Bobigny est compétent.
          </p>
        </Article>
      </Section>

      <Section id="confidentialite" titre="Politique de confidentialité">
        <Article titre="Responsable du traitement">
          <p>
            {CONTACT.nom}, {CONTACT.adresse} — {CONTACT.email}.
          </p>
        </Article>
        <Article titre="Données collectées et finalités">
          <p>
            Lors d’une commande ou d’une demande de dégustation : nom de l’entreprise, nom du contact, e-mail, téléphone, adresse de
            livraison, date, heure et remarques. Ces données servent à traiter la commande, préparer la livraison, établir les devis et
            factures, et assurer le suivi client (base légale : exécution du contrat).
          </p>
          <p>
            Prospection : nous pouvons contacter des professionnels à partir de coordonnées professionnelles publiques pour leur présenter
            notre offre traiteur (base légale : intérêt légitime). Chaque message contient un lien de désinscription gratuit et immédiat ;
            les adresses désinscrites ne sont plus jamais contactées.
          </p>
        </Article>
        <Article titre="Durées de conservation">
          <p>
            Données clients : 3 ans après le dernier contact. Factures : 10 ans (obligation comptable). Prospects sans réponse : 3 ans
            après le dernier contact. Liste d’opposition : conservée pour garantir l’absence de nouveau contact.
          </p>
        </Article>
        <Article titre="Destinataires">
          <p>
            Les données sont réservées à {CONTACT.nom} et à ses prestataires techniques (hébergement du site et de la base de données,
            messagerie, génération des factures), qui les traitent uniquement pour notre compte. Aucune donnée n’est vendue ni cédée.
          </p>
        </Article>
        <Article titre="Vos droits">
          <p>
            Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, de portabilité et d’opposition, notamment à
            la prospection. Pour les exercer : {CONTACT.email}. Vous pouvez aussi adresser une réclamation à la CNIL (www.cnil.fr).
          </p>
        </Article>
        <Article titre="Cookies">
          <p>
            Ce site n’utilise ni cookie publicitaire ni outil de mesure d’audience. Seul votre panier est mémorisé dans votre navigateur
            pour ne pas le perdre ; il n’est jamais transmis tant que vous n’envoyez pas votre commande.
          </p>
        </Article>
      </Section>
    </main>
  );
}
