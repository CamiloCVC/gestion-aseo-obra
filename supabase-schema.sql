-- Esquema completo de referencia. El proyecto real ya tiene esto aplicado
-- (vía Supabase MCP); este archivo sirve para recrear el backend desde cero
-- si alguna vez se necesita un proyecto nuevo. Ejecutar en el SQL Editor.

-- 1. Crea primero el bucket de Storage "evidencias" como privado
--    (Storage → New bucket → Public bucket: OFF) antes de correr este script.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null,
  role text not null default 'empleado' check (role in ('empleado','admin','superadmin')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "usuarios ven su propio perfil"
  on profiles for select
  to authenticated
  using (id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), new.email, 'empleado');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('admin','superadmin') and p.activo
  );
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'superadmin' and p.activo
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.activo from profiles p where p.id = auth.uid()), false);
$$;

revoke execute on function public.is_staff() from public;
revoke execute on function public.is_superadmin() from public;
revoke execute on function public.is_active_user() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

create policy "superadmin ve todos los perfiles"
  on profiles for select
  to authenticated
  using ((select is_superadmin()));

create policy "staff ve todos los perfiles"
  on profiles for select
  to authenticated
  using ((select is_staff()));

create policy "superadmin edita cualquier perfil"
  on profiles for update
  to authenticated
  using ((select is_superadmin()))
  with check ((select is_superadmin()));

-- Obras activas/inactivas, seleccionables al crear una orden
create table if not exists obras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table obras enable row level security;

create policy "usuarios activos ven obras"
  on obras for select
  to authenticated
  using ((select is_active_user()));

create policy "staff crea obras"
  on obras for insert
  to authenticated
  with check ((select is_staff()));

create policy "staff actualiza obras"
  on obras for update
  to authenticated
  using ((select is_staff()))
  with check ((select is_staff()));

create policy "staff elimina obras"
  on obras for delete
  to authenticated
  using ((select is_staff()));

create table if not exists ordenes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id),
  piso text not null,
  contratista text not null,
  fecha_hora timestamptz not null,
  comentarios text,
  fotos_antes text[] not null default '{}',
  fotos_despues text[] not null default '{}',
  creado_por_id uuid not null default auth.uid() references profiles(id),
  created_at timestamptz not null default now()
);

alter table ordenes enable row level security;

create policy "empleados crean sus propias ordenes"
  on ordenes for insert
  to authenticated
  with check (creado_por_id = (select auth.uid()) and (select is_active_user()));

create policy "empleados ven las suyas, staff ve todas"
  on ordenes for select
  to authenticated
  using (creado_por_id = (select auth.uid()) or (select is_staff()));

create policy "staff elimina ordenes"
  on ordenes for delete
  to authenticated
  using ((select is_staff()));

-- El dueño de la orden o cualquier staff pueden completarla (subir
-- fotos_despues) mientras siga pendiente.
create policy "dueño o staff completan una orden pendiente"
  on ordenes for update
  to authenticated
  using (
    (creado_por_id = (select auth.uid()) or (select is_staff()))
    and cardinality(fotos_despues) = 0
  )
  with check (
    creado_por_id = (select auth.uid()) or (select is_staff())
  );

create policy "activos suben evidencia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'evidencias' and (select is_active_user()));

create policy "staff o el dueño de la orden ve su evidencia"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidencias'
    and (
      (select is_staff())
      or exists (
        select 1 from ordenes o
        where o.creado_por_id = (select auth.uid())
          and o.id::text = (storage.foldername(objects.name))[2]
      )
    )
  );

create policy "staff elimina evidencia"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'evidencias' and (select is_staff()));

-- El dueño de la orden puede borrar SOLO las fotos de sus propios avances
-- (ordenes/<id>/avances/...), no las de fotos_antes/fotos_despues (esas
-- siguen siendo borrables solo por staff, vía la policy de arriba).
-- Necesario para que uploadAvance() (rollback si el insert falla) y
-- cleanupAvancesFor() (al completar la orden), que corren con la sesión
-- del empleado, puedan borrar de storage.
create policy "dueño borra fotos de sus avances"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidencias'
    and (storage.foldername(objects.name))[3] = 'avances'
    and exists (
      select 1 from ordenes o
      where o.creado_por_id = (select auth.uid())
        and o.id::text = (storage.foldername(objects.name))[2]
    )
  );

-- Avances (trazabilidad de progreso mientras una orden está en proceso).
-- Se borra completa (filas + fotos en storage) al completar la orden.
create table if not exists avances (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes(id) on delete cascade,
  fotos text[] not null default '{}',
  creado_por_id uuid not null default auth.uid() references profiles(id),
  created_at timestamptz not null default now()
);

alter table avances enable row level security;

-- El dueño de la orden o cualquier staff pueden agregar avances mientras
-- la orden siga pendiente.
create policy "dueño o staff agregan avances mientras esté pendiente"
  on avances for insert
  to authenticated
  with check (
    creado_por_id = (select auth.uid())
    and (select is_active_user())
    and exists (
      select 1 from ordenes o
      where o.id = orden_id
        and (o.creado_por_id = (select auth.uid()) or (select is_staff()))
        and coalesce(array_length(o.fotos_despues, 1), 0) = 0
    )
  );

create policy "dueño ve sus avances, staff ve todos"
  on avances for select
  to authenticated
  using (
    (select is_staff())
    or exists (
      select 1 from ordenes o
      where o.id = orden_id and o.creado_por_id = (select auth.uid())
    )
  );

create policy "dueño o staff borran avances"
  on avances for delete
  to authenticated
  using (
    (select is_staff())
    or exists (
      select 1 from ordenes o
      where o.id = orden_id and o.creado_por_id = (select auth.uid())
    )
  );

-- No se tocan las policies de storage.objects: ya autorizan por orden_id en
-- el segundo segmento de la ruta (ordenes/<id>/...); las fotos de avances
-- usan ordenes/<id>/avances/<archivo>, mismo patrón.

-- Primer superadmin: crea el usuario en Authentication → Add user,
-- luego promuévelo manualmente:
-- update profiles set role = 'superadmin' where email = 'tu-correo@ejemplo.com';

-- La Edge Function supabase/functions/admin-create-user/index.ts crea el
-- resto de usuarios (empleados/admin/superadmin) desde la sección "Usuarios"
-- del panel superadmin. Se despliega con:
--   supabase functions deploy admin-create-user --project-ref <ref>
