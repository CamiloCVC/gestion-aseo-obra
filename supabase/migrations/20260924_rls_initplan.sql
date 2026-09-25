-- Envuelve las llamadas a funciones en las policies con (select ...) para que
-- Postgres las evalúe UNA vez por consulta (initPlan) y no una vez por fila.
-- Mismo comportamiento, mucho menos costo con miles de filas.
-- Ref: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- Correr en Supabase → SQL Editor. `alter policy` es atómico: no hay ventana sin policy.

alter policy "usuarios ven su propio perfil" on profiles
  using (id = (select auth.uid()));
alter policy "superadmin ve todos los perfiles" on profiles
  using ((select is_superadmin()));
alter policy "superadmin edita cualquier perfil" on profiles
  using ((select is_superadmin())) with check ((select is_superadmin()));

alter policy "usuarios activos ven obras" on obras
  using ((select is_active_user()));
alter policy "staff crea obras" on obras
  with check ((select is_staff()));
alter policy "staff actualiza obras" on obras
  using ((select is_staff())) with check ((select is_staff()));
alter policy "staff elimina obras" on obras
  using ((select is_staff()));

alter policy "empleados crean sus propias ordenes" on ordenes
  with check (creado_por_id = (select auth.uid()) and (select is_active_user()));
alter policy "empleados ven las suyas, staff ve todas" on ordenes
  using (creado_por_id = (select auth.uid()) or (select is_staff()));
alter policy "staff elimina ordenes" on ordenes
  using ((select is_staff()));

alter policy "activos suben evidencia" on storage.objects
  with check (bucket_id = 'evidencias' and (select is_active_user()));
alter policy "solo staff ve evidencia" on storage.objects
  using (bucket_id = 'evidencias' and (select is_staff()));
alter policy "staff elimina evidencia" on storage.objects
  using (bucket_id = 'evidencias' and (select is_staff()));
