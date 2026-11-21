// Borra las fotos de evidencias/ordenes/ subidas el mes anterior (hora Colombia).
// Solo archivos: las filas de ordenes/avances se conservan (quedan con fotos rotas).
// La invoca pg_cron el día 15 de cada mes (ver migración 20261120_cleanup_evidencias_cron.sql).
import { createClient } from "npm:@supabase/supabase-js@2";
import { previousMonthRange } from "./range.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "evidencias";
const BATCH = 100;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // El secreto vive solo en Vault (cron_secret); pg_cron lo manda en el header.
  const { data: authorized, error: authError } = await admin.rpc("cron_secret_matches", {
    p_secret: req.headers.get("x-cron-secret") ?? "",
  });
  if (authError) {
    console.error("validar secreto falló", authError);
    return json({ error: "Error interno" }, 500);
  }
  if (!authorized) return json({ error: "No autorizado" }, 401);

  const { from, to } = previousMonthRange(new Date());

  let deleted = 0;
  // PostgREST limita cada respuesta (~1000 filas): se repite hasta vaciar el rango.
  while (true) {
    const { data: paths, error } = await admin
      .rpc("evidencias_paths_between", { p_from: from.toISOString(), p_to: to.toISOString() })
      .limit(BATCH);
    if (error) {
      console.error("listar falló", { deleted, error });
      return json({ error: error.message, deleted }, 500);
    }
    if (paths.length === 0) break;

    const { data, error: rmError } = await admin.storage.from(BUCKET).remove(paths);
    if (rmError) {
      console.error("borrar falló", { deleted, rmError });
      return json({ error: rmError.message, deleted }, 500);
    }
    // Sin progreso = algo impide borrar; cortar para no quedar en bucle.
    if (data.length === 0) return json({ error: "Storage no borró ningún archivo", deleted }, 500);
    deleted += data.length;
  }

  const result = { from: from.toISOString(), to: to.toISOString(), deleted };
  console.log("cleanup-evidencias", result);
  return json(result, 200);
});
