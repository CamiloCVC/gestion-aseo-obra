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

-- Primer superadmin: crea el usuario en Authentication → Add user,
-- luego promuévelo manualmente:
-- update profiles set role = 'superadmin' where email = 'tu-correo@ejemplo.com';

-- La Edge Function supabase/functions/admin-create-user/index.ts crea el
-- resto de usuarios (empleados/admin/superadmin) desde la sección "Usuarios"
-- del panel superadmin. Se despliega con:
--   supabase functions deploy admin-create-user --project-ref <ref>
