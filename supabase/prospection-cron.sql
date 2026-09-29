-- =====================================================================
--  MEDINA FUSION — Passage automatique de la prospection (toutes les 15 min)
--  À exécuter EN DERNIER, seulement quand :
--   1. prospection.sql est installé,
--   2. la fonction « prospection » est déployée,
--   3. « Vérifier la connexion » et « Envoyer un test » ont réussi dans l'admin.
--  Remplacer REMPLACER_PAR_CRON_SECRET par la même valeur que le secret CRON_SECRET.
--  Pour tout arrêter : select cron.unschedule('prospection-tick');
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('prospection-tick');
exception when others then
  null; -- pas encore planifié
end $$;

select cron.schedule(
  'prospection-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://cnyjdpzazuekzwjwhzkc.supabase.co/functions/v1/prospection',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'REMPLACER_PAR_CRON_SECRET'),
    body := '{"action":"tick"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
