-- Limpieza mensual de fotos: el día 15 a las 00:00 hora Colombia (05:00 UTC)
-- se borran las fotos de evidencias/ordenes/ subidas el mes anterior.
-- Solo archivos; las órdenes se conservan.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secretos en Vault: la URL del proyecto y un secreto aleatorio generado
-- aquí mismo (nadie lo copia ni lo ve). pg_cron lo envía en x-cron-secret
-- y la Edge Function lo valida con cron_secret_matches().
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'project_url') then
    perform vault.create_secret('https://bvbbxsxvmflzosrheaoz.supabase.co', 'project_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret');
  end if;
end $$;

create or replace function public.cron_secret_matches(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cron_secret' and decrypted_secret = p_secret
  );
$$;

-- Rutas a borrar. Se lee storage.objects directo (una query) en vez de
-- recorrer carpetas con storage.list(); el borrado real va por la Storage
-- API para que también se eliminen los archivos físicos.
create or replace function public.evidencias_paths_between(p_from timestamptz, p_to timestamptz)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select name from storage.objects
  where bucket_id = 'evidencias'
    and name like 'ordenes/%'
    and created_at >= p_from
    and created_at < p_to;
$$;

revoke execute on function public.cron_secret_matches(text) from public, anon, authenticated;
grant execute on function public.cron_secret_matches(text) to service_role;
revoke execute on function public.evidencias_paths_between(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.evidencias_paths_between(timestamptz, timestamptz) to service_role;

select cron.schedule(
  'cleanup-evidencias-mes-anterior',
  '0 5 15 * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/cleanup-evidencias',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
