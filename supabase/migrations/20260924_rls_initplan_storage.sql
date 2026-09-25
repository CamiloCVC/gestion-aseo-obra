-- Continuación de 20260924_rls_initplan.sql para storage.objects, con los nombres reales
-- de las policies del proyecto. Misma semántica, solo funciones envueltas en (select ...).

alter policy "activos suben evidencia" on storage.objects
  with check (bucket_id = 'evidencias' and (select is_active_user()));

alter policy "staff elimina evidencia" on storage.objects
  using (bucket_id = 'evidencias' and (select is_staff()));

alter policy "staff o el dueño de la orden ve su evidencia" on storage.objects
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
