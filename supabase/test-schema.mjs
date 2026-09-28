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
    const r = await db.query(sql);
    return r.rows;
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

console.log(failed ? `\n${failed} vérification(s) en échec` : '\nToutes les vérifications de sécurité passent.');
process.exit(failed ? 1 : 0);
