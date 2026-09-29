import { CONTACT } from '../data/config';

export default function Footer() {
  return (
    <footer className="border-t border-gold/20 bg-ink-800">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-neutral-300 sm:grid-cols-3 sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-lg font-bold text-gold-light">{CONTACT.nom}</p>
          <p className="mt-1">Traiteur libano-tunisien fait maison</p>
        </div>
        <address className="not-italic">
          <p>{CONTACT.adresse}</p>
          <p className="mt-1">
            <a href={`mailto:${CONTACT.email}`} className="hover:text-gold">
              {CONTACT.email}
            </a>
          </p>
          <p className="mt-1">
            <a href={`https://wa.me/${CONTACT.whatsappIntl}`} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
              WhatsApp : {CONTACT.whatsappAffiche}
            </a>
          </p>
        </address>
        <div>
          <p>🚚 Livraison à partir de {CONTACT.minPersonnesLivraison} personnes</p>
          <p className="mt-1">SIRET : {CONTACT.siret}</p>
          <p className="mt-1">
            <a href={CONTACT.googleAvisUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
              ★ {CONTACT.googleNote}/5 · {CONTACT.googleAvis} avis Google
            </a>
          </p>
          <p className="mt-1">
            <a href={CONTACT.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
              📸 Instagram @{CONTACT.instagram} · {CONTACT.instagramAbonnes} abonnés
            </a>
          </p>
        </div>
      </div>
      <p className="border-t border-white/5 py-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} {CONTACT.nom} — Tous droits réservés
      </p>
    </footer>
  );
}
