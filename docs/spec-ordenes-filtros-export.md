# Spec: Filtro por período, paginación y exportación CSV de órdenes

## Estado

**Aprobado por el usuario** (Specify). Siguiente: Plan → Tasks → Implement. Complementa `docs/spec.md` (testing retrofit); aplica sus
Boundaries y su estrategia de testing.

## Supuestos que estoy haciendo

Confirmados por el usuario:
1. Formato de exportación: **CSV** (sin dependencia nueva).
2. Alcance: las dos tablas de órdenes — `admin.html` ("Todas las órdenes") y
   `mis-ordenes.html`. Usuarios y Obras **no** se tocan.
3. El período filtra por **`ordenes.fecha_hora`** (la fecha del trabajo, primera
   columna de la tabla), no por `created_at`.
4. El botón de exportar solo es visible para **admin/superadmin**.

Míos (corrígeme si alguno está mal):
5. **El botón de exportar vive solo en `admin.html`.** `mis-ordenes.html` no
   tiene exportar, ni siquiera si el que la mira es admin.
6. `mis-ordenes.html` recibe **filtro de período + paginación + contador**
   (no gana los filtros de texto/empleado/obra que hoy solo tiene admin).
7. Hoy el filtrado se hace en el navegador sobre *todas* las órdenes cargadas.
   Con paginación esto **pasa a ser en servidor** (Supabase `.range()` +
   `count: "exact"`), y la tabla y el CSV comparten exactamente la misma
   función de filtros.
8. El filtro "Fecha" actual (un solo día) **se reemplaza** por "Desde / Hasta".
   Ambos inician vacíos; se puede llenar solo uno (rango abierto).
9. ~~Fechas en la zona horaria del navegador~~ → **Todo en hora de Colombia
   (America/Bogota, UTC-5)**: el formulario de nueva orden envía `fecha_hora`
   con offset `-05:00`; tabla, detalle, CSV y límites de día (Desde/Hasta) se
   muestran/calculan en hora de Colombia, formato 24 h `YYYY-MM-DD HH:mm`.
   "Hasta" es inclusivo (todo el día seleccionado). Las órdenes anteriores se
   guardaron con la hora digitada como UTC y se corrigen con un UPDATE de +5 h
   (`supabase/migrations/`).
10. El CSV usa **`;` como separador + BOM UTF-8**, porque Excel en configuración
    regional es-CO/es-ES abre los `,` todo en una sola columna. Sheets/LibreOffice
    también lo leen bien.
11. Los números del contador se formatean con `es-CO` (`14.332`, no `14,332`
    como en tu imagen de ejemplo).
12. **Hay un hueco de permisos que afecta esto (importante):** `profiles` solo
    es legible por su dueño o por superadmin. Un **admin** (no superadmin) hoy ve
    "Creado por" vacío en órdenes ajenas y su dropdown de Empleado sale vacío.
    Con el CSV, la columna "Creado por" saldría vacía para admins. Propongo una
    policy `staff ve todos los perfiles` (ver Open Questions).

→ Corrígeme ahora o procedo con estos.

## Objetivo

Permitir a admin/superadmin trabajar con volúmenes grandes de órdenes (el
ejemplo es del orden de 10⁴ filas): acotarlas por período, navegarlas de a
15, saber siempre qué rango se está viendo y cuántas hay, y bajar **todas** las
que cumplen el filtro combinado a un CSV. El empleado obtiene el mismo
período + paginación + contador sobre sus propias órdenes.

Historias:
- Como admin filtro "obra X, últimos 30 días" y la tabla, el contador y el CSV
  reflejan exactamente ese mismo conjunto (100 órdenes → 100 filas en el CSV).
- Como empleado acoto mis órdenes por período y las recorro paginadas.

## Tech Stack

Sin cambios: HTML + CSS + JS vanilla (ES modules), Supabase JS v2 vía CDN,
zod 4 vía CDN (`js/validation.js`), Vitest para unit tests. **Cero
dependencias nuevas.**

## Commands

```
Dev (preview local):  python3 -m http.server 8765
Unit tests:           npm run test:unit
Todo:                 npm test
```

## Comportamiento

### Filtros (admin.html)
Buscar (texto) · Empleado · Obra · **Desde** · **Hasta** · Limpiar filtros.
Se combinan con AND. Al cambiar cualquiera: página vuelve a 1. Búsqueda de
texto con debounce (300 ms); selects y fechas aplican al instante.
- Desde/Hasta con `<input type="date">`. Si ambos están y `Desde > Hasta` →
  toast de error y **no** se consulta.
