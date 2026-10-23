-- =====================================================================
--  SUIVIO — Envoi automatique des relances (toutes les 15 min)
--  À exécuter EN DERNIER, quand la fonction « followups » est déployée
--  et que RESEND_API_KEY, EMAIL_FROM et CRON_SECRET sont définis.
--  Remplacer VOTRE_PROJET et REMPLACER_PAR_CRON_SECRET.
--  Pour tout arrêter : select cron.unschedule('suivio-relances');
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('suivio-relances');
exception when others then
  null; -- pas encore planifié
end $$;

select cron.schedule(
  'suivio-relances',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://VOTRE_PROJET.supabase.co/functions/v1/followups',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'REMPLACER_PAR_CRON_SECRET'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
