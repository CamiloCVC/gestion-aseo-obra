# Todo: Testing retrofit

- [ ] Task: Scaffold package.json + vitest + playwright config
  - Acceptance: `npm run test:unit` corre (aunque sin tests todavía) sin error
  - Verify: `npm run test:unit`
  - Files: package.json, vitest.config.js, playwright.config.js, .gitignore

- [ ] Task: Crear 3 cuentas de prueba fijas (empleado/admin/superadmin)
  - Acceptance: las 3 existen en Supabase, activas, con contraseñas conocidas
  - Verify: login manual con cada una desde la app
  - Files: ninguno (acción manual del usuario vía usuarios.html)
  - Bloqueado por: usuario

- [ ] Task: Unit tests de escape-html y auth (landingPageFor)
  - Acceptance: casos con `&<>"'` y contexto de atributo cubiertos; ruteo
    por rol cubierto
  - Verify: `npm run test:unit`
  - Files: tests/unit/escape-html.spec.js, tests/unit/auth.spec.js

- [ ] Task: Integración — RLS de ordenes (empleado/staff/inactivo)
  - Acceptance: positivo+negativo por cada regla listada en docs/spec.md
  - Verify: `npm run test:integration`
  - Files: tests/integration/ordenes-rls.spec.js

- [ ] Task: Integración — RLS de storage.objects
  - Acceptance: solo staff activo lee, cualquiera activo autenticado sube
  - Verify: `npm run test:integration`
  - Files: tests/integration/storage-rls.spec.js

- [ ] Task: Integración — RLS de profiles (solo superadmin ve/edita todo)
  - Acceptance: empleado/admin no pueden leer perfiles ajenos ni editar
  - Verify: `npm run test:integration`
  - Files: tests/integration/profiles-rls.spec.js

- [ ] Task: Integración — Edge Function admin-create-user
  - Acceptance: 401 sin JWT, 403 si no es superadmin, 400 rol inválido,
    200 + limpieza del usuario creado, preflight OPTIONS responde 2xx
  - Verify: `npm run test:integration`
  - Files: tests/integration/admin-create-user.spec.js
  - Bloqueado por: service_role key de prueba (usuario)

- [ ] Task: E2E — login redirige por rol
  - Acceptance: empleado → mis-ordenes.html, admin/superadmin → admin.html
  - Verify: `npm run test:e2e`
  - Files: tests/e2e/login.spec.js

- [ ] Task: E2E — empleado crea orden y la ve en Mis órdenes
  - Verify: `npm run test:e2e`
  - Files: tests/e2e/nueva-orden.spec.js

- [ ] Task: E2E — admin ve todas las órdenes y previsualiza evidencia
  - Verify: `npm run test:e2e`
  - Files: tests/e2e/admin.spec.js

- [ ] Task: E2E — superadmin crea/edita usuario, cuenta desactivada no entra
  - Verify: `npm run test:e2e`
  - Files: tests/e2e/usuarios.spec.js

- [ ] Task: CI workflow
  - Acceptance: `npm test` corre en cada push a main, en verde
  - Verify: push de prueba y revisar el run en GitHub Actions
  - Files: .github/workflows/test.yml
  - Bloqueado por: secrets de CI (usuario)
