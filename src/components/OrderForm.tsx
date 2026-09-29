import type { ReactNode } from 'react';
import { CONTACT } from '../data/config';
import { useCart } from '../hooks/useCart';
import { formatPrice } from '../lib/format';
import { dateMinISO } from '../lib/validation';
import type { CustomerInfo } from '../types';
import CartSuggestions from './CartSuggestions';
import TastingButton from './TastingButton';

interface FieldProps {
  name: keyof CustomerInfo;
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  min?: string;
  hint?: ReactNode;
  textarea?: boolean;
  className?: string;
}

function Field({ name, label, required, type = 'text', autoComplete, placeholder, min, hint, textarea, className = '' }: FieldProps) {
  const { info, setField, errors } = useCart();
  const id = `field-${name}`;
  const error = errors[name];
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  const base = `w-full rounded-xl border bg-ink px-4 py-3 text-base text-white placeholder:text-neutral-500 transition focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold ${
    error ? 'border-red-400' : 'border-white/15'
  }`;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-200">
        {label}
        {required && (
          <span className="text-gold" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          rows={3}
          value={info[name]}
          placeholder={placeholder}
          onChange={(e) => setField(name, e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={base}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={info[name]}
          min={min}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          onChange={(e) => setField(name, e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${base} [color-scheme:dark]`}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-gold-light/90">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function OrderForm() {
  const { lines, total, tva, ttc, count, submit, status, openWhatsApp, decrement, increment } = useCart();
  const loading = status.state === 'loading' && status.type === 'commande';

  return (
    <section id="commande" aria-labelledby="commande-titre" className="scroll-mt-20">
      <div className="mb-8 text-center">
        <h3 id="commande-titre" className="section-title">
          <span aria-hidden="true" className="mr-2">
            📝
          </span>
          Vos Coordonnées
        </h3>
        <p className="mt-2 text-neutral-300">
          Livraison à partir de {CONTACT.minPersonnesLivraison} personnes · Commande instantanée, pas de devis à
          attendre.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit('commande');
          }}
          className="card grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:col-span-3"
        >
          <Field name="entreprise" label="Entreprise" required autoComplete="organization" />
          <Field name="contact" label="Contact" required autoComplete="name" placeholder="Prénom Nom" />
          <Field name="email" label="Email" type="email" required autoComplete="email" />
          <Field name="tel" label="Téléphone" type="tel" required autoComplete="tel" placeholder="06 12 34 56 78" />
          <Field
            name="date"
            label="Date souhaitée"
            type="date"
            required
            min={dateMinISO()}
            hint={`Au moins ${CONTACT.delaiMinJours * 24} h à l’avance`}
          />
          <Field name="heure" label="Heure de livraison" type="time" required />
          <Field
            name="adresse"
            label="Adresse de livraison"
            required
            autoComplete="street-address"
            className="sm:col-span-2"
          />
          <Field
            name="parrain"
            label="Recommandé par"
            placeholder="Nom de l’entreprise qui vous a recommandé"
            className="sm:col-span-2"
            hint={<>🎁 Parrainage : −10% pour vous et −10% pour votre parrain sur la prochaine commande !</>}
          />
          <Field
            name="notes"
            label="Remarques"
            textarea
            placeholder="Allergies, horaires de livraison, accès…"
            className="sm:col-span-2"
          />
          <p className="text-xs text-neutral-400 sm:col-span-2">
            <span className="text-gold">*</span> Champs obligatoires pour une commande.
          </p>
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
            <button type="submit" className="btn-gold flex-1" disabled={loading}>
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" aria-hidden="true" />
                  Envoi en cours…
                </>
              ) : (
                <>📧 Envoyer la commande</>
              )}
            </button>
            <button type="button" className="btn-whatsapp flex-1" onClick={openWhatsApp}>
              💬 Commander par WhatsApp
            </button>
          </div>
        </form>

        <aside aria-labelledby="recap-titre" className="card h-fit p-5 sm:p-6 lg:sticky lg:top-20 lg:col-span-2">
          <h4 id="recap-titre" className="font-display text-lg font-bold text-gold-light">
            Récapitulatif
          </h4>
          {lines.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-300">
              Votre panier est vide. <a href="#carte" className="text-gold underline underline-offset-2">Parcourir la carte</a>
            </p>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-white/10">
                {lines.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 text-neutral-200">
                      <span className="font-semibold text-white">{l.quantite} ×</span> {l.nom}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {l.offert ? (
                        <span className="font-semibold text-emerald-300">Offert 🎁</span>
                      ) : (
                        <>
                          <span className="tabular-nums text-neutral-200">{formatPrice(l.quantite * l.prix_unitaire)} HT</span>
                          <button type="button" aria-label={`Retirer ${l.nom}`} onClick={() => decrement(l.id)} className="h-8 w-8 rounded-full border border-white/20 hover:border-gold">−</button>
                          <button type="button" aria-label={`Ajouter ${l.nom}`} onClick={() => increment(l.id)} className="h-8 w-8 rounded-full border border-white/20 hover:border-gold">+</button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1 border-t border-gold/30 pt-3 text-sm">
                <div className="flex justify-between text-neutral-300">
                  <dt>Sous-total HT · {count} article{count > 1 ? 's' : ''}</dt>
                  <dd className="tabular-nums">{formatPrice(total)}</dd>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <dt>TVA 10 %</dt>
                  <dd className="tabular-nums">{formatPrice(tva)}</dd>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <dt className="text-base font-semibold text-white">Total TTC</dt>
                  <dd className="text-2xl font-extrabold tabular-nums text-gold">{formatPrice(ttc)}</dd>
                </div>
              </dl>
              <CartSuggestions />
            </>
          )}
          <div className="mt-5 border-t border-white/10 pt-5 text-center">
            <p className="mb-3 text-sm text-neutral-300">Pas encore convaincu ? Goûtez d’abord.</p>
            <TastingButton className="btn-outline w-full" />
          </div>
        </aside>
      </div>
    </section>
  );
}
