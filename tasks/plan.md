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
