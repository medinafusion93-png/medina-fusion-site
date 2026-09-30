import { useId, useMemo, useState } from 'react';
import { CONTACT, TVA_RATE } from '../data/config';
import { ORDERABLES } from '../data/products';
import { useCart } from '../hooks/useCart';
import { formatPrice, round2 } from '../lib/format';
import { budgetMinimum, propose, type Moment, type Proposal } from '../lib/simulator';

const MOMENTS: { id: Moment; label: string; icon: string }[] = [
  { id: 'petit-dej', label: 'Petit-déjeuner', icon: '☕' },
  { id: 'dejeuner', label: 'Déjeuner / réunion', icon: '🍱' },
  { id: 'evenement', label: 'Cocktail / événement', icon: '🎉' },
];

const TAGS: Record<Proposal['tag'], { label: (p: Proposal, budget: number) => string; className: string }> = {
  eco: { label: () => 'Économique', className: 'bg-white/10 text-neutral-100' },
  ideal: { label: () => 'Idéal pour votre budget', className: 'bg-gold text-ink' },
  premium: {
    label: (p, budget) => `Premium · +${formatPrice(round2(p.parPersonne - budget))}/pers.`,
    className: 'bg-gold/15 text-gold-light',
  },
};

const MIN_PERS = CONTACT.minPersonnesLivraison;
const clampInt = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : min;

function NumberStepper({
  id,
  value,
  onChange,
  min,
  max,
  label,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const btn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-xl font-bold transition hover:border-gold hover:text-gold disabled:opacity-30';
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Diminuer ${label}`}>
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clampInt(Number(e.target.value), min, max))}
        className="w-20 rounded-xl border border-white/15 bg-ink py-2 text-center text-lg font-bold text-white focus:border-gold focus:outline-none"
      />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Augmenter ${label}`}>
        +
      </button>
    </div>
  );
}

