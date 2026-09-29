import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { ORDERABLES } from '../../data/products';
import { formatPrice, round2 } from '../../lib/format';
import { useAdmin } from '../AdminApp';
import { download, toCsv } from '../csv';
import { aRacheter, matches, quantiteAchat } from '../stats';
import { UNITES, type Ingredient, type IngredientInput, type Mouvement } from '../types';
import { Card, Empty, Field, Input, Select, Spinner } from '../ui';

type Onglet = 'ingredients' | 'recettes' | 'courses' | 'mouvements';

const fmtQ = (n: number) => (Math.round(n * 1000) / 1000).toLocaleString('fr-FR');
const PRODUITS = [...ORDERABLES.values()].filter((o) => !o.min).map((o) => o.nom);

// ---------------------------------------------------------------------------
function IngredientForm({ initial, onDone }: { initial?: Ingredient; onDone: () => void }) {
  const { api, reload } = useAdmin();
  const uid = useId();
  const [f, setF] = useState<IngredientInput>(
    initial
      ? { id: initial.id, nom: initial.nom, unite: initial.unite, seuil: initial.seuil, prix_unitaire: initial.prix_unitaire, fournisseur: initial.fournisseur }
      : { nom: '', unite: 'kg', seuil: 0, prix_unitaire: 0, fournisseur: '' },
  );
  const [stockInitial, setStockInitial] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.nom.trim()) return setErr('Indiquez un nom.');
    setBusy(true);
    try {
      const saved = await api.saveIngredient({ ...f, nom: f.nom.trim(), seuil: Number(f.seuil) || 0, prix_unitaire: Number(f.prix_unitaire) || 0 });
      if (!initial && stockInitial > 0) await api.addMouvement({ ingredient_id: saved.id, type: 'ajustement', quantite: stockInitial, note: 'Stock initial' });
      await reload();
      onDone();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Nom de l’ingrédient" id={`${uid}-nom`} className="sm:col-span-2 lg:col-span-1">
        <Input id={`${uid}-nom`} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="Ex. Poulet mariné" />
      </Field>
      <Field label="Unité" id={`${uid}-unite`}>
        <Select id={`${uid}-unite`} value={f.unite} onChange={(e) => setF({ ...f, unite: e.target.value })}>
          {UNITES.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Select>
      </Field>
      {!initial && (
        <Field label={`Stock actuel (${f.unite})`} id={`${uid}-stock`}>
          <Input id={`${uid}-stock`} type="number" min={0} step="0.001" inputMode="decimal" value={stockInitial} onChange={(e) => setStockInitial(Number(e.target.value))} />
        </Field>
      )}
      <Field label={`Seuil d’alerte (${f.unite})`} id={`${uid}-seuil`}>
        <Input id={`${uid}-seuil`} type="number" min={0} step="0.001" inputMode="decimal" value={f.seuil} onChange={(e) => setF({ ...f, seuil: Number(e.target.value) })} />
      </Field>
      <Field label={`Prix d’achat HT / ${f.unite}`} id={`${uid}-prix`}>
        <Input id={`${uid}-prix`} type="number" min={0} step="0.01" inputMode="decimal" value={f.prix_unitaire} onChange={(e) => setF({ ...f, prix_unitaire: Number(e.target.value) })} />
      </Field>
      <Field label="Fournisseur (facultatif)" id={`${uid}-four`}>
        <Input id={`${uid}-four`} value={f.fournisseur} onChange={(e) => setF({ ...f, fournisseur: e.target.value })} />
      </Field>
      {err && <p className="text-sm text-red-300 sm:col-span-2 lg:col-span-3">{err}</p>}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <button type="button" className="btn-outline" onClick={onDone}>
          Annuler
        </button>
        <button type="submit" className="btn-gold" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
function MouvementRapide({ ing, onDone }: { ing: Ingredient; onDone: () => void }) {
  const { api, reload } = useAdmin();
  const uid = useId();
  const [mode, setMode] = useState<'entree' | 'perte' | 'inventaire'>('entree');
  const [q, setQ] = useState<number>(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!(q >= 0) || (mode !== 'inventaire' && q <= 0)) return;
    setBusy(true);
    const quantite = mode === 'entree' ? q : mode === 'perte' ? -q : round2(q - ing.stock);
    if (quantite !== 0)
      await api.addMouvement({
        ingredient_id: ing.id,
        type: mode === 'entree' ? 'entree' : 'ajustement',
        quantite,
        note: note || (mode === 'entree' ? 'Achat / réception' : mode === 'perte' ? 'Perte / casse' : 'Inventaire'),
      });
    await reload();
    setBusy(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-gold/30 bg-ink p-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type de mouvement">
        {(
          [
            ['entree', '➕ Entrée marchandise'],
            ['perte', '➖ Perte / casse'],
            ['inventaire', '📋 Inventaire (stock réel)'],
          ] as const
        ).map(([m, l]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${mode === m ? 'border-gold bg-gold text-ink' : 'border-white/15 text-neutral-200'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end">
        <Field label={mode === 'inventaire' ? `Stock compté (${ing.unite})` : `Quantité (${ing.unite})`} id={`${uid}-q`}>
          <Input id={`${uid}-q`} type="number" min={0} step="0.001" inputMode="decimal" autoFocus value={q || ''} onChange={(e) => setQ(Number(e.target.value))} />
        </Field>
        <Field label="Note (facultatif)" id={`${uid}-n`}>
          <Input id={`${uid}-n`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. Metro, facture n°…" />
        </Field>
        <div className="flex gap-2">
          <button type="button" className="btn-outline px-3" onClick={onDone}>
            ✕
          </button>
          <button type="submit" className="btn-gold px-4" disabled={busy}>
            Valider
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
function Ingredients() {
  const { ingredients, api, reload } = useAdmin();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const [mvt, setMvt] = useState<string | null>(null);
  const list = (ingredients ?? []).filter((i) => matches(q, i.nom, i.fournisseur));
  const valeur = round2((ingredients ?? []).reduce((s, i) => s + Math.max(0, i.stock) * i.prix_unitaire, 0));

  const supprimer = async (i: Ingredient) => {
    if (!window.confirm(`Supprimer « ${i.nom} » ? Il sera retiré de toutes les recettes.`)) return;
    await api.deleteIngredient(i.id);
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input type="search" placeholder="Rechercher un ingrédient…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un ingrédient" className="sm:max-w-sm" />
        <p className="text-sm text-neutral-400">
          Valeur du stock : <strong className="text-gold">{formatPrice(valeur)} HT</strong>
        </p>
        <button type="button" className="btn-gold ml-auto px-4" onClick={() => setEdit('nouveau')}>
          + Nouvel ingrédient
        </button>
      </div>
      {edit === 'nouveau' && (
        <Card>
          <IngredientForm onDone={() => setEdit(null)} />
        </Card>
      )}
      {list.length === 0 ? (
        <Empty>Aucun ingrédient. Ajoutez vos ingrédients avec leur stock actuel pour commencer.</Empty>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {list.map((i) => {
            const alerte = aRacheter(i);
            return (
              <li key={i.id}>
                <Card className={alerte ? 'border-amber-400/60' : ''}>
                  {edit === i.id ? (
                    <IngredientForm initial={i} onDone={() => setEdit(null)} />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-white">{i.nom}</p>
                          <p className="text-xs text-neutral-400">
                            Seuil {fmtQ(i.seuil)} {i.unite} · {formatPrice(i.prix_unitaire)}/{i.unite}
                            {i.fournisseur && ` · ${i.fournisseur}`}
                          </p>
                        </div>
                        <p className={`shrink-0 text-right text-xl font-extrabold tabular-nums ${i.stock < 0 ? 'text-red-300' : alerte ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {fmtQ(i.stock)} <span className="text-sm font-semibold">{i.unite}</span>
                          {alerte && <span className="block text-[11px] font-semibold">⚠️ à racheter</span>}
                        </p>
                      </div>
                      {mvt === i.id ? (
                        <MouvementRapide ing={i} onDone={() => setMvt(null)} />
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setMvt(i.id)}>
                            ± Mouvement de stock
                          </button>
                          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setEdit(i.id)}>
                            Modifier
                          </button>
                          <button type="button" className="ml-auto text-xs text-red-300 underline" onClick={() => void supprimer(i)}>
                            Supprimer
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Recettes() {
  const { ingredients, recettes, ingredientById, api, reload } = useAdmin();
  const uid = useId();
  const [produit, setProduit] = useState(PRODUITS[0] ?? '');
  const [lignes, setLignes] = useState<{ ingredient_id: string; quantite: number }[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setLignes(recettes.filter((r) => r.produit === produit).map((r) => ({ ingredient_id: r.ingredient_id, quantite: r.quantite })));
    setMsg('');
  }, [produit, recettes]);

  const cout = round2(lignes.reduce((s, l) => s + l.quantite * (ingredientById.get(l.ingredient_id)?.prix_unitaire ?? 0), 0));
  const prix = [...ORDERABLES.values()].find((o) => o.nom === produit)?.prix ?? 0;
  const avecRecette = new Set(recettes.map((r) => r.produit));

  const enregistrer = async () => {
    const valides = lignes.filter((l) => l.ingredient_id && l.quantite > 0);
    await api.saveRecette(produit, valides);
    await reload();
    setMsg('Recette enregistrée ✓');
  };

  if (!ingredients?.length) return <Empty>Ajoutez d’abord vos ingrédients (onglet « Ingrédients »).</Empty>;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit lg:hidden">
        <Field label={`Produit (${avecRecette.size} / ${PRODUITS.length} avec recette)`} id={`${uid}-produit`}>
          <Select id={`${uid}-produit`} value={produit} onChange={(e) => setProduit(e.target.value)}>
            {PRODUITS.map((p) => (
              <option key={p} value={p}>
                {avecRecette.has(p) ? '✅ ' : '⚪ '}
                {p}
              </option>
            ))}
          </Select>
        </Field>
      </Card>
      <Card className="hidden h-fit lg:block">
        <p className="mb-2 text-sm text-neutral-300">
          {avecRecette.size} / {PRODUITS.length} produits ont une recette
        </p>
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
          {PRODUITS.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => setProduit(p)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${p === produit ? 'bg-gold text-ink' : 'text-neutral-200 hover:bg-white/10'}`}
              >
                {avecRecette.has(p) ? '✅' : '⚪'} {p}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h3 className="font-semibold text-white">{produit}</h3>
        <p className="mb-4 text-sm text-neutral-400">Quantités pour UNE portion vendue.</p>
        <div className="space-y-2">
          {lignes.map((l, k) => {
            const ing = ingredientById.get(l.ingredient_id);
            return (
              <div key={k} className="grid grid-cols-[1fr_110px_auto] items-center gap-2">
                <Select
                  aria-label="Ingrédient"
                  value={l.ingredient_id}
                  onChange={(e) => setLignes(lignes.map((x, j) => (j === k ? { ...x, ingredient_id: e.target.value } : x)))}
                >
                  <option value="">— Ingrédient —</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nom} ({i.unite})
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label={`Quantité en ${ing?.unite ?? ''}`}
                  type="number"
                  min={0}
                  step="0.001"
                  inputMode="decimal"
                  value={l.quantite || ''}
                  onChange={(e) => setLignes(lignes.map((x, j) => (j === k ? { ...x, quantite: Number(e.target.value) } : x)))}
                />
                <button type="button" aria-label="Retirer" onClick={() => setLignes(lignes.filter((_, j) => j !== k))} className="h-10 w-10 rounded-full border border-white/15 text-red-300">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn-outline mt-3" onClick={() => setLignes([...lignes, { ingredient_id: '', quantite: 0 }])}>
          + Ajouter un ingrédient
        </button>
        <div className="mt-4 rounded-xl bg-ink p-3 text-sm">
          <p>
            Coût matière / portion : <strong className="text-gold">{formatPrice(cout)}</strong>
          </p>
          {prix > 0 && (
            <p className="text-neutral-300">
              Prix de vente HT : {formatPrice(prix)} · Marge brute :{' '}
              <strong className={prix - cout > 0 ? 'text-emerald-300' : 'text-red-300'}>
                {formatPrice(prix - cout)} ({Math.round(((prix - cout) / prix) * 100)} %)
              </strong>
            </p>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className="btn-gold" onClick={() => void enregistrer()} id={`${uid}-save`}>
            Enregistrer la recette
          </button>
          {msg && <span className="text-sm text-emerald-300">{msg}</span>}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Courses() {
  const { ingredients } = useAdmin();
  const list = (ingredients ?? []).filter(aRacheter);
  const total = round2(list.reduce((s, i) => s + quantiteAchat(i) * i.prix_unitaire, 0));
  const exporter = () =>
    download(
      `liste-de-courses-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([['Ingrédient', 'Stock', 'Seuil', 'À acheter', 'Unité', 'Fournisseur', 'Coût estimé HT'], ...list.map((i) => [i.nom, fmtQ(i.stock), fmtQ(i.seuil), fmtQ(quantiteAchat(i)), i.unite, i.fournisseur, (quantiteAchat(i) * i.prix_unitaire).toFixed(2).replace('.', ',')])]),
    );

  if (list.length === 0) return <Empty>✅ Rien à racheter : tous les ingrédients sont au-dessus de leur seuil.</Empty>;
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-white">🛒 Liste de courses ({list.length})</h3>
        <button type="button" className="btn-outline ml-auto px-3 text-xs" onClick={exporter}>
          ⬇ Excel
        </button>
        <button type="button" className="btn-outline px-3 text-xs" onClick={() => window.print()}>
          🖨 Imprimer
        </button>
      </div>
      <ul className="divide-y divide-white/10">
        {list.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>
              ☐ <strong className="text-white">{i.nom}</strong>
              {i.fournisseur && <span className="text-neutral-400"> · {i.fournisseur}</span>}
              <span className="block text-xs text-neutral-400">
                Reste {fmtQ(i.stock)} {i.unite} (seuil {fmtQ(i.seuil)})
              </span>
            </span>
            <span className="text-right font-bold text-gold">
              {fmtQ(quantiteAchat(i))} {i.unite}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-sm text-neutral-300">
        Budget estimé : <strong className="text-gold">{formatPrice(total)} HT</strong>
      </p>
      <p className="mt-1 text-xs text-neutral-500">Quantité proposée : de quoi remonter à 2 × le seuil d’alerte.</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function Mouvements() {
  const { api, ingredientById, commandes, clientById } = useAdmin();
  const [list, setList] = useState<Mouvement[] | null>(null);
  useEffect(() => {
    void api.listMouvements(200).then(setList);
  }, [api]);
  const cmd = useMemo(() => new Map(commandes.map((c) => [c.id, c])), [commandes]);
  if (!list) return <Spinner />;
  if (list.length === 0) return <Empty>Aucun mouvement pour l’instant.</Empty>;
  return (
    <Card>
      <ul className="divide-y divide-white/10">
        {list.map((m) => {
          const ing = ingredientById.get(m.ingredient_id);
          const c = m.commande_id ? cmd.get(m.commande_id) : undefined;
          const cl = c?.client_id ? clientById.get(c.client_id) : undefined;
          return (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <strong className="text-white">{ing?.nom ?? 'Ingrédient supprimé'}</strong>
                <span className="block truncate text-xs text-neutral-400">
                  {new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · {m.note}
                  {c && (
                    <>
                      {' · '}
                      <a href={`#/commandes/${c.id}`} className="text-gold underline">
                        {cl?.entreprise || cl?.nom || 'commande'}
                      </a>
                    </>
                  )}
                </span>
              </span>
              <span className={`shrink-0 font-bold tabular-nums ${m.quantite >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {m.quantite >= 0 ? '+' : ''}
                {fmtQ(m.quantite)} {ing?.unite}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
export default function StockPage() {
  const { ingredients } = useAdmin();
  const [onglet, setOnglet] = useState<Onglet>('ingredients');
  const nbCourses = (ingredients ?? []).filter(aRacheter).length;

  if (ingredients === null)
    return (
      <Card>
        <h1 className="font-display text-2xl font-bold text-white">🥕 Stock</h1>
        <p className="mt-3 text-neutral-300">
          Le module stock n’est pas encore installé dans votre base de données. Exécutez le fichier{' '}
          <code className="text-gold">supabase/stock.sql</code> dans Supabase → SQL Editor, puis rechargez la page.
        </p>
      </Card>
    );

  const tabs: { id: Onglet; label: string }[] = [
    { id: 'ingredients', label: `Ingrédients (${ingredients.length})` },
    { id: 'recettes', label: 'Recettes' },
    { id: 'courses', label: `🛒 À racheter${nbCourses ? ` (${nbCourses})` : ''}` },
    { id: 'mouvements', label: 'Historique' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">🥕 Stock & ingrédients</h1>
      <p className="text-sm text-neutral-400">
        Le stock baisse automatiquement quand une commande passe en « Confirmée » (selon les recettes), et remonte si elle est
        annulée.
      </p>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex w-max gap-2" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={onglet === t.id}
              onClick={() => setOnglet(t.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${onglet === t.id ? 'border-gold bg-gold text-ink' : 'border-white/15 text-neutral-200 hover:border-gold'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {onglet === 'ingredients' && <Ingredients />}
      {onglet === 'recettes' && <Recettes />}
      {onglet === 'courses' && <Courses />}
      {onglet === 'mouvements' && <Mouvements />}
    </div>
  );
}
