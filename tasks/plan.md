# Plan: Testing retrofit

Ver decisiones en `docs/spec.md`. Este plan cubre solo la infraestructura de
testing (no features nuevas — esas se planifican aparte cuando aplique).

## Fases

1. **Scaffold de tooling** (sin dependencias de backend)
   - `package.json` con `vitest`, `@playwright/test`, `@supabase/supabase-js`
     como devDependencies.
   - `vitest.config.js`, `playwright.config.js`.
   - `.gitignore`: `node_modules/`, `.env`, `test-results/`,
     `playwright-report/`.
   - Riesgo: ninguno, no toca código de producción.

2. **Cuentas de prueba fijas** (bloqueado en una acción tuya)
   - 3 cuentas persistentes: `test-empleado@example.com`,
     `test-admin@example.com`, `test-superadmin@example.com`.
   - Las creas tú desde `usuarios.html` (ya funciona) con las contraseñas
     que quieras — no necesito verlas, solo los nombres de las variables de
     entorno donde las guardes.
   - Van a un `.env` local (gitignorado) y luego a GitHub Secrets para CI.

3. **Unit tests** (`tests/unit/`) — sin red, corren ya con la fase 1 lista.
   - `escape-html.spec.js`, `auth.spec.js` (`landingPageFor`).
   - Si agregamos lógica pura nueva (ej. cálculo de dimensiones al
     comprimir imágenes), su test vive aquí también.

4. **Integración RLS** (`tests/integration/`) — depende de la fase 2.
   - Un caso positivo y uno negativo por política (detalle completo en
     `docs/spec.md`).
   - Caveat importante: `ordenes` no tiene política de `delete` (es
     inmutable a propósito). Los tests que insertan filas de prueba las
     dejan marcadas con `piso: '[TEST] ...'` y NO se pueden borrar solas
     — es un costo aceptado de reusar el proyecto real en vez de uno
     dedicado. Los perfiles de prueba sí son fijos y reutilizables (no se
     crean/destruyen por corrida), así que no acumulan basura.
   - El único caso que sí crea un usuario nuevo por corrida es
     "admin-create-user crea correctamente" — ese requiere el
     `service_role key` del proyecto para poder borrar al usuario de
     prueba después (Admin API). Tú lo copias de Settings → API y me lo
     pasas como variable de entorno local / secret de CI, nunca al repo.

5. **E2E** (`tests/e2e/`) — depende de fases 1-3.
   - Playwright contra `python3 -m http.server` local, mismas 3 cuentas
     fijas.

6. **CI** (`.github/workflows/test.yml`) — depende de todo lo anterior en
   verde localmente.
   - `npm ci && npm test` en cada push a `main`.
   - Secrets: contraseñas de las 3 cuentas fijas + el `service_role key`
     de prueba.

## Orden de ejecución

1 → (2 en paralelo, es tuya) → 3 → 4 → 5 → 6.

## Verificación por fase

Cada fase termina cuando su comando (`npm run test:unit`, etc.) corre en
verde localmente antes de pasar a la siguiente.

---

# Plan: Filtro por período, paginación y exportación CSV de órdenes

Spec: `docs/spec-ordenes-filtros-export.md` (aprobado). Independiente del
plan de testing retrofit de arriba; los unit tests nuevos usan el mismo
Vitest ya instalado.

## Grafo de dependencias

```
pagination.js ─┐
orders-query.js ┼─► admin (tabla+filtros+contador) ─► exportar CSV
csv.js ────────┤                                       ▲
validation.js ─┘─► mis-ordenes (período+paginación)    │
policy profiles ─► dropdown Empleado / "Creado por" ───┘ (para admin no-superadmin)
CSS toolbar/pager ─► admin y mis-ordenes
```

## Fases (cortes verticales, cada una deja la app funcionando)

1. **Núcleo puro, TDD** — `pagination.js`, `orders-query.js`, `csv.js`,
   `dateRangeSchema` en `validation.js`. Sin tocar HTML. Riesgo bajo; es donde
   viven los edge cases (fronteras de día, escape de búsqueda, CSV injection).
2. **Policy de perfiles** — agregar a `supabase-schema.sql` y aplicar al
   proyecto real. Independiente, se puede hacer en paralelo con la 1.
   Riesgo: cambio de RLS → pedir autorización explícita al aplicarla.
3. **Admin: filtros servidor + paginación + contador** — `admin.html/js`,
   CSS. Reemplaza el filtrado en memoria. Dropdown Empleado pasa a leer
   `profiles`. Riesgo principal: carreras entre consultas (debounce +
   ignorar respuestas viejas) y página fuera de rango tras borrar (PGRST103 →
   contar con `head` y recalcular la última página).
4. **Mis órdenes: período + paginación + contador** — reusa los módulos de 1
   y el CSS de 3. Cambio pequeño y aislado.
5. **Exportar CSV (solo admin)** — lotes de 1000 con orden estable, mismo
   `applyOrderFilters`. Riesgo: memoria con decenas de miles de filas
   (aceptado; techo ~cientos de miles) y consistencia si cambian los datos
   durante la descarga (aceptado).
6. **Verificación final** — 4 breakpoints, cruce contador == filas del CSV
   con >1000 filas de prueba, CSV en Excel, sesión empleado.

## Orden

1 ∥ 2 → 3 → 4 → 5 → 6. La 5 depende de 3 (UI de filtros) y de 1 (`csv.js`).

## Checkpoints

Tras 1: `npm test` verde. Tras 3: revisar en navegador la tabla admin antes de
seguir. Tras 5: contador vs CSV. Al final: `npm test` + revisión de código.