function ProposalCard({ p, budget, personnes }: { p: Proposal; budget: number; personnes: number }) {
  const { addMany } = useCart();
  const [added, setAdded] = useState(false);
  const tag = TAGS[p.tag];
  const ttc = round2(p.totalHT * (1 + TVA_RATE));

  return (
    <li
      className={`flex flex-col rounded-2xl border p-5 ${
        p.tag === 'ideal' ? 'border-gold bg-gradient-to-b from-gold/10 to-ink-800 shadow-xl shadow-gold/10' : 'border-white/10 bg-ink-800'
      }`}
    >
      <span className={`self-start rounded-full px-3 py-1 text-xs font-bold ${tag.className}`}>{tag.label(p, budget)}</span>
      <h4 className="mt-3 font-display text-xl font-bold text-white">{p.titre}</h4>
      <p className="mt-1 text-sm text-neutral-300">{p.description}</p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-gold">{formatPrice(p.parPersonne)}</span>
        <span className="text-sm text-neutral-300">HT / pers.</span>
      </div>
      <p className="text-sm text-neutral-400">
        Total {personnes} pers. : <strong className="text-neutral-100">{formatPrice(p.totalHT)} HT</strong> · {formatPrice(ttc)} TTC
      </p>

      <ul className="mt-4 flex-1 space-y-1 border-t border-white/10 pt-3 text-sm text-neutral-200">
        {p.lignes.map((l) => (
          <li key={l.id} className="flex gap-2">
            <span className="w-10 shrink-0 text-right font-bold text-gold-light">{l.quantite} ×</span>
            <span>{ORDERABLES.get(l.id)?.nom}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => {
          addMany(p.lignes);
          setAdded(true);
        }}
        className={`${p.tag === 'ideal' ? 'btn-gold' : 'btn-outline'} mt-5 w-full`}
      >
        {added ? '✓ Ajouté — ajouter encore' : 'Ajouter ce menu au panier'}
      </button>
      {added && (
        <a href="#commande" className="mt-2 text-center text-sm font-semibold text-gold underline underline-offset-2" role="status">
          Menu ajouté · finaliser ma commande →
        </a>
      )}
    </li>
  );
}

/** « Quel est votre budget par personne ? » → menus complets proposés automatiquement */
export default function BudgetSimulator() {
  const uid = useId();
  const [moment, setMoment] = useState<Moment>('dejeuner');
  const [personnes, setPersonnes] = useState(15);
  const [budget, setBudget] = useState(20);
  const [vege, setVege] = useState(0);
  const [sansGluten, setSansGluten] = useState(0);

  const regimes = moment === 'dejeuner';
  const vegeEff = regimes ? Math.min(vege, personnes) : 0;
  const sgEff = regimes ? Math.min(sansGluten, personnes - vegeEff) : 0;
  const proposals = useMemo(
    () => propose({ personnes, budget, moment, vege: vegeEff, sansGluten: sgEff }),
    [personnes, budget, moment, vegeEff, sgEff],
  );
  const mini = useMemo(
    () => budgetMinimum({ personnes, moment, vege: vegeEff, sansGluten: sgEff }),
    [personnes, moment, vegeEff, sgEff],
  );
  const horsBudget = mini !== null && mini > budget;

  const label = 'mb-2 block text-sm font-semibold text-neutral-100';

  return (
    <section id="simulateur" aria-labelledby={`${uid}-titre`} className="scroll-mt-20">
      <div className="rounded-3xl border border-gold/40 bg-gradient-to-b from-ink-700 to-ink-800 p-5 sm:p-8">
        <div className="text-center">
          <h3 id={`${uid}-titre`} className="section-title">
            Votre menu selon votre budget
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-neutral-300">
            Indiquez le nombre de convives et votre budget par personne : on vous propose un menu complet, prêt à
            commander en un clic.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr]">
          <fieldset>
            <legend className={label}>Pour quelle occasion ?</legend>
            <div className="flex flex-wrap gap-2">
              {MOMENTS.map((m) => (
                <label
                  key={m.id}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${
                    moment === m.id ? 'border-gold bg-gold text-ink' : 'border-white/20 text-neutral-200 hover:border-gold'
                  }`}
                >
                  <input
                    type="radio"
                    name={`${uid}-moment`}
                    value={m.id}
                    checked={moment === m.id}
                    onChange={() => setMoment(m.id)}
                    className="sr-only"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${uid}-pers`} className={label}>
              Nombre de personnes
            </label>
            <NumberStepper id={`${uid}-pers`} value={personnes} onChange={setPersonnes} min={MIN_PERS} max={500} label="le nombre de personnes" />
            {regimes && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label htmlFor={`${uid}-vege`} className={label}>
                    Dont végétariens
                  </label>
                  <NumberStepper
                    id={`${uid}-vege`}
                    value={vegeEff}
                    onChange={(v) => setVege(clampInt(v, 0, personnes - sgEff))}
                    min={0}
                    max={personnes - sgEff}
                    label="le nombre de végétariens"
                  />
                </div>
                <div>
                  <label htmlFor={`${uid}-sg`} className={label}>
                    Dont sans gluten
                  </label>
                  <NumberStepper
                    id={`${uid}-sg`}
                    value={sgEff}
                    onChange={(v) => setSansGluten(clampInt(v, 0, personnes - vegeEff))}
                    min={0}
                    max={personnes - vegeEff}
                    label="le nombre de personnes sans gluten"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor={`${uid}-budget`} className={label}>
              Budget par personne
            </label>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gold">{formatPrice(budget)}</span>
              <span className="text-sm text-neutral-300">HT</span>
              <span className="text-sm text-neutral-400">≈ {formatPrice(round2(budget * (1 + TVA_RATE)))} TTC</span>
            </div>
            <input
              id={`${uid}-budget`}
              type="range"
              min={5}
              max={60}
              step={1}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="mt-3 w-full accent-[#d4af37]"
              aria-valuetext={`${budget} euros hors taxe par personne`}
            />
            <div className="flex justify-between text-xs text-neutral-400">
              <span>5 €</span>
              <span>60 €</span>
            </div>
          </div>
        </div>

        <div aria-live="polite" className="mt-8">
          {horsBudget && (
            <p className="mb-4 rounded-xl border border-amber-400/50 bg-amber-950/60 px-4 py-3 text-sm text-amber-100">
              Pour cette occasion, nos menus commencent à <strong>{formatPrice(mini ?? 0)} HT / pers.</strong> Voici notre
              proposition la plus proche de votre budget.
            </p>
          )}
          {proposals.length === 0 ? (
            <p className="text-center text-neutral-300">Aucun menu disponible pour ces critères.</p>
          ) : (
            <ul className={`grid gap-5 ${proposals.length === 3 ? 'lg:grid-cols-3' : proposals.length === 2 ? 'md:grid-cols-2' : 'mx-auto max-w-md'}`}>
              {proposals.map((p) => (
                <ProposalCard key={p.key} p={p} budget={budget} personnes={personnes} />
              ))}
            </ul>
          )}
          <p className="mt-4 text-center text-xs text-neutral-400">
            Menus modifiables ensuite dans le panier (ajoutez ou retirez librement). Prix HT, TVA 10 % en sus.
            {regimes && (vegeEff > 0 || sgEff > 0) && ' Végétarien et sans gluten à la fois ? Choisissez le Plateau Sans Gluten — Végétarien dans le panier.'}
            {!regimes && ' Allergies ou régimes particuliers : précisez-les dans « Remarques » lors de la commande.'}
          </p>
        </div>
      </div>
    </section>
  );
}
