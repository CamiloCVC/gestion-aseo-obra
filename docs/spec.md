# Spec: Gestión de Aseo de Obra

## Estado

Retrofit — la app ya está construida y en producción (GitHub Pages +
Supabase). Este spec documenta lo existente como fuente de verdad y define
la estrategia de testing que faltaba. A partir de aquí, todo cambio nuevo
pasa por este flujo (spec → plan → tasks → implement).

## Supuestos que estoy haciendo

1. Node/npm es aceptable como dependencia de **desarrollo únicamente** para
   correr tests — no afecta el deploy (GitHub Pages sigue sirviendo HTML/JS
   plano, sin build step).
2. Los tests de integración/E2E necesitan un backend Supabase real (RLS no
   se puede probar con mocks de forma creíble) — la pregunta abierta es si
   contra un proyecto Supabase dedicado a pruebas o el mismo proyecto actual
   con datos desechables.
3. "Todo testeado" aplica tanto a lo ya construido (retrofit) como a todo lo
   nuevo de aquí en adelante.
4. No se pidió linting/CI todavía — lo dejo como pregunta abierta, no lo
   asumo incluido en "testeado".

→ Corrígeme si alguno de estos supuestos es incorrecto.

## Objetivo

Dar cobertura de test a una app de registro de aseo de obra (evidencia
antes/después por orden de trabajo, con roles empleado/admin/superadmin)
para poder cambiarla con confianza, sin regresiones silenciosas — en
particular en las políticas RLS, que son el único mecanismo real de
seguridad de la app.

## Tech Stack

- Frontend: HTML + CSS + JS vanilla (ES modules nativos, sin bundler ni
  framework), servido estático desde GitHub Pages.
- Backend: Supabase (Postgres + RLS, Storage, Auth, una Edge Function en
  Deno para creación de usuarios).
- Testing (a introducir): Vitest (unit + integración) y Playwright (E2E).

## Commands

```
Dev (preview local):  python3 -m http.server 8765
Unit tests:            npm run test:unit        (vitest run tests/unit)
Integración (RLS):     npm run test:integration (vitest run tests/integration)
E2E:                   npm run test:e2e         (playwright test)
Todo:                  npm test
```

## Estructura del proyecto

```
index.html, admin.html, mis-ordenes.html, nueva-orden.html, usuarios.html
css/styles.css
js/                     → módulos ES (un archivo por responsabilidad)
supabase/functions/     → Edge Functions (Deno)
supabase-schema.sql     → esquema de referencia (ya aplicado en el proyecto real)
docs/spec.md            → este documento
tasks/plan.md, tasks/todo.md → generados en las fases Plan/Tasks
tests/unit/             → Vitest, lógica pura de js/*.js
tests/integration/      → Vitest + supabase-js contra un proyecto de prueba
tests/e2e/              → Playwright contra el servidor local
```

## Code Style

Ya establecido en el código existente — se mantiene:

```js
// js/escape-html.js — módulos pequeños, una responsabilidad, sin dependencias
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}
```

- Sin build step: imports vía CDN (`https://cdn.jsdelivr.net/npm/...+esm`).
- Toda interpolación de datos de usuario en HTML pasa por `escapeHtml`.
- La autorización real vive en RLS (Postgres), nunca solo en el cliente —
  las validaciones de rol en JS son UX, no el control de acceso.

## Testing Strategy

**Nivel 1 — Unit (Vitest, sin red):**
- `escape-html.js`: casos con `&`, `<`, `>`, `"`, `'` y contexto de atributo
  (regresión del XSS que ya se corrigió).
- `auth.js` (`landingPageFor`): empleado → `mis-ordenes.html`,
  admin/superadmin → `admin.html`.
- `layout.js`: el set de links de navegación por rol (empleado vs
  admin vs superadmin ve/no ve "Usuarios") — se extrae como función pura
  testeable si hace falta.

**Nivel 2 — Integración (Vitest + `@supabase/supabase-js` real, sin
navegador):** el nivel de mayor valor, porque RLS es el control de acceso
real. Por cada política, un caso positivo y uno negativo:
- Empleado inserta su propia orden (OK) / no puede insertar con
  `creado_por_id` de otro usuario (bloqueado).
- Empleado lee solo sus órdenes; admin y superadmin leen todas.
- Usuario `activo=false` no puede insertar ni leer.
- Solo superadmin puede leer/editar la tabla `profiles` completa.
- Storage: solo staff activo puede generar signed URLs; cualquiera
  autenticado activo puede subir evidencia.
- Edge Function `admin-create-user`: rechaza sin JWT (401), rechaza si el
  caller no es superadmin (403), rechaza rol inválido (400), crea usuario
  correctamente (200) — y el preflight `OPTIONS` responde 2xx (regresión
  del bug de CORS que ya se corrigió).

**Nivel 3 — E2E (Playwright, contra el servidor local):**
- Login redirige por rol (empleado/admin/superadmin).
- Empleado crea una orden y la ve en "Mis órdenes".
- Admin ve todas las órdenes y puede previsualizar evidencia.
- Superadmin crea un usuario desde el panel y edita su rol/estado activo.
- Cuenta desactivada no puede iniciar sesión.

**Cobertura:** 80% en `js/*.js` vía unit tests (regla general del proyecto).
Integración/E2E se miden por escenario cubierto, no por %.

## Boundaries

- **Siempre:** todo cambio nuevo (feature o fix) trae su test antes de
  mergear; `npm test` en verde antes de cualquier push; RLS es la fuente de
  verdad de seguridad, no el JS del cliente.
- **Preguntar primero:** crear un segundo proyecto Supabase solo para
  tests; agregar CI (GitHub Actions); cualquier dependencia npm nueva más
  allá de vitest/playwright/@supabase/supabase-js (dev only).
- **Nunca:** correr tests de integración/E2E contra datos reales de
  producción; commitear `service_role key` o credenciales de prueba (usar
  `.env` + `.gitignore`, o secrets de GitHub Actions).

## Success Criteria

- [ ] `npm run test:unit` pasa, cubriendo `escape-html.js` y el ruteo por
      rol.
- [ ] `npm run test:integration` pasa contra un backend Supabase de
      pruebas, probando cada política RLS (caso positivo y negativo).
- [ ] `npm run test:e2e` pasa para los 5 flujos listados arriba.
- [ ] El comportamiento actual de la app no cambia (retrofit sin
      regresiones).

## Decisiones (resueltas con el usuario)

1. **Backend de test:** se reusa el proyecto actual ("Ambiental cristian").
   Las cuentas y órdenes de prueba se crean con prefijo `test-` en el
   correo (`test-empleado-<random>@example.com`, etc.) y cada suite limpia
   lo que creó al terminar (`afterAll`), tanto en éxito como en fallo.
2. **CI:** sí, GitHub Actions corre `npm test` en cada push a `main`. La
   URL y la `anon key` del proyecto no son secretas (ya están en
   `js/supabase-config.js`, pensadas para ser públicas), pero las cuentas
   de prueba con password sí requieren un `service_role key` de solo-tests
   para poder crearlas/borrarlas vía Admin API — ese sí va como GitHub
   Secret, nunca en el repo.
3. **Alcance:** retrofit completo — se escriben tests para todo lo ya
   construido, no solo para cambios futuros.
