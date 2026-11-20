import { motion } from 'framer-motion';
import { ASSETS, CONTACT } from '../data/config';
import TastingButton from './TastingButton';

const LIGNES = ['Le traiteur', 'libano-tunisien', 'de vos réunions'];
const EASE = [0.22, 1, 0.36, 1] as const;

/** En-tête : titre animé ligne par ligne + photo d’un plateau dans une arche de médina */
export default function Hero() {
  return (
    <header className="relative overflow-hidden">
      {/* Barre de marque */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-3">
          <img
            src={ASSETS.logo}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-full border-2 border-gold bg-white object-cover"
            onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
          />
          <span className="font-display text-2xl font-extrabold leading-none text-white">
            Medina Fusion
            <span className="block font-sans text-xs font-semibold text-gold-light">Traiteur entreprises</span>
          </span>
        </a>
        <a href="#commande" className="btn-gold hidden sm:inline-flex">
          Commander
        </a>
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:px-8 lg:pb-20 lg:pt-10">
        <div>
          <h1 className="font-display text-[clamp(3rem,7.5vw,6.5rem)] font-black leading-[0.9] text-white">
            {LIGNES.map((ligne, i) => (
              <span key={ligne} className="block overflow-hidden whitespace-nowrap pb-[0.04em]">
                <motion.span
                  className={`inline-block ${i === 1 ? 'text-gold' : ''}`}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.8, ease: EASE }}
                >
                  {ligne}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-300">
              Plateaux repas, buffets et brunchs faits maison pour vos réunions et séminaires.{' '}
              <strong className="text-white">Composez votre commande, envoyez, c’est livré</strong>, dès{' '}
              {CONTACT.minPersonnesLivraison} personnes.
            </p>

            <ul className="mt-6 flex flex-wrap gap-2 text-sm">
              <li>
                <a
                  href={CONTACT.googleAvisUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full border border-white/25 px-4 py-2 text-neutral-100 transition hover:border-gold"
                >
                  <strong className="mr-1 text-white">{CONTACT.googleNote}/5</strong> sur {CONTACT.googleAvis} avis Google
                </a>
              </li>
              <li>
                <a
                  href={CONTACT.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full border border-white/25 px-4 py-2 text-neutral-100 transition hover:border-gold"
                >
                  <strong className="mr-1 text-white">{CONTACT.instagramAbonnes}</strong> abonnés Instagram
                </a>
              </li>
              <li className="inline-flex rounded-full border border-white/25 px-4 py-2 text-neutral-100">Viande halal</li>
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#carte" className="btn-gold px-7 text-base">
                Composer ma commande
              </a>
              <TastingButton />
            </div>
          </motion.div>
        </div>

        {/* Arche */}
        <motion.figure
          className="relative mx-auto w-full max-w-[440px]"
          initial={{ clipPath: 'inset(100% -24px -24px -24px)' }}
          animate={{ clipPath: 'inset(-24px -24px -24px -24px)' }}
          transition={{ delay: 0.3, duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
        >
          <div className="overflow-hidden rounded-t-full rounded-b-3xl bg-ink-800 shadow-[0_0_0_10px_#1c1814,0_0_0_12px_#e8590c]">
            <motion.img
              src="/plateaux/shawarma.jpg"
              alt="Plateau Shawarma Medina Fusion"
              className="aspect-[4/5] w-full object-cover"
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 1.6, ease: EASE }}
              onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
            />
          </div>
          <figcaption className="absolute -bottom-5 left-1/2 w-max -translate-x-1/2 rounded-full bg-gold px-5 py-2 text-sm font-bold text-white shadow-lg">
            Plateau Shawarma, 15,90 € HT
          </figcaption>
        </motion.figure>
      </div>
    </header>
  );
}
