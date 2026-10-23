// Vérifie supabase/schema.sql sur un Postgres local (PGlite) qui simule Supabase :
// isolation entre entreprises, rôles, formulaire public, relances, journal, quotas, purge.
// Lancer : npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
let failed = 0;
const ALICE = '11111111-1111-1111-1111-111111111111'; // admin entreprise A
const BOB = '22222222-2222-2222-2222-222222222222'; // admin entreprise B
const LUC = '33333333-3333-3333-3333-333333333333'; // invité « lecture » chez A
const GIL = '44444444-4444-4444-4444-444444444444'; // invité « gestion » chez A

async function run(sql, role, sub, params) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? '']);
  if (role) await db.exec(`set role ${role}`);
  try {
    if (params) return (await db.query(sql, params)).rows;
    const res = await db.exec(sql);
    return [...res].reverse().find((x) => x.rows?.length)?.rows ?? [];
  } finally {
    await db.exec('reset role');
  }
}

async function ok(label, sql, role, sub, check, params) {
  try {
    const rows = await run(sql, role, sub, params);
    const bad = check ? check(rows) : null;
    if (bad) throw new Error(bad);
    console.log('✔', label);
    return rows;
  } catch (e) {
    failed++;
    console.log('✘', label, '→', e.message);
    return [];
  }
}

async function ko(label, sql, role, sub, params) {
  try {
    await run(sql, role, sub, params);
    failed++;
    console.log('✘', label, '→ aurait dû échouer');
  } catch (e) {
    console.log('✔', label, `(refusé : ${e.message.split('\n')[0]})`);
  }
}

const one = (rows) => rows[0] ?? {};
const count = (n) => (rows) => (Number(one(rows).n) === n ? null : `n=${one(rows).n}, attendu ${n}`);

// --- Simulation minimale de Supabase --------------------------------------
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create role anon; create role authenticated; create role service_role bypassrls;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant select on auth.users to service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  insert into auth.users values
    ('${ALICE}', 'alice@calora.test'), ('${BOB}', 'bob@autre.test'), ('${LUC}', 'luc@calora.test'), ('${GIL}', 'gil@calora.test');
`);

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
await db.exec(schema);
await db.exec(schema);
console.log('✔ schéma appliqué deux fois sans erreur');

// --- Entreprises et membres ------------------------------------------------
const A = one(await ok('Alice crée l’entreprise A', `select create_company('Calora Services', 'Alice') as id`, 'authenticated', ALICE)).id;
const B = one(await ok('Bob crée l’entreprise B', `select create_company('Autre Clim', 'Bob') as id`, 'authenticated', BOB)).id;
await ko('visiteur : créer une entreprise', `select create_company('Pirate')`, 'anon');
await ok('A a 4 modèles de messages', `select count(*) n from templates where company_id = '${A}'`, 'authenticated', ALICE, count(4));
await ok('Bob ne voit pas l’entreprise A', `select count(*) n from companies where id = '${A}'`, 'authenticated', BOB, count(0));
await ok('Bob ne voit pas les modèles de A', `select count(*) n from templates where company_id = '${A}'`, 'authenticated', BOB, count(0));
await ko('Bob : se rajouter membre de A', `insert into memberships values ('${A}', '${BOB}', 'admin')`, 'authenticated', BOB);

await ok('Alice invite Luc (lecture) et Gil (gestion)',
  `insert into invitations (company_id, email, role, display_name) values ('${A}', 'luc@calora.test', 'lecture', 'Luc'), ('${A}', 'gil@calora.test', 'gestion', 'Gil')`,
  'authenticated', ALICE);
await ko('Bob : inviter dans A', `insert into invitations (company_id, email, role) values ('${A}', 'bob2@x.test', 'admin')`, 'authenticated', BOB);
await ok('Luc accepte son invitation', `select accept_invitations() as n`, 'authenticated', LUC, count(1));
await ok('Gil accepte son invitation', `select accept_invitations() as n`, 'authenticated', GIL, count(1));
await ok('Bob n’a aucune invitation', `select accept_invitations() as n`, 'authenticated', BOB, count(0));
await ko('Alice : se retirer le rôle admin (dernier admin)', `update memberships set role = 'gestion' where user_id = '${ALICE}'`, 'authenticated', ALICE);
// un UPDATE filtré par RLS ne lève pas d'erreur : on vérifie que rien n'a changé
await run(`update companies set name = 'Piraté' where id = '${A}'`, 'authenticated', GIL);
await ok('…le nom de A est inchangé', `select count(*) n from companies where name = 'Calora Services'`, null, null, count(1));

// --- Formulaire public -----------------------------------------------------
const tokenA = one(await run(`select form_token from companies where id = '${A}'`)).form_token;
const submit = (o, token = tokenA) => `select submit_request('${token}', '${JSON.stringify(o).replace(/'/g, "''")}'::jsonb) as ref`;
await ok('visiteur : infos publiques du formulaire', `select public_form_info('${tokenA}') as i`, 'anon', null,
  (r) => (one(r).i?.name === 'Calora Services' && !('form_token' in one(r).i) ? null : JSON.stringify(one(r).i)));
