-- Admin y superadmin pueden leer todos los perfiles (nombre/email/rol).
-- Necesario para "Creado por", el filtro de Empleado y la columna del CSV cuando
-- quien mira es admin (no superadmin). Editar perfiles sigue siendo solo superadmin.
-- Correr en Supabase → SQL Editor.

create policy "staff ve todos los perfiles"
  on profiles for select
  to authenticated
  using ((select is_staff()));
