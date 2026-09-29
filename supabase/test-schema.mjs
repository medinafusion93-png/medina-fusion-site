// Vérifie supabase/schema.sql sur un Postgres local (PGlite) qui simule Supabase :
// accès anonyme en écriture seule, aucune lecture publique, droits admin, anti-doublon, numérotation.
// Lancer : npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
let failed = 0;
const ADMIN = '11111111-1111-1111-1111-111111111111';
const PIRATE = '22222222-2222-2222-2222-222222222222';

async function run(sql, role, sub) {
  await db.exec('reset role');
  if (sub) await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
  if (role) await db.exec(`set role ${role}`);
  try {
    const res = await db.exec(sql);
    return [...res].reverse().find((x) => x.rows?.length)?.rows ?? [];
  } finally {
    await db.exec('reset role');
  }
}

async function expectOk(label, sql, role, sub, check) {
  try {
    const rows = await run(sql, role, sub);
    const bad = check ? check(rows) : null;
    if (bad) throw new Error(bad);
    console.log('✔', label);
    return rows;
  } catch (e) {
    failed++;
    console.log('✘', label, '→', e.message);
  }
}

async function expectFail(label, sql, role, sub) {
  try {
    await run(sql, role, sub);
    failed++;
    console.log('✘', label, '→ aurait dû échouer');
  } catch {
    console.log('✔', label, '(refusé)');
  }
}

// Simulation minimale de Supabase
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create role anon; create role authenticated;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  insert into auth.users values ('${ADMIN}', 'Medina.Fusion93@gmail.com'), ('${PIRATE}', 'pirate@exemple.com');
`);

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
await db.exec(schema);
await db.exec(schema); // idempotent
console.log('✔ schéma appliqué deux fois sans erreur');

const demande = (o) => `select nouvelle_demande('${JSON.stringify(o).replace(/'/g, "''")}'::jsonb) as id`;

await expectOk('admin enregistré depuis auth.users', 'select count(*)::int n from admins', null, null, (r) => (r[0].n === 1 ? null : `n=${r[0].n}`));
await expectOk('visiteur : dépose une demande',
  demande({ entreprise: 'ACME', contact: 'Sam', email: 'Sam@Acme.fr', tel: '06 12 34 56 78', date: '2026-10-02', heure: '12:30', adresse: '1 rue X', notes: 'sans gluten', items: [{ nom: 'Houmous', quantite: 2, prix_unitaire: 6 }], total: 12, type: 'commande' }),
  'anon');
await expectOk('visiteur : 2e demande même téléphone au format +33',
  demande({ entreprise: 'ACME bis', tel: '+33 6 12 34 56 78', items: [], total: 0, type: 'degustation' }), 'anon');
await expectFail('visiteur : demande sans coordonnées', demande({ items: [] }), 'anon');
await expectFail('visiteur : lecture clients', 'select * from clients', 'anon');
await expectFail('visiteur : lecture commandes', 'select * from commandes', 'anon');
await expectFail('visiteur : modification commandes', `update commandes set statut = 'confirmee'`, 'anon');
await expectFail('visiteur : numérotation', `select prochain_numero('facture')`, 'anon');

await expectOk('connecté non admin : ne voit aucun client', 'select count(*)::int n from clients', 'authenticated', PIRATE, (r) => (r[0].n === 0 ? null : `voit ${r[0].n}`));
await expectFail('connecté non admin : se déclarer admin', `insert into admins values ('${PIRATE}', 'pirate@exemple.com')`, 'authenticated', PIRATE);
await expectFail('connecté non admin : numérotation', `select prochain_numero('devis')`, 'authenticated', PIRATE);

await expectOk('admin : 1 seul client (anti-doublon), 2 commandes',
  'select (select count(*)::int from clients) c, (select count(*)::int from commandes) m', 'authenticated', ADMIN,
  (r) => (r[0].c === 1 && r[0].m === 2 ? null : JSON.stringify(r[0])));
await expectOk('admin : demandes du site au statut « demande »',
  `select bool_and(statut = 'demande' and source = 'site') ok from commandes`, 'authenticated', ADMIN, (r) => (r[0].ok ? null : 'statut inattendu'));
await expectOk('admin : numérotation continue par type',
  `select prochain_numero('facture') a, prochain_numero('facture') b, prochain_numero('devis') c`, 'authenticated', ADMIN,
  (r) => (r[0].a.endsWith('-0001') && r[0].b.endsWith('-0002') && r[0].c.startsWith('D-') ? null : JSON.stringify(r[0])));
await expectOk('admin : modifie une commande (updated_at mis à jour)',
  `update commandes set statut = 'confirmee' where type = 'commande' returning updated_at >= created_at ok`, 'authenticated', ADMIN,
  (r) => (r.length === 1 && r[0].ok ? null : 'échec'));