const ref1 = one(await ok('visiteur : dépose une demande',
  submit({ name: 'Nadia L.', email: 'Nadia@Exemple.test', postcode: '93100', city: 'Montreuil', need: 'installation', description: 'Clim séjour 25 m²' }),
  'anon', null, (r) => (one(r).ref === 'D-0001' ? null : one(r).ref))).ref;
await ok('visiteur : 2e demande → D-0002', submit({ name: 'Yann M.', phone: '0600000000', postcode: '93100', description: 'Plus de chauffage, bébé à la maison' }),
  'anon', null, (r) => (one(r).ref === 'D-0002' ? null : one(r).ref));
await ko('visiteur : demande sans coordonnées', submit({ name: 'X', postcode: '75001', description: 'test' }), 'anon');
await ko('visiteur : mauvais jeton', submit({ name: 'X', phone: '1', postcode: '75001', description: 'test' }, 'faux'), 'anon');
await ok('visiteur : champ piège rempli → ignoré', submit({ name: 'Bot', phone: '1', postcode: '1', description: 'spam', website: 'http://spam' }), 'anon', null,
  (r) => (one(r).ref === 'ok' ? null : one(r).ref));
await ok('visiteur : ne voit aucun dossier', `select count(*) n from dossiers`, 'anon', null, count(0));
await ko('visiteur : écrire directement un dossier', `insert into dossiers (company_id, name, ref, ref_num) values ((select id from companies limit 1), 'X', 'x', 0)`, 'anon');
await ok('e-mail enregistré en minuscules', `select count(*) n from dossiers where email = 'nadia@exemple.test'`, null, null, count(1));
await ok('compteur de demandes du mois = 2', `select requests n from usage_monthly where company_id = '${A}'`, null, null, count(2));
await ok('Bob ne voit aucun dossier de A', `select count(*) n from dossiers where company_id = '${A}'`, 'authenticated', BOB, count(0));
await ok('Luc (lecture) voit les 2 dossiers de A', `select count(*) n from dossiers`, 'authenticated', LUC, count(2));

const D1 = one(await run(`select id from dossiers where ref = '${ref1}' and company_id = '${A}'`)).id;
await run(`update dossiers set status = 'perdu' where id = '${D1}'`, 'authenticated', LUC);
await ok('Luc (lecture) : sa modification est ignorée', `select status from dossiers where id = '${D1}'`, null, null,
  (r) => (one(r).status === 'nouvelle' ? null : one(r).status));
await run(`update dossiers set status = 'perdu' where id = '${D1}'`, 'authenticated', BOB);
await ok('Bob : sa modification du dossier de A est ignorée', `select status from dossiers where id = '${D1}'`, null, null,
  (r) => (one(r).status === 'nouvelle' ? null : one(r).status));
await ko('Gil : changer la référence du dossier', `update dossiers set ref = 'D-9999' where id = '${D1}'`, 'authenticated', GIL);
await ko('Gil : déplacer le dossier vers l’entreprise B', `update dossiers set company_id = '${B}' where id = '${D1}'`, 'authenticated', GIL);
await ko('Bob : créer un dossier dans A', `insert into dossiers (company_id, name, ref, ref_num) values ('${A}', 'X', 'x', 0)`, 'authenticated', BOB);
await ok('Gil : met le dossier en « Infos manquantes »', `update dossiers set status = 'attente_infos' where id = '${D1}' returning status`, 'authenticated', GIL,
  (r) => (one(r).status === 'attente_infos' ? null : 'non modifié'));

