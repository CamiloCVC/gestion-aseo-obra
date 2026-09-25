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

---

# Todo: Filtro por período, paginación y exportación CSV de órdenes

Plan en `tasks/plan.md` (sección al final). Spec: `docs/spec-ordenes-filtros-export.md`.

- [x] Task: `pagination.js` (TDD)
  - Acceptance: `PAGE_SIZE=15`; `pageInfo(page,total)` devuelve `{from,to,totalPages,offset}`
    correcto para 132 (1–15, 121–132), múltiplo exacto de 15, total 0 y página fuera de rango (clamp)
  - Verify: `npm run test:unit`
  - Files: js/pagination.js, tests/unit/pagination.spec.js

- [x] Task: `orders-query.js` (TDD)
  - Acceptance: `applyOrderFilters` aplica eq/gte/lt/or con un builder falso; sin
    filtros no agrega nada; `hasta` = inicio del día siguiente local; búsqueda
    escapa `% _ , ( ) " \`; no muta el argumento de filtros
  - Verify: `npm run test:unit`
  - Files: js/orders-query.js, tests/unit/orders-query.spec.js

- [x] Task: `csv.js` (TDD)
  - Acceptance: BOM + `;` + `\r\n`; comillas duplicadas; saltos de línea; null/undefined → vacío;
    ñ/tildes intactas; celdas que empiezan con `= + - @ \t \r` se prefijan con `'`;
    nombre de archivo `ordenes_<desde|inicio>_<hasta|hoy>.csv` / `ordenes_YYYY-MM-DD.csv`
  - Verify: `npm run test:unit`
  - Files: js/csv.js, tests/unit/csv.spec.js

- [x] Task: `dateRangeSchema` en validation.js (TDD)
  - Nota: implementado como `validateDateRange` en orders-query.js (validation.js importa zod por https, no corre en Vitest/Node)
  - Acceptance: vacíos y solo-uno pasan; `desde > hasta` falla con mensaje en español
  - Verify: `npm run test:unit`
  - Files: js/validation.js, tests/unit/validation.spec.js

- [ ] Task: Policy "staff ve todos los perfiles"
  - Acceptance: definida en supabase-schema.sql y aplicada al proyecto real (con
    autorización del usuario); un admin no-superadmin ve nombre en "Creado por"
  - Verify: consulta `profiles` con sesión admin devuelve todas las filas
  - Files: supabase-schema.sql
  - Bloqueado por: autorización explícita del usuario para aplicar al proyecto real

- [~] Task: Admin — filtros en servidor, paginación y contador (código listo; falta verificar en navegador con sesión real)
  - Acceptance: filtros Buscar/Empleado/Obra/Desde/Hasta vacíos al inicio; ≤15 filas por
    página; contador `16–30 de N` arriba a la izquierda; cambiar filtro vuelve a página 1;
    `desde > hasta` avisa y no consulta; borrar la última orden de la última página no
    deja tabla vacía; contador de peticiones (ignora respuestas obsoletas); PGRST103 → head count + reintento; Empleado se llena desde `profiles`
  - Verify: navegador (python3 -m http.server 8765) con >30 órdenes; `npm test`
  - Files: admin.html, js/admin.js, css/styles.css, (usa js/pagination.js, js/orders-query.js)

- [~] Task: Mis órdenes — período, paginación y contador (código listo; falta verificar en navegador con sesión real)
  - Acceptance: Desde/Hasta vacíos, ≤15 por página, contador, paginador; sigue limitado a
    `creado_por_id = uid`
  - Verify: navegador con sesión empleado
  - Files: mis-ordenes.html, js/mis-ordenes.js

- [~] Task: Exportar CSV (solo admin) (código listo; falta verificar en navegador con sesión real)
  - Acceptance: botón "Exportar CSV" visible solo en admin.html; trae TODAS las filas del
    filtro combinado en lotes de 1000 con orden `created_at desc, id desc`; deshabilita el
    botón mientras corre; corte fijo `created_at <= inicio` + dedupe por id + verificación contra count inicial; toast con N o error; 0 resultados → toast y sin archivo;
    columnas y formato según spec
  - Verify: con >1000 órdenes de prueba, filas del CSV == contador; abre bien en Excel es-CO
  - Files: admin.html, js/admin.js, (usa js/csv.js, js/orders-query.js)

- [ ] Task: Verificación final
  - Acceptance: sin overflow horizontal a 320/768/1024/1440; empleado no ve exportar;
    búsquedas con `, % ( "` sin error; `npm test` verde
  - Verify: revisión en navegador + `npm test` + code-reviewer
  - Files: ninguno

- [x] Task: RLS initPlan — envolver funciones de policies en `(select ...)`
  - Acceptance: todas las policies usan `(select is_staff())` etc.; comportamiento idéntico
  - Verify: correr `supabase/migrations/20260924_rls_initplan.sql` en el SQL Editor; probar login empleado/admin/superadmin
  - Files: supabase-schema.sql, supabase/migrations/20260924_rls_initplan.sql
  - Pendiente: aplicarla al proyecto real (usuario, no hay CLI/MCP de Supabase en esta sesión)
