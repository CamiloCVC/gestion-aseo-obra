-- El admin/superadmin ahora puede completar y agregar avances a CUALQUIER
-- orden pendiente, no solo las que él mismo creó (petición del cliente:
-- las acciones de gestión del empleado también deben estar disponibles
-- para el admin).
--
-- Nota: la policy "empleados completan su propia orden pendiente" que se
-- reemplaza aquí no estaba documentada en supabase-schema.sql (se había
-- aplicado directo al proyecto sin dejar migración) — queda registrada
-- ahora junto con su reemplazo.

drop policy if exists "empleados completan su propia orden pendiente" on ordenes;

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

drop policy if exists "dueño de la orden agrega avances mientras esté pendiente" on avances;

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