// --- Journal -----------------------------------------------------------------
await ok('Gil : ajoute un événement au journal',
  `insert into events (company_id, dossier_id, type, text, actor_id) values ('${A}', '${D1}', 'out', 'Réponse envoyée', '${GIL}') returning id`, 'authenticated', GIL);
await ko('Gil : usurper l’auteur d’un événement',
  `insert into events (company_id, dossier_id, type, text, actor_id) values ('${A}', '${D1}', 'sys', 'x', '${ALICE}')`, 'authenticated', GIL);
const nEvents = Number(one(await run(`select count(*) n from events where company_id = '${A}'`)).n);
await run(`update events set text = 'effacé' where company_id = '${A}'`, 'authenticated', ALICE);
await run(`delete from events where company_id = '${A}'`, 'authenticated', ALICE);
await ok('Alice : modifier ou supprimer le journal → sans effet',
  `select count(*) filter (where text <> 'effacé') n from events where company_id = '${A}'`, null, null, count(nEvents));
await ko('serveur : modifier le journal', `update events set text = 'x'`, 'service_role');

// --- Devis et relances ---------------------------------------------------------
const Q1 = one(await ok('Gil : associe un devis envoyé',
  `insert into quotes (company_id, dossier_id, ref, amount_ht, sent_on, due_on, status) values ('${A}', '${D1}', 'Q-118', 4350, current_date, current_date + 30, 'envoye') returning id`,
  'authenticated', GIL)).id;
await ok('le dossier passe en « Devis envoyé »', `select status from dossiers where id = '${D1}'`, null, null,
  (r) => (one(r).status === 'devis_envoye' ? null : one(r).status));
await ko('Luc (lecture) : créer une séquence', `select create_sequence('${Q1}', false)`, 'authenticated', LUC);
await ko('Bob : créer une séquence sur le devis de A', `select create_sequence('${Q1}', false)`, 'authenticated', BOB);
const S1 = one(await ok('Gil : crée la séquence (à valider)', `select create_sequence('${Q1}', false) as id`, 'authenticated', GIL)).id;
await ko('anti-doublon : 2e séquence sur le même devis', `select create_sequence('${Q1}', true)`, 'authenticated', ALICE);
await ok('3 relances à valider, variables remplacées', `select count(*) n from sequence_steps where sequence_id = '${S1}' and status = 'a_valider' and body like '%Nadia L.%' and body like '%Q-118%' and body not like '%{%'`,
  null, null, count(3));
const steps = await run(`select id, position from sequence_steps where sequence_id = '${S1}' order by position`);
await ok('Gil : valide la relance 1', `update sequence_steps set status = 'programmee' where id = '${steps[0].id}' returning validated_by`, 'authenticated', GIL,
  (r) => (one(r).validated_by === GIL ? null : 'validated_by non renseigné'));
await ko('Gil : marquer une relance « envoyée »', `update sequence_steps set status = 'envoyee' where id = '${steps[1].id}'`, 'authenticated', GIL);
await ko('utilisateur : réserver les relances (fonction serveur)', `select * from claim_due_steps(10)`, 'authenticated', ALICE);
await ko('utilisateur : consommer un quota (fonction serveur)', `select use_quota('${A}', 'ai')`, 'authenticated', ALICE);

// Envoi par le serveur : on force l'échéance et une fenêtre d'envoi ouverte en permanence
await run(`update companies set send_start_hour = 0, send_end_hour = 24, send_saturday = true where id = '${A}';
           update sequence_steps set due_at = now() - interval '1 minute' where id = '${steps[0].id}';`);
await run(`update companies set timezone = 'UTC' where id = '${A}'`);
const claimed = await ok('serveur : réserve la relance due', `select * from claim_due_steps(10)`, 'service_role', null,
  (r) => (r.length === 1 && r[0].to_email === 'nadia@exemple.test' ? null : JSON.stringify(r)));
