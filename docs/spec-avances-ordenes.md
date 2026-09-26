# Spec: Avances (trazabilidad) de órdenes en proceso

## Estado

**Aprobado por el usuario** (Specify). Siguiente: Plan → Tasks → Implement.
Complementa `docs/spec.md` y `docs/spec-ordenes-filtros-export.md`; aplica sus
Boundaries y su estrategia de testing.

## Supuestos que estoy haciendo

Confirmados por el usuario:
1. Al completar la orden (subir fotos de "después"), los avances **se
   eliminan de la base de datos** (filas + fotos en storage). El registro de
   avances solo tiene sentido mientras la orden está en proceso.
2. "Ver avances" (línea de tiempo con franjas diarias) es una acción **solo
   de `admin.html`**. El empleado no tiene esa vista; solo tiene el botón de
   agregar avance.

Míos (corrígeme si alguno está mal):
3. El botón "Agregar avance" vive en `mis-ordenes.html`, en la columna de
   acciones, visible mientras la orden está **Pendiente** (mismas condiciones
   que hoy tiene "Completar orden": es su propia orden y `fotos_despues`
   sigue vacío). Desaparece cuando la orden pasa a Completa.
4. El botón no abre ningún formulario ni dropzone: dispara directo un
   `<input type="file" accept="image/*" capture="environment" multiple>`
   (abre cámara en móvil). Al seleccionar, se comprimen y se suben de una,
   sin paso de confirmación intermedio (igual de directo que pidió el
   cliente). Puede repetirse cuantas veces quiera en el día → cada click es
   un avance nuevo (una fila con su propio `created_at` y su propio array de
   fotos).
5. Un avance no se puede editar ni borrar individualmente desde la UI (ni
   empleado ni admin). Solo desaparecen todos juntos al completar la orden, o
   al eliminar la orden completa (admin).
6. Reutilizo el bucket de storage `evidencias` existente con la misma
   convención de carpetas (`ordenes/<orden_id>/...`), agregando el segmento
   `avances`: `ordenes/<orden_id>/avances/<timestamp>-<archivo>`. Las
   policies de storage actuales ya autorizan por `orden_id` en esa posición
   de la ruta, así que **no se toca RLS de storage**.
7. Agrupación por franja diaria en "Ver avances": se calcula en el cliente
   con `colombiaDay()` (ya existe en `format-date.js`) sobre el `created_at`
   de cada avance, uniendo las fotos de todos los avances de un mismo día en
   un solo carrusel (orden cronológico ascendente dentro del día). Las
   franjas (cards) se listan **más reciente primero**.
8. Sin límite propio de cantidad de fotos por avance ni de avances por día
   (más allá de lo que ya impone `image-compression.js`).

→ Corrígeme ahora o procedo con estos.

## Objetivo

Las órdenes de aseo pueden extenderse varios días. Hoy solo existen "fotos
antes" (al crear) y "fotos después" (al completar) — no hay forma de ver qué
pasó en el medio. El empleado necesita registrar avances (fotos) cuantas
veces quiera durante el día, y el supervisor necesita ver esa trazabilidad
agrupada por día, con las fotos de cada franja en un carrusel.

Historias:
- Como empleado, en mi tabla de órdenes le doy a "Agregar avance" sobre una
  orden pendiente, la cámara se abre, tomo una o varias fotos y quedan
  guardadas con fecha y hora — sin salir de la tabla.
- Como admin, le doy a "Ver avances" sobre una orden y veo un modal con
  tarjetas por día (desplegables); al abrir una tarjeta veo el carrusel con
  todas las fotos que se subieron ese día.
- Como admin, cuando el empleado completa la orden, el historial de avances
  desaparece (ya no es relevante); el detalle final sigue mostrando antes/después.

## Tech Stack

Sin cambios: HTML + CSS + JS vanilla (ES modules), Supabase JS v2 vía CDN,
Vitest para unit tests. **Cero dependencias nuevas.**

## Commands

```
Dev (preview local):  python3 -m http.server 8765
Unit tests:           npm run test:unit
Todo:                 npm test
```

## Comportamiento

### Tabla — empleado (`mis-ordenes.html`)
- Nueva acción en `.icon-actions`, icono lucide `camera`, tooltip "Agregar
  avance", visible solo si `isPending` (igual condición que "Completar
  orden"; aquí siempre es su propia orden porque RLS ya filtra por dueño).
- Click → abre un `<input type="file" accept="image/*" capture="environment"
  multiple hidden>` vía `.click()`. `change` → por cada archivo: comprimir
  con `compressImage` → subir a
  `ordenes/<orden_id>/avances/<Date.now()>-<nombre>` en el bucket
  `evidencias` → `insert` en `avances` con `orden_id`, `fotos: [rutas...]`
  (un solo insert con todas las rutas de esa selección, no uno por foto).
- Mientras sube: botón deshabilitado + estado en el toast ("Subiendo
  avance..."). Éxito: toast "Avance registrado."; error: toast de error, sin
  dejar filas/fotos huérfanas a medio subir (si falla el insert después de
  subir fotos, se borran las fotos ya subidas de storage antes de mostrar el
  error).

### Tabla — admin (`admin.html`)
- Nueva acción en `.icon-actions`, icono lucide `history`, tooltip "Ver
  avances", visible siempre que la orden exista (tenga o no avances; si no
  tiene, el modal muestra el empty state).
- Click → `select * from avances where orden_id = :id order by created_at`
  → agrupar por `colombiaDay(created_at)` → pintar en un modal nuevo
  (`<dialog id="avances-modal">`) una tarjeta por día (más reciente arriba),
  con fecha visible en el header de la tarjeta y un `<details>`/desplegable
  que al abrirse pinta `renderCarousel(...)` con las fotos de ese día (URLs
  firmadas, 10 min, igual que el detalle existente).
