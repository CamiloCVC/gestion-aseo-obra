# Gestión de Aseo de Obra

App estática (HTML/CSS/JS, sin build step) para registrar evidencia
fotográfica de antes/después de limpieza de escombros por orden de trabajo.
Backend: Supabase (Postgres + Storage + Auth + una Edge Function), free tier
sin tarjeta. Pensada para GitHub Pages.

## Roles

- **Empleado**: inicia sesión, ve sus propias órdenes (`mis-ordenes.html`) y
  crea nuevas (`nueva-orden.html`).
- **Admin**: ve todas las órdenes de cualquier empleado (`admin.html`, con
  previsualización de evidencia) y también puede crear órdenes.
- **Superadmin**: todo lo del admin, más una sección de usuarios
  (`usuarios.html`) para crear, editar y eliminar cuentas, y una sección de
  obras (`obras.html`) para crear obras y activarlas/desactivarlas.

## Arquitectura

Todo el frontend es HTML/JS estático servible desde GitHub Pages. La única
pieza que corre en un servidor es una Edge Function de Supabase
(`supabase/functions/admin-create-user`), necesaria porque crear una cuenta
(email + password) requiere la Admin API de Supabase Auth con la
`service_role key` — una clave que **nunca** debe llegar al navegador, ya
que bypassa todos los controles de acceso (RLS). La función vive en
Supabase, valida que quien la llama sea un superadmin activo, y recién ahí
crea el usuario. Editar nombre/rol/estado de un usuario ya existente sí se
hace directo desde el navegador, porque son operaciones normales de base de
datos protegidas por RLS.

## Setup desde cero (si se necesita otro proyecto)

1. Cuenta en [supabase.com](https://supabase.com) (sin tarjeta) → New
   project.
2. Storage → New bucket → `evidencias` → **Public bucket: OFF**.
3. SQL Editor → correr `supabase-schema.sql`.
4. Authentication → Users → Add user → crea el primer usuario, y en SQL
   Editor: `update profiles set role = 'superadmin' where email = '...';`
5. Deploy de la Edge Function: `supabase functions deploy admin-create-user
   --project-ref <ref>` (o pégala manualmente en el dashboard).
6. Project Settings → Data API → copia URL y `anon`/`publishable` key a
   `js/supabase-config.js`.
7. Desde `usuarios.html`, el superadmin crea al resto de cuentas — no hace
   falta volver al dashboard de Supabase.

## Deploy a GitHub Pages

1. Sube este repo a GitHub.
2. Settings → Pages → Source: `main` branch, carpeta `/ (root)`.
3. La URL quedará en `https://<usuario>.github.io/<repo>/`.

## Modelo de datos

- `profiles`: `id` (= `auth.users.id`), `nombre`, `email`, `role`
  (`empleado`/`admin`/`superadmin`), `activo`.
- `obras`: `nombre`, `activa` — lista de obras activas que se muestra como
  select al crear una orden. Solo staff (admin/superadmin) puede crear o
  editar obras.
- `ordenes`: `obra_id` (referencia a `obras`, opcional), `piso`,
  `contratista`, `fecha_hora`, `comentarios`, `fotos_antes`/`fotos_despues`
  (rutas dentro del bucket, no URLs — son privadas y se firman al vuelo con
  `createSignedUrls`), `creado_por_id`.

Las imágenes se guardan en el bucket `evidencias` bajo
`ordenes/{orderId}/antes/` y `ordenes/{orderId}/despues/`.

## Borrado

- Solo staff (admin/superadmin) puede eliminar órdenes, desde `admin.html`.
  Al eliminar una orden también se borran sus fotos del bucket `evidencias`.
- Solo superadmin puede eliminar usuarios, desde `usuarios.html`. El borrado
  usa la Edge Function `admin-create-user` (método `DELETE`) para eliminar
  la cuenta vía Admin API, lo que además elimina en cascada su `profile`.
  Un superadmin no puede eliminar su propia cuenta.

## Límites conocidos

- El linter de seguridad de Supabase marca `is_staff()`/`is_superadmin()`/
  `is_active_user()` como invocables directamente vía RPC por usuarios
  autenticados. Es intencional: las políticas RLS necesitan que
  `authenticated` tenga permiso de ejecutarlas, y lo único que exponen es
  "¿el usuario actual es staff/superadmin/activo?" sobre sí mismo — no hay
  fuga de datos de terceros.
