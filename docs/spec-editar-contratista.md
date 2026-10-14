# Spec: Editar el contratista de una orden (admin)

## Estado

**Pendiente de aprobación** (Specify). Complementa `docs/spec.md`; aplica sus
Boundaries y su estrategia de testing.

## Supuestos que estoy haciendo

1. "Admins" = `admin` y `superadmin` (los que ya entran a `admin.html`).
   El empleado **no** puede editar el contratista, ni de sus propias órdenes.
2. Solo se edita `ordenes.contratista` (texto libre, hoy `text not null`).
   Obra, piso, fecha y comentarios quedan fuera de alcance.
3. Aplica a **cualquier** orden, Pendiente o Completa. Editar no cambia el
   estado ni las fotos.
4. La edición vive en `admin.html`: un botón con ícono `pencil` ("Editar
   contratista") en la columna de acciones, visible en todas las filas. Abre
   un `<dialog>` con un solo input prellenado y Guardar/Cancelar (mismo
   patrón que "Editar obra" en `obras.html`).
5. Sin historial/auditoría del valor anterior (no existe auditoría hoy).
6. **No hace falta migración ni cambio de RLS**: las políticas UPDATE
   existentes ya permiten a staff actualizar órdenes pendientes
   ("dueño o staff completan una orden pendiente") y completadas ("staff
   reabre una orden completada"). Si en pruebas reales Supabase rechaza el
   update, lo reporto y se agrega una policy.
7. Misma validación que al crear: `trim()`, mínimo 1 carácter. Reutilizo un
   schema zod en `validation.js` junto a `editObraSchema`.
8. Tras guardar: toast de éxito, se recarga la página actual de la tabla
   (`loadOrders(currentPage)`), igual que `reopenOrder`.

→ Corrígeme ahora o procedo con estos.

## Objetivo

Si al crear la orden se escribió mal el contratista (o cambió), hoy no hay
cómo corregirlo salvo eliminar la orden y perder las fotos. El admin debe
poder corregirlo en cualquier momento.

## Tech Stack

HTML + JS vanilla (ES modules), Supabase (Postgres + RLS), zod 4 por CDN,
Vitest 5 para unit tests, lucide para íconos.

## Commands

```
Test: npm test
Dev:  servir la carpeta estática (p. ej. npx serve .) y abrir admin.html
```

## Project Structure

```
admin.html           → agregar <dialog id="edit-contratista-modal">
js/admin.js          → botón en renderOrders + handler de submit
js/validation.js     → editContratistaSchema
tests/unit/          → validation.spec.js (nuevo) para el schema
```

## Code Style

```js
export const editContratistaSchema = z.object({
  contratista: z.string().trim().min(1, "El contratista es obligatorio."),
});
```

Botones de acción: `icon-btn` + `data-tooltip` + `aria-label` + `data-lucide`.

## Testing Strategy

- Unit (Vitest): `editContratistaSchema` acepta texto con espacios (recortado)
  y rechaza vacío/solo espacios.
- Manual en navegador real (regla del proyecto para UI nueva): como admin,
  editar una orden Pendiente y una Completa → el valor cambia en la tabla, en
  "Ver detalle" y en el CSV exportado; como empleado, `mis-ordenes.html` no
  muestra el botón.

## Boundaries

- Always: escapar con `escapeHtml`, validar con zod antes de enviar, mostrar
  error de Supabase en toast.
- Ask first: agregar migración/RLS, columna de auditoría, convertir
  contratista en catálogo.
- Never: tocar fotos/estado de la orden, permitir edición al empleado.

## Success Criteria

- [ ] Admin/superadmin ve el botón en órdenes Pendientes y Completas.
- [ ] Guardar actualiza `ordenes.contratista` y la tabla muestra el nuevo valor.
- [ ] Valor vacío o solo espacios se rechaza con mensaje, sin llamar a la API.
- [ ] El empleado no ve el botón (y RLS no le permite el cambio).
- [ ] `npm test` en verde.

## Open Questions

- ¿Quieres que el campo sea texto libre (como hoy) o prefieres sugerir los
  contratistas ya usados (datalist)? Asumo texto libre.
