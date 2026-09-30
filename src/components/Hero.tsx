import { ASSETS, CONTACT } from '../data/config';
import TastingButton from './TastingButton';

export default function Hero() {
  return (
    <header className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.18),transparent_60%)]"
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 pb-12 pt-10 text-center sm:pt-14">
        <img
          src={ASSETS.logo}
          alt="Logo Medina Fusion"
          width={128}
          height={128}
          className="h-24 w-24 animate-fade-up rounded-full border-2 border-gold bg-white object-cover shadow-xl shadow-gold/20 sm:h-32 sm:w-32"
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />

        <h1 className="text-gold-gradient mt-6 animate-fade-up font-display text-4xl font-extrabold tracking-wide sm:text-6xl">
          MEDINA FUSION
        </h1>
        <p className="mt-3 animate-fade-up text-base font-medium uppercase tracking-[0.2em] text-gold-light [animation-delay:120ms] sm:text-lg">
          Traiteur libano-tunisien
        </p>

        <div className="mt-5 flex animate-fade-up flex-wrap justify-center gap-2 [animation-delay:200ms]">
          <a
            href={CONTACT.googleAvisUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/5 px-4 py-2 text-sm text-neutral-100 transition hover:border-gold hover:bg-white/10"
          >
            <span className="text-gold" aria-hidden="true">
              ★★★★★
            </span>
            <span>
              <strong className="text-white">{CONTACT.googleNote}/5</strong> sur Google · {CONTACT.googleAvis} avis
            </span>
          </a>
          <a
            href={CONTACT.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-white/5 px-4 py-2 text-sm text-neutral-100 transition hover:border-gold hover:bg-white/10"
          >
            <span>
              <strong className="text-white">{CONTACT.instagramAbonnes}</strong> abonnés Instagram
            </span>
          </a>
        </div>

        <p className="mt-6 max-w-xl animate-fade-up text-base leading-relaxed text-neutral-300 [animation-delay:280ms] sm:text-lg">
          Cuisine fait maison pour vos réunions, séminaires et événements d’entreprise.{' '}
          <strong className="text-white">Commande instantanée, pas de devis à attendre</strong> : composez votre
          commande, envoyez, c’est livré.
        </p>

        <div className="mt-8 flex w-full animate-fade-up flex-col gap-3 [animation-delay:360ms] sm:w-auto sm:flex-row">
          <a href="#carte" className="btn-gold">
            Découvrir nos Offres
          </a>
          <TastingButton />
        </div>
      </div>
    </header>
  );
}