- Texto: `ilike` sobre `piso`, `contratista`, `comentarios`. Los comodines
  `%`/`_` del usuario se escapan como literales; los caracteres reservados de
  PostgREST (`,` `(` `)` `"` `\`) no rompen la consulta.

### Filtros (mis-ordenes.html)
Solo Desde / Hasta / Limpiar. La consulta sigue con `.eq("creado_por_id", uid)`.

### Paginación
- Tamaño fijo: **15** (constante `PAGE_SIZE`).
- Orden estable: `created_at desc, id desc` (el `id` desempata para que no se
  dupliquen/salten filas entre páginas).
- Controles bajo la tabla: `‹ Anterior · Página X de Y · Siguiente ›`;
  deshabilitados en los extremos; ocultos si hay ≤ 15 resultados.
- Si tras borrar una orden o refrescar la página actual queda fuera de rango,
  se retrocede a la última página válida (sin pantalla vacía ni error 416).
- "Actualizar" conserva filtros y página.

### Contador
Arriba a la izquierda de la tabla: **`16–30 de 132`** (`es-CO`). Sin
resultados: `0 de 0` + el empty state existente. Se actualiza con cada
consulta usando el `count` exacto del servidor (mismo filtro).

### Exportar CSV (solo admin.html, solo staff)
- Botón "Exportar CSV" arriba a la derecha de la tabla, con icono lucide.
- Ignora la paginación y **aplica los filtros vigentes** (mismo builder de
  consulta que la tabla). Trae los datos en lotes de 1000 (`max_rows` de
  Supabase) con el mismo orden estable hasta agotar.
- Durante la descarga: botón deshabilitado + texto "Exportando…". Al terminar:
  toast "N órdenes exportadas." Error de red/servidor: toast de error, sin
  archivo parcial. Con 0 resultados: toast "No hay órdenes para exportar." y
  no se genera archivo.
- Archivo: `ordenes_<desde|inicio>_<hasta|hoy>.csv` sin filtros de fecha →
  `ordenes_YYYY-MM-DD.csv` (fecha de hoy).
- Columnas: `Fecha/hora` (`YYYY-MM-DD HH:mm` local) · `Obra` · `Piso/Lugar` ·
  `Contratista` · `Creado por` · `Email` · `Fotos antes` (cantidad) ·
  `Fotos después` (cantidad) · `Estado` (Pendiente/Completa) · `Comentarios` ·
  `ID`.
- Formato: UTF-8 con BOM, `;`, `\r\n`, valores con `;` `"` o saltos de línea
  entre comillas con `"` duplicada. **Protección contra CSV injection:**
  celdas de texto que empiezan con `= + - @` (o tab/CR) se prefijan con `'`.
- Seguridad: la autorización sigue siendo RLS; ocultar el botón es UX. Un
  empleado que llame la misma consulta solo obtendría sus propias filas.

## Project Structure

```
admin.html, mis-ordenes.html   → toolbar (contador/exportar), filtros Desde/Hasta, paginador
js/orders-query.js   (nuevo)   → applyOrderFilters(query, filters) + buildDateRange() [única fuente de filtros]
js/pagination.js     (nuevo)   → PAGE_SIZE, pageInfo(page,total), renderPager(...)
js/csv.js            (nuevo)   → toCsv(rows, columns), escape + anti-injection, filename
js/admin.js, js/mis-ordenes.js → consumen los módulos; admin.js agrega exportOrders()
js/validation.js               → dateRangeSchema (Desde <= Hasta)
css/styles.css                 → .table-toolbar, .pager (reusa tokens/botones existentes)
supabase-schema.sql            → policy "staff ve todos los perfiles" (si se aprueba)
tests/unit/                    → orders-query, pagination, csv, validation
```

## Code Style

Se mantiene el estilo actual (módulos pequeños, una responsabilidad, `escapeHtml`
en toda interpolación a HTML, imports por CDN, sin mutar argumentos):

```js
// js/orders-query.js — una sola fuente de verdad para tabla + export
export function applyOrderFilters(query, { search, empleadoId, obraId, desde, hasta }) {
  let q = query;
  if (empleadoId) q = q.eq("creado_por_id", empleadoId);
  if (obraId) q = q.eq("obra_id", obraId);
  if (desde) q = q.gte("fecha_hora", startOfDayIso(desde));
  if (hasta) q = q.lt("fecha_hora", startOfNextDayIso(hasta));
  if (search) q = q.or(searchClause(search));
  return q;
}
```

## Testing Strategy

Regla del proyecto: test primero (TDD), 80 % en los módulos nuevos.

**Unit (Vitest, sin red):**
- `pagination`: rango `1–15 de 132`, última página parcial `121–132`, 0 resultados,
  total exacto múltiplo de 15, clamp de página fuera de rango.
- `orders-query`: con un query-builder falso que registra llamadas — cada filtro
  llama lo esperado; sin filtros no agrega nada; fronteras de día
  (`hasta = 2026-03-31` ⇒ `< 2026-04-01T00:00 local`); escape de `% _ , ( ) " \`
  en la búsqueda.
- `csv`: BOM, separador, comillas duplicadas, saltos de línea, `null`/`undefined`,
  acentos/ñ, anti-injection (`=1+1`, `+x`, `-x`, `@x`), nombre de archivo.
- `validation`: `Desde > Hasta` falla; vacíos/uno solo pasan.

**Verificación manual en navegador** (rule `web/testing.md`): 320, 768, 1024,
1440 sin overflow; navegar páginas; combinar filtros y comprobar que
contador == filas del CSV; abrir el CSV en Excel/Sheets con tildes y ñ;
sesión empleado no ve el botón. La E2E de Playwright queda para el plan de
testing retrofit (aún no existe la infraestructura).

## Boundaries

- **Siempre:** `escapeHtml` en toda interpolación; una sola función de filtros
  para tabla y export; test antes del código; `npm test` verde antes de push.
- **Preguntar primero:** cambios en RLS/esquema (la policy de `profiles`),
  cualquier dependencia nueva (p. ej. XLSX), cambiar `PAGE_SIZE`.
- **Nunca:** filtrar/paginar en cliente sobre todas las filas; exportar solo
  la página visible; fiarse de ocultar el botón como control de acceso;
  commitear credenciales.

## Success Criteria

- [ ] Todos los filtros (incl. Desde/Hasta) inician vacíos y "Limpiar" los vacía.
- [ ] Con 40 órdenes de prueba, la tabla muestra ≤ 15 filas por página y el
      contador dice `1–15 de 40`, `16–30 de 40`, `31–40 de 40`.
- [ ] Filtro obra X + período: tabla, contador y CSV muestran el **mismo N**
      (p. ej. 100 → 100 filas de datos + 1 de encabezado, aun con N > 1000).
- [ ] Sin filtros, el CSV contiene todas las órdenes visibles por RLS.
- [ ] `Desde > Hasta` no consulta y avisa; solo-Desde y solo-Hasta funcionan.
- [ ] El CSV abre en Excel es-CO con columnas separadas, tildes/ñ correctas y
      sin ejecutar fórmulas.
- [ ] Empleado: sin botón exportar; su tabla paginada y con período.
- [ ] Borrar la última orden de la última página no deja la tabla vacía.
- [ ] Búsquedas con `,` `%` `(` `"` no producen error de consulta.
- [ ] `npm test` en verde; sin overflow horizontal a 320/768/1024/1440.

## Decisiones (resueltas con el usuario)

1. **Policy `staff ve todos los perfiles`**: aprobada. Se agrega a
   `supabase-schema.sql` y se aplica al proyecto real (con autorización
   explícita en el momento de aplicarla).
2. **Separador CSV `;` + BOM UTF-8**: aprobado.
3. **Contador arriba a la izquierda de la tabla**: aprobado (no se duplica
   junto al paginador).

## Riesgos y mitigaciones (decididas)

Volumen esperado: cientos de órdenes al mes, así que se implementa solo lo
barato que evita bugs silenciosos.

- **Resultados obsoletos (búsqueda con debounce):** contador de peticiones;
  solo la última respuesta pinta la tabla/contador.
- **Página fuera de rango (PGRST103):** se recalcula la página con
  `min(pagina, totalPáginas)` antes de consultar (p. ej. tras borrar); si aun así
  llega PGRST103, se cuenta con `head` y se reintenta una vez en la última página.
- **Datos cambiando durante el export:** corte fijo `created_at <= inicio` en
  todos los lotes, dedupe por `id` y verificación contra el count inicial; si no
  coincide, toast "los datos cambiaron, vuelve a exportar".
- **RLS por fila:** policies con `(select fn())` — ya hecho
  (`supabase/migrations/20260924_rls_initplan.sql`).
- **Descartado (YAGNI):** tope de filas, barra de progreso, `AbortController`,
  keyset pagination, `EXPLAIN ANALYZE`.
