-- Estado explícito de la orden. Antes se inferría de
-- cardinality(fotos_despues) = 0, pero eso rompe con "reabrir": una orden
-- reabierta debe volver a Pendiente sin perder las fotos de después que ya
-- tenía (el empleado solo agrega más si quiere).
alter table ordenes add column if not exists completada boolean not null default false;
update ordenes set completada = true where cardinality(fotos_despues) > 0;

drop policy if exists "dueño o staff completan una orden pendiente" on ordenes;
create policy "dueño o staff completan una orden pendiente"
  on ordenes for update
  to authenticated
  using (
    (creado_por_id = (select auth.uid()) or (select is_staff()))
    and completada = false
  )
  with check (
    creado_por_id = (select auth.uid()) or (select is_staff())
  );

create policy "staff reabre una orden completada"
  on ordenes for update
  to authenticated
  using ((select is_staff()) and completada = true)
  with check ((select is_staff()));

drop policy if exists "dueño o staff agregan avances mientras esté pendiente" on avances;
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
        and o.completada = false
    )
  );
