import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ROLES = ["empleado", "admin", "superadmin"];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) {
    return jsonResponse({ error: "No autenticado" }, 401);
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY);
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser(jwt);

  if (callerError || !caller) {
    return jsonResponse({ error: "No autenticado" }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role, activo")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || callerProfile.role !== "superadmin" || !callerProfile.activo) {
    return jsonResponse({ error: "No autorizado" }, 403);
  }

  let body: { email?: string; password?: string; nombre?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body inválido" }, 400);
  }

  const { email, password, nombre, role } = body;
  if (!email || !password || !nombre || !role || !ALLOWED_ROLES.includes(role)) {
    return jsonResponse({ error: "Datos incompletos o rol inválido" }, 400);
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (createError || !created.user) {
    return jsonResponse({ error: createError?.message ?? "No se pudo crear el usuario" }, 400);
  }

  if (role !== "empleado") {
    await adminClient.from("profiles").update({ role }).eq("id", created.user.id);
  }

  return jsonResponse({ id: created.user.id, email: created.user.email }, 200);
});