- Empty state si la orden no tiene avances: "Sin avances registrados."

### Completar orden (`completar-orden.js`)
- Tras guardar `fotos_despues` con éxito: leer `fotos` de todas las filas
  `avances` de esa orden, `storage.remove(...)` esas rutas, y `delete from
  avances where orden_id = :id`. Best-effort: si esta limpieza falla, la
  orden ya quedó completada (no se revierte); se loguea el error pero no se
  le muestra como fallo de la operación principal al empleado.

### Eliminar orden (admin, `deleteOrder`)
- Antes de borrar la orden: incluir también las rutas de fotos de `avances`
  de esa orden en el `storage.remove(...)` existente (junto a fotos_antes/
  fotos_despues). El `delete` de la orden ya cascadea el borrado de las
  filas de `avances` por FK; solo falta no dejar huérfanos los archivos.

## Modelo de datos

```sql
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
```

No se requieren cambios en las policies de `storage.objects`: ya autorizan
por `orden_id` en el segundo segmento de la ruta (`ordenes/<id>/...`), y
`ordenes/<id>/avances/...` cae en el mismo patrón.

## Project Structure

```
js/avances.js          (nuevo) → groupAvancesByDay(avances), uploadAvance(...), deleteAvancesFor(orderId, paths)
js/mis-ordenes.js      → botón "Agregar avance" + input file oculto + wireAvanceCapture(...)
js/admin.js            → botón "Ver avances" + dialog nuevo + openAvances(order)
js/completar-orden.js  → limpieza de avances tras completar
supabase-schema.sql    → tabla avances + policies (arriba)
supabase/migrations/   → 20260925_avances.sql (crea tabla avances + policies)
admin.html             → <dialog id="avances-modal">
mis-ordenes.html       → <input type="file" id="avance-input" hidden>
css/styles.css         → .avance-card, .avance-card summary (reusa .gallery/.carousel existentes)
tests/unit/avances.spec.js (nuevo) → groupAvancesByDay
```

## Code Style

```js
// js/avances.js — agrupación pura, testeable sin red
import { colombiaDay } from "./format-date.js";

export function groupAvancesByDay(avances) {
  const byDay = new Map();
  for (const avance of avances) {
    const day = colombiaDay(new Date(avance.created_at));
    const fotos = byDay.get(day) ?? [];
    byDay.set(day, [...fotos, ...(avance.fotos ?? [])]);
  }
  return [...byDay.entries()]
    .map(([day, fotos]) => ({ day, fotos }))
    .sort((a, b) => b.day.localeCompare(a.day));
}
```

## Testing Strategy

Regla del proyecto: test primero (TDD), 80 % en los módulos nuevos.

**Unit (Vitest, sin red):**
- `avances.spec.js`: agrupa varios avances del mismo día en un solo grupo
  con fotos concatenadas en orden; separa correctamente avances de días
  distintos; orden descendente por día; entrada vacía → `[]`.

**Verificación manual en navegador** (rule `web/testing.md`):
- Móvil real o emulado: el botón "Agregar avance" abre la cámara
  (`capture="environment"`), permite una o varias fotos, y el avance se ve
  reflejado (verificable desde "Ver avances" en admin).
- Subir avances en dos días distintos (o insertar `created_at` de prueba) y
  confirmar que "Ver avances" arma dos tarjetas separadas, cada una con su
  propio carrusel.
- Completar la orden y confirmar que "Ver avances" queda vacío (los avances
  se borraron) y que las fotos ya no existen en el bucket.
- Eliminar una orden con avances pendientes y confirmar que no quedan
  archivos huérfanos en `evidencias`.
- 320/768/1024/1440 sin overflow en el modal de avances.

## Boundaries

- **Siempre:** `escapeHtml` en toda interpolación; RLS como control de
  acceso real (el botón oculto es solo UX); limpiar storage antes de borrar
  filas para no dejar archivos huérfanos.
- **Preguntar primero:** cualquier cambio de esquema/RLS adicional, cualquier
  dependencia nueva, cambiar la convención de rutas de storage.
- **Nunca:** dejar fotos en storage sin fila que las referencie (o viceversa);
  permitir agregar avances a una orden ya completada; mostrar "Ver avances"
  a empleados.

## Success Criteria

- [ ] Empleado con orden pendiente ve "Agregar avance"; con orden completa,
      no lo ve.
- [ ] Click en "Agregar avance" abre la cámara en móvil y sube una o varias
      fotos como un solo avance con fecha/hora.
- [ ] Se puede repetir "Agregar avance" varias veces el mismo día sin límite.
- [ ] Admin ve "Ver avances" en cualquier orden; con avances, un modal con
      una tarjeta desplegable por día (más reciente primero); al desplegar,
      carrusel con todas las fotos de ese día; sin avances, empty state.
- [ ] Al completar una orden, sus avances (filas y fotos) desaparecen; "Ver
      avances" queda vacío para esa orden.
- [ ] Al eliminar una orden con avances, no quedan archivos huérfanos en el
      bucket `evidencias`.
- [ ] `npm test` en verde; sin overflow horizontal a 320/768/1024/1440.

## Riesgos y mitigaciones (decididas)

- **Fotos subidas pero insert fallido:** rollback manual (`storage.remove`)
  de lo ya subido antes de mostrar el error, igual que ya se maneja en otros
  flujos de subida del proyecto.
- **Limpieza de avances falla tras completar:** no revierte la orden
  completada (ya está guardada); queda como best-effort con log de error.
- **Descartado (YAGNI):** editar/borrar avances individuales, límite de
  fotos por avance, vista de avances para el empleado, paginación dentro del
  modal de avances (volumen esperado: unos pocos avances por orden).
