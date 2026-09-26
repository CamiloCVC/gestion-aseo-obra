-- Tabla de avances (trazabilidad de progreso mientras una orden está en
-- proceso). Se borra completa (filas + fotos en storage) al completar la
-- orden — ver js/avances.js#cleanupAvancesFor.

create table if not exists avances (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes(id) on delete cascade,
  fotos text[] not null default '{}',
  creado_por_id uuid not null default auth.uid() references profiles(id),
  created_at timestamptz not null default now()
);

alter table avances enable row level security;

create policy "dueño de la orden agrega avances mientras esté pendiente"
  on avances for insert
  to authenticated
  with check (
    creado_por_id = (select auth.uid())
    and (select is_active_user())
    and exists (
      select 1 from ordenes o
      where o.id = orden_id
        and o.creado_por_id = (select auth.uid())
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

-- Nota: no se tocan las policies de storage.objects. Ya autorizan por
-- orden_id en el segundo segmento de la ruta (ordenes/<id>/...), y las
-- fotos de avances usan ordenes/<id>/avances/<archivo>, mismo patrón.