await ok('serveur : 2e réservation → rien (pas de double envoi)', `select count(*) n from claim_due_steps(10)`, 'service_role', null, count(0));
await ok('serveur : échec temporaire → nouvel essai programmé', `select finish_step('${claimed[0]?.step_id}', false, 'timeout')`, 'service_role');
await ok('…relance reprogrammée avec 1 tentative', `select status, attempts from sequence_steps where id = '${steps[0].id}'`, null, null,
  (r) => (one(r).status === 'programmee' && one(r).attempts === 1 ? null : JSON.stringify(one(r))));
await run(`update sequence_steps set due_at = now() - interval '1 minute' where id = '${steps[0].id}'`);
const again = await run(`select * from claim_due_steps(10)`, 'service_role');
await ok('serveur : envoi réussi', `select finish_step('${again[0]?.step_id}', true)`, 'service_role');
await ok('serveur : appel répété sans effet (idempotent)', `select finish_step('${again[0]?.step_id}', true)`, 'service_role');
await ok('…une seule trace d’envoi dans le journal', `select count(*) n from events where dossier_id = '${D1}' and text = 'Relance 1 envoyée par e-mail'`, null, null, count(1));
await ko('Gil : remettre en attente une relance envoyée', `update sequence_steps set status = 'a_valider' where id = '${steps[0].id}'`, 'authenticated', GIL);

// Réponse du client → arrêt automatique
await ok('serveur : e-mail entrant rattaché par jeton',
  `select record_inbound((select reply_token from dossiers where id = '${D1}'), 'nadia@exemple.test', 'Merci, je vous rappelle') is not null as ok`, 'service_role', null,
  (r) => (one(r).ok ? null : 'non rattaché'));
await ok('…séquence arrêtée « Le client a répondu »', `select state, stop_reason from sequences where id = '${S1}'`, null, null,
  (r) => (one(r).state === 'arretee' && one(r).stop_reason === 'Le client a répondu' ? null : JSON.stringify(one(r))));
await ok('…relances restantes annulées', `select count(*) n from sequence_steps where sequence_id = '${S1}' and status = 'annulee'`, null, null, count(2));
await ok('…devis passé « En attente »', `select status from quotes where id = '${Q1}'`, null, null, (r) => (one(r).status === 'en_attente' ? null : one(r).status));
await ok('serveur : e-mail entrant inconnu → ignoré', `select record_inbound('inconnu', 'personne@x.test', 'hello') is null as ok`, 'service_role', null,
  (r) => (one(r).ok ? null : 'rattaché à tort'));

// Changement de statut du devis → arrêt automatique
const S2 = one(await ok('nouvelle séquence possible après l’arrêt', `select create_sequence('${Q1}', true) as id`, 'authenticated', ALICE)).id;
await ok('Alice : devis accepté', `update quotes set status = 'accepte' where id = '${Q1}' returning id`, 'authenticated', ALICE);
await ok('…séquence arrêtée « Statut du devis changé : Accepté »', `select state, stop_reason from sequences where id = '${S2}'`, null, null,
  (r) => (one(r).state === 'arretee' && one(r).stop_reason === 'Statut du devis changé : Accepté' ? null : JSON.stringify(one(r))));
await ok('…dossier « Devis accepté »', `select status from dossiers where id = '${D1}'`, null, null, (r) => (one(r).status === 'gagne' ? null : one(r).status));

// Expiration
const D2 = one(await run(`select id from dossiers where ref = 'D-0002' and company_id = '${A}'`)).id;
await run(`update dossiers set email = 'yann@exemple.test' where id = '${D2}'`);
const Q2 = one(await run(`insert into quotes (company_id, dossier_id, ref, sent_on, due_on, status) values ('${A}', '${D2}', 'Q-119', current_date - 40, current_date - 10, 'envoye') returning id`, 'authenticated', GIL)).id;
const S3 = one(await ok('séquence sur un devis ancien : dates recalées dans le futur', `select create_sequence('${Q2}', true) as id`, 'authenticated', GIL)).id;
await ok('…aucune relance dans le passé', `select count(*) n from sequence_steps where sequence_id = '${S3}' and due_at <= now()`, null, null, count(0));
await ok('serveur : expire les devis échus', `select expire_quotes() n`, 'service_role', null, count(1));
await ok('…séquence arrêtée « Statut du devis changé : Expiré »', `select stop_reason from sequences where id = '${S3}'`, null, null,
  (r) => (one(r).stop_reason === 'Statut du devis changé : Expiré' ? null : one(r).stop_reason));

