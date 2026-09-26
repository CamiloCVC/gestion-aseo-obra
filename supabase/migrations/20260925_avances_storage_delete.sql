-- El dueño de la orden puede borrar SOLO las fotos de sus propios avances
-- (ordenes/<id>/avances/...), no las de fotos_antes/fotos_despues (esas
-- siguen siendo borrables solo por staff, vía la policy existente
-- "staff elimina evidencia"). Necesario para que uploadAvance() (rollback
-- si el insert falla) y cleanupAvancesFor() (al completar la orden), que
-- corren con la sesión del empleado, puedan borrar de storage.
--
-- Sin esto, storage.remove() con esos paths simplemente no borra nada (RLS
-- los excluye del delete sin devolver error), dejando archivos huérfanos
-- para siempre. Detectado en code review antes de mergear.
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