// ---------------- Module stock ----------------
const stock = fs.readFileSync(new URL('./stock.sql', import.meta.url), 'utf8');
await db.exec(stock);
await db.exec(stock); // idempotent
console.log('✔ stock.sql appliqué deux fois sans erreur');

const A = ['authenticated', ADMIN];
await expectOk('admin : crée ingrédients + recette', `
  insert into ingredients (nom, unite, stock, seuil, prix_unitaire) values ('Poulet', 'kg', 10, 2, 8), ('Houmous', 'kg', 5, 1, 4);
  insert into recettes (produit, ingredient_id, quantite)
    select 'Plateau Shawarma — Poulet', id, case nom when 'Poulet' then 0.15 else 0.1 end from ingredients;
  select 1`, ...A);
await expectOk('commande confirmée → sortie de stock',
  `insert into commandes (statut, lignes, total_ht) values ('confirmee', '[{"nom":"Plateau Shawarma — Poulet","quantite":10,"prix_unitaire":15.9}]', 159);
   select (select stock::float from ingredients where nom='Poulet') p, (select stock::float from ingredients where nom='Houmous') h`,
  ...A, (r) => (r[0].p === 8.5 && r[0].h === 4 ? null : JSON.stringify(r[0])));
await expectOk('commande annulée → retour en stock',
  `update commandes set statut = 'annulee' where statut = 'confirmee';
   select (select stock::float from ingredients where nom='Poulet') p`, ...A, (r) => (r[0].p === 10 ? null : JSON.stringify(r[0])));
await expectOk('demande du site (non confirmée) → pas de sortie',
  `select nouvelle_demande('{"entreprise":"X","tel":"0611111111","items":[{"nom":"Plateau Shawarma — Poulet","quantite":5,"prix_unitaire":15.9}],"total":79.5}'::jsonb);
   select (select stock::float from ingredients where nom='Poulet') p`, null, null, (r) => (r[0].p === 10 ? null : JSON.stringify(r[0])));
await expectOk('validation de la demande → sortie',
  `update commandes set statut = 'confirmee' where source = 'site' and lignes @> '[{"quantite":5}]';
   select (select stock::float from ingredients where nom='Poulet') p`, ...A, (r) => (r[0].p === 9.25 ? null : JSON.stringify(r[0])));
await expectOk('modification des quantités d’une commande confirmée → stock ajusté',
  `update commandes set lignes = '[{"nom":"Plateau Shawarma — Poulet","quantite":2,"prix_unitaire":15.9}]' where source = 'site' and statut = 'confirmee';
   select (select stock::float from ingredients where nom='Poulet') p`, ...A, (r) => (r[0].p === 9.7 ? null : JSON.stringify(r[0])));
await expectOk('entrée de marchandise',
  `insert into mouvements (ingredient_id, type, quantite, note) select id, 'entree', 5, 'Achat' from ingredients where nom='Poulet';
   select (select stock::float from ingredients where nom='Poulet') p`, ...A, (r) => (r[0].p === 14.7 ? null : JSON.stringify(r[0])));
await expectFail('visiteur : lecture ingrédients', 'select * from ingredients', 'anon');
await expectOk('connecté non admin : ne voit aucun ingrédient', 'select count(*)::int n from ingredients', 'authenticated', PIRATE, (r) => (r[0].n === 0 ? null : `voit ${r[0].n}`));
await expectOk('connecté non admin : ajout de stock sans effet',
  `insert into mouvements (ingredient_id, type, quantite) select id, 'entree', 100 from ingredients; select 1`, 'authenticated', PIRATE);
await expectOk('… stock inchangé', `select stock::float p from ingredients where nom='Poulet'`, null, null, (r) => (r[0].p === 14.7 ? null : JSON.stringify(r[0])));

// ---------------- Module rentabilité ----------------
const finance = fs.readFileSync(new URL('./finance.sql', import.meta.url), 'utf8');
await db.exec(finance);
await db.exec(finance);
console.log('✔ finance.sql appliqué deux fois sans erreur');
await expectOk('admin : ajoute une charge', `insert into charges (libelle, montant, type) values ('Loyer', 1200, 'mensuel'); select count(*)::int n from charges`,
  'authenticated', ADMIN, (r) => (r[0].n === 1 ? null : `n=${r[0].n}`));
await expectFail('visiteur : lecture charges', 'select * from charges', 'anon');
await expectOk('connecté non admin : ne voit aucune charge', 'select count(*)::int n from charges', 'authenticated', PIRATE, (r) => (r[0].n === 0 ? null : `voit ${r[0].n}`));
await expectFail('type de charge invalide', `insert into charges (libelle, montant, type) values ('X', 1, 'autre')`, 'authenticated', ADMIN);

console.log(failed ? `\n${failed} vérification(s) en échec` : '\nToutes les vérifications de sécurité passent.');
process.exit(failed ? 1 : 0);
