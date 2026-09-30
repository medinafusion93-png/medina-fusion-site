import { useEffect, useRef, useState } from 'react';
import { CONTACT } from '../../data/config';
import { formatPrice } from '../../lib/format';
import { useAdmin } from '../AdminApp';
import { montants } from '../stats';
import { paiementInfo, STATUTS_VENTE, type Commande } from '../types';
import { fmtDate } from '../ui';

type Doc = 'devis' | 'facture' | 'cuisine' | 'livraison';

const today = () => new Date().toLocaleDateString('fr-FR');

function EnTete({ titre, numero, echeance }: { titre: string; numero?: string | null; echeance?: string }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-4 border-[#b7791f] pb-5">
      <div>
        <p className="font-display text-3xl font-bold tracking-wide text-[#b7791f]">MEDINA FUSION</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          Traiteur libano-tunisien
          <br />
          {CONTACT.adresse}
          <br />
          {CONTACT.formeJuridique} au capital de {CONTACT.capital}
          <br />
          {CONTACT.rcs}
          <br />
          N° TVA : {CONTACT.tvaIntra}
          <br />
          {CONTACT.email} · {CONTACT.whatsappAffiche}
        </p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold uppercase">{titre}</p>
        {numero && (
          <p className="mt-1 text-sm">
            N° <strong>{numero}</strong>
          </p>
        )}
        <p className="text-sm">
          Date : <strong>{today()}</strong>
        </p>
        {echeance && (
          <p className="text-sm">
            Échéance : <strong>{echeance}</strong>
          </p>
        )}
      </div>
    </header>
  );
}