// Suspendre / reprendre
const Q3 = one(await run(`insert into quotes (company_id, dossier_id, ref, sent_on, due_on, status) values ('${A}', '${D2}', 'Q-120', current_date, current_date + 30, 'envoye') returning id`, 'authenticated', GIL)).id;
const S4 = one(await run(`select create_sequence('${Q3}', true) as id`, 'authenticated', GIL)).id;
await ok('Gil : suspend la séquence', `select set_sequence_state('${S4}', 'suspendue')`, 'authenticated', GIL);
await run(`update sequence_steps set due_at = now() - interval '1 minute' where sequence_id = '${S4}' and position = 1`);
await ok('serveur : séquence suspendue → rien à envoyer', `select count(*) n from claim_due_steps(10)`, 'service_role', null, count(0));
await ok('Gil : reprend la séquence (échéance dépassée recalée)', `select set_sequence_state('${S4}', 'active')`, 'authenticated', GIL);
await ok('…plus aucune relance en retard', `select count(*) n from sequence_steps where sequence_id = '${S4}' and due_at <= now()`, null, null, count(0));
await ko('Luc (lecture) : arrêter la séquence', `select set_sequence_state('${S4}', 'arretee')`, 'authenticated', LUC);

// --- Quotas -------------------------------------------------------------------
await run(`update companies set limit_ai = 2 where id = '${A}'`);
await ok('quota IA : 1er appel accepté', `select use_quota('${A}', 'ai') as ok`, 'service_role', null, (r) => (one(r).ok ? null : 'refusé'));
await ok('quota IA : 2e appel accepté', `select use_quota('${A}', 'ai') as ok`, 'service_role', null, (r) => (one(r).ok ? null : 'refusé'));
await ok('quota IA : 3e appel refusé', `select use_quota('${A}', 'ai') as ok`, 'service_role', null, (r) => (one(r).ok === false ? null : 'accepté'));

// --- Export et suppression -------------------------------------------------------
await ok('Alice : export complet sans jetons secrets', `select export_company('${A}') as x`, 'authenticated', ALICE,
  (r) => { const x = one(r).x; return x.dossiers.length === 2 && x.events.length > 5 && !('form_token' in x.company) && !('reply_token' in x.dossiers[0]) ? null : 'export incomplet'; });
await ko('Gil (gestion) : export', `select export_company('${A}')`, 'authenticated', GIL);
await ko('Bob : export de A', `select export_company('${A}')`, 'authenticated', BOB);
await ko('Gil : effacer un dossier', `select delete_dossier('${D2}')`, 'authenticated', GIL);
await ok('Alice : efface le dossier D-0002 (droit à l’effacement)', `select delete_dossier('${D2}')`, 'authenticated', ALICE);
await ok('…dossier, devis, relances et journal supprimés',
  `select (select count(*) from dossiers where id = '${D2}') + (select count(*) from quotes where dossier_id = '${D2}') + (select count(*) from events where dossier_id = '${D2}') as n`,
  null, null, count(0));
await ko('Alice : supprimer A avec une mauvaise confirmation', `select delete_company('${A}', 'calora')`, 'authenticated', ALICE);
await ok('Alice : supprime A', `select delete_company('${A}', 'Calora Services')`, 'authenticated', ALICE);
await ok('…plus aucune donnée de A', `select (select count(*) from companies where id = '${A}') + (select count(*) from events where company_id = '${A}') as n`, null, null, count(0));
await ok('…l’entreprise B est intacte', `select count(*) n from companies where id = '${B}'`, null, null, count(1));

console.log(failed ? `\n${failed} test(s) en échec` : '\nTous les tests SQL passent');
process.exit(failed ? 1 : 0);