function DocumentCommercial({ c, doc }: { c: Commande; doc: 'devis' | 'facture' }) {
  const { clientById } = useAdmin();
  const cl = c.client_id ? clientById.get(c.client_id) : undefined;
  const m = montants(c);
  const numero = doc === 'devis' ? c.numero_devis : c.numero_facture;

  return (
    <article className="space-y-6">
      <EnTete titre={doc === 'devis' ? 'Devis' : 'Facture'} numero={numero} echeance={doc === 'facture' ? 'À réception' : undefined} />
      <div className="grid grid-cols-2 gap-4 text-sm">
        <section className="rounded-lg bg-[#faf7f2] p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#b7791f]">{doc === 'devis' ? 'Client' : 'Facturé à'}</p>
          <p className="text-base font-bold">{cl?.entreprise || cl?.nom || '—'}</p>
          {cl?.entreprise && <p>{cl.nom}</p>}
          {cl?.adresse && <p>{cl.adresse}</p>}
          {cl?.email && <p>{cl.email}</p>}
          {cl?.telephone && <p>{cl.telephone}</p>}
        </section>
        <section className="rounded-lg bg-[#faf7f2] p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#b7791f]">Prestation</p>
          <p>
            <strong className="capitalize">{fmtDate(c.date_prestation, true)}</strong>
            {c.heure && ` à ${c.heure}`}
          </p>
          {c.nb_personnes ? <p>{c.nb_personnes} personnes</p> : null}
          <p>{c.mode === 'retrait' ? 'Retrait sur place' : `Livraison : ${c.adresse || '—'}`}</p>
          {c.allergies && <p className="italic text-neutral-600">Particularités : {c.allergies}</p>}
        </section>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-900 text-white">
            <th className="px-3 py-2 text-left">Désignation</th>
            <th className="w-16 px-3 py-2 text-center">Qté</th>
            <th className="w-28 px-3 py-2 text-right">Prix unit. HT</th>
            <th className="w-28 px-3 py-2 text-right">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {c.lignes.length === 0 ? (
            <tr>
              <td colSpan={4} className="border-b px-3 py-3 text-center text-neutral-500">
                Aucune prestation
              </td>
            </tr>
          ) : (
            c.lignes.map((l, i) => (
              <tr key={i} className={i % 2 ? 'bg-neutral-50' : ''}>
                <td className="border-b border-neutral-200 px-3 py-2">{l.nom}</td>
                <td className="border-b border-neutral-200 px-3 py-2 text-center">{l.quantite}</td>
                <td className="border-b border-neutral-200 px-3 py-2 text-right tabular-nums">{l.prix_unitaire ? formatPrice(l.prix_unitaire) : '—'}</td>
                <td className="border-b border-neutral-200 px-3 py-2 text-right font-semibold tabular-nums">
                  {l.prix_unitaire ? formatPrice(l.quantite * l.prix_unitaire) : <span className="text-emerald-700">Offert</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="ml-auto w-72 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Sous-total HT</span>
          <span className="tabular-nums">{formatPrice(m.ht)}</span>
        </div>
        <div className="flex justify-between">
          <span>TVA {Math.round(c.tva_taux * 100)} %</span>
          <span className="tabular-nums">{formatPrice(m.tva)}</span>
        </div>
        <div className="mt-2 flex justify-between rounded-md bg-[#b7791f] px-3 py-2 text-lg font-bold text-white">
          <span>TOTAL TTC</span>
          <span className="tabular-nums">{formatPrice(m.ttc)}</span>
        </div>
        {doc === 'facture' && m.encaisse > 0 && (
          <>
            <div className="flex justify-between pt-2">
              <span>Déjà réglé</span>
              <span className="tabular-nums">− {formatPrice(m.encaisse)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Reste à payer</span>
              <span className="tabular-nums">{formatPrice(m.reste)}</span>
            </div>
          </>
        )}
      </div>

      {doc === 'devis' ? (
        <section className="grid grid-cols-2 gap-6 pt-4 text-xs text-neutral-600">
          <p>
            Devis valable 30 jours. Prix en euros hors taxes, TVA 10 % en sus.
            <br />
            Toute commande est confirmée à réception du devis signé.
          </p>
          <div className="rounded-lg border border-neutral-300 p-3">
            <p className="font-semibold text-neutral-800">Bon pour accord</p>
            <p>Date, nom et signature :</p>
            <div className="h-16" />
          </div>
        </section>
      ) : (
        <section className="pt-4 text-xs text-neutral-600">
          <p>
            Statut du règlement : <strong>{paiementInfo(c.paiement_statut).label}</strong>. Paiement à réception de facture par virement, carte bancaire, chèque ou espèces (espèces limitées à 1 000 € entre professionnels). Pas d’escompte pour paiement anticipé.
          </p>
          <p>
            En cas de retard de paiement : pénalités au taux de 3 fois le taux d’intérêt légal et indemnité forfaitaire pour
            frais de recouvrement de 40 € (art. L441-10 du Code de commerce).
          </p>
        </section>
      )}
      <footer className="border-t border-neutral-200 pt-3 text-center text-[11px] text-neutral-500">
        Merci pour votre confiance · MEDINA FUSION — {CONTACT.adresse} — {CONTACT.formeJuridique} au capital de {CONTACT.capital} — {CONTACT.rcs} — TVA {CONTACT.tvaIntra}
      </footer>
    </article>
  );
}

function BonLivraison({ c }: { c: Commande }) {
  const { clientById } = useAdmin();
  const cl = c.client_id ? clientById.get(c.client_id) : undefined;
  const total = c.lignes.reduce((s, l) => s + l.quantite, 0);
  const plateaux = c.lignes.filter((l) => /plateau|assiette/i.test(l.nom)).reduce((s, l) => s + l.quantite, 0);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.adresse)}`;
  return (
    <article className="space-y-5">
      <header className="flex items-start justify-between border-b-4 border-blue-700 pb-4">
        <div>
          <p className="text-3xl font-extrabold uppercase text-blue-800">Bon de livraison</p>
          <p className="mt-1 text-lg">{cl?.entreprise || cl?.nom || 'Client'}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold capitalize">{fmtDate(c.date_prestation, true)}</p>
          <p className="text-3xl font-extrabold">{c.heure || '--:--'}</p>
        </div>
      </header>
      {c.mode === 'retrait' ? (
        <p className="text-xl font-bold">🏪 Retrait sur place par le client</p>
      ) : (
        <section>
          <p className="text-sm font-bold uppercase text-neutral-500">Adresse</p>
          <p className="text-2xl font-bold">📍 {c.adresse || '—'}</p>
          {c.adresse && (
            <a href={maps} className="text-sm text-blue-700 underline print:hidden" target="_blank" rel="noreferrer">
              Ouvrir dans Google Maps
            </a>
          )}
        </section>
      )}
      <section className="grid grid-cols-2 gap-4 text-lg">
        <p>
          <span className="block text-sm font-bold uppercase text-neutral-500">Contact sur place</span>
          {cl?.nom || '—'}
        </p>
        <p>
          <span className="block text-sm font-bold uppercase text-neutral-500">Téléphone</span>
          {cl?.telephone ? <a href={`tel:${cl.telephone.replace(/\s/g, '')}`}>{cl.telephone}</a> : '—'}
        </p>
      </section>
      <p className="text-xl">
        <strong>{total}</strong> article(s){plateaux ? <> dont <strong>{plateaux} plateau(x) repas</strong></> : null}
      </p>
      <table className="w-full border-collapse text-xl">
        <tbody>
          {c.lignes.map((l, i) => (
            <tr key={i} className="border-b-2 border-neutral-300">
              <td className="w-12 py-3 text-3xl text-neutral-400">☐</td>
              <td className="w-24 py-3 text-center text-3xl font-extrabold">{l.quantite}</td>
              <td className="py-3">{l.nom}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {c.allergies && <div className="rounded-lg border-4 border-red-600 p-3 text-lg font-bold text-red-700">⚠️ {c.allergies}</div>}
      <div className="grid grid-cols-2 gap-6 pt-8 text-sm">
        <p>Livré à : ______ h ______</p>
        <p>Signature du client :</p>
      </div>
    </article>
  );
}

function FicheCuisine({ c }: { c: Commande }) {
  const { clientById } = useAdmin();
  const cl = c.client_id ? clientById.get(c.client_id) : undefined;
  const total = c.lignes.reduce((s, l) => s + l.quantite, 0);
  return (
    <article className="space-y-5">
      <header className="flex items-start justify-between border-b-4 border-neutral-900 pb-4">
        <div>
          <p className="text-3xl font-extrabold uppercase">Fiche de préparation</p>
          <p className="mt-1 text-lg">{cl?.entreprise || cl?.nom || 'Client'}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold capitalize">{fmtDate(c.date_prestation, true)}</p>
          <p className="text-3xl font-extrabold">{c.heure || '--:--'}</p>
        </div>
      </header>
      <p className="text-lg">
        {c.nb_personnes ? <strong>{c.nb_personnes} personnes · </strong> : null}
        {c.mode === 'retrait' ? '🏪 Retrait sur place' : `🚚 Livraison : ${c.adresse || '—'}`}
      </p>
      {c.allergies && (
        <div className="rounded-lg border-4 border-red-600 p-4 text-xl font-bold text-red-700">⚠️ ALLERGIES / PARTICULARITÉS : {c.allergies}</div>
      )}
      <table className="w-full border-collapse text-xl">
        <tbody>
          {c.lignes.map((l, i) => (
            <tr key={i} className="border-b-2 border-neutral-300">
              <td className="w-12 py-3 text-3xl text-neutral-400">☐</td>
              <td className="w-24 py-3 text-center text-3xl font-extrabold">{l.quantite}</td>
              <td className="py-3">{l.nom}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-right text-lg">
        Total : <strong>{total}</strong> article(s)
      </p>
      {c.notes && (
        <div className="rounded-lg border border-neutral-300 p-3">
          <p className="text-sm font-bold uppercase">Notes</p>
          <p className="whitespace-pre-line">{c.notes}</p>
        </div>
      )}
      <p className="pt-6 text-sm text-neutral-500">Préparé par : ____________________ · Vérifié : ☐</p>
    </article>
  );
}

export default function PrintPage({ id, doc }: { id: string; doc: string }) {
  const { commandes, api, saveCommande } = useAdmin();
  const c = commandes.find((x) => x.id === id);
  const kind = (['devis', 'facture', 'cuisine', 'livraison'].includes(doc) ? doc : 'devis') as Doc;
  const [error, setError] = useState('');
  const numbering = useRef(false);

  // Attribue un numéro de devis / facture à la première ouverture
  useEffect(() => {
    if (!c || kind === 'cuisine' || kind === 'livraison' || numbering.current) return;
    const champ = kind === 'devis' ? 'numero_devis' : 'numero_facture';
    if (c[champ]) return;
    numbering.current = true;
    void (async () => {
      try {
        const numero = await api.prochainNumero(kind);
        const { id: cid, created_at: _c, updated_at: _u, ...rest } = c;
        await saveCommande({
          ...rest,
          id: cid,
          [champ]: numero,
          ...(kind === 'devis' && c.statut === 'demande' ? { statut: 'devis_envoye' as const } : {}),
        });
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [c, kind, api, saveCommande]);

  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => document.body.classList.remove('print-mode');
  }, []);

  if (!c) return <p className="p-8 text-center">Commande introuvable.</p>;
  const nonConfirmee = kind === 'facture' && !STATUTS_VENTE.includes(c.statut);

  return (
    <div className="min-h-screen bg-neutral-200 print:bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-ink px-4 py-3 print:hidden">
        <a href={`#/commandes/${c.id}`} className="btn-outline px-3">
          ← Retour
        </a>
        <div className="flex gap-1">
          {(['devis', 'facture', 'cuisine', 'livraison'] as const).map((d) => (
            <a key={d} href={`#/imprimer/${c.id}/${d}`} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${kind === d ? 'bg-gold text-ink' : 'text-neutral-200'}`}>
              {d === 'devis' ? 'Devis' : d === 'facture' ? 'Facture' : d === 'cuisine' ? 'Fiche cuisine' : 'Bon livreur'}
            </a>
          ))}
        </div>
        <button type="button" onClick={() => window.print()} className="btn-gold ml-auto px-5">
          🖨 Imprimer / PDF
        </button>
        <p className="w-full text-xs text-neutral-400">
          Pour obtenir un PDF : cliquez sur « Imprimer / PDF » puis choisissez « Enregistrer au format PDF » comme imprimante.
        </p>
        {nonConfirmee && <p className="w-full text-xs font-semibold text-amber-300">⚠️ Cette commande n’est pas encore confirmée : vérifiez avant d’envoyer une facture.</p>}
        {error && <p className="w-full text-xs text-red-300">Numérotation impossible : {error}</p>}
      </div>
      <div className="mx-auto my-6 max-w-[210mm] bg-white p-[14mm] text-neutral-900 shadow-2xl print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {kind === 'cuisine' ? <FicheCuisine c={c} /> : kind === 'livraison' ? <BonLivraison c={c} /> : <DocumentCommercial c={c} doc={kind} />}
      </div>
    </div>
  );
}
