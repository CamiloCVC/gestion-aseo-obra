import { supabase } from "./supabase-client.js";

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("nombre, role, activo")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

const STAFF_ROLES = ["admin", "superadmin"];

function landingPageFor(role) {
  return STAFF_ROLES.includes(role) ? "admin.html" : "mis-ordenes.html";
}

export async function requireActiveProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  const profile = await getProfile(session.user.id);
  if (!profile || !profile.activo) {
    await supabase.auth.signOut();
    window.location.href = "index.html";
    return null;
  }

  return { session, profile };
}

export async function requireRole(allowedRoles) {
  const result = await requireActiveProfile();
  if (!result) return null;

  if (!allowedRoles.includes(result.profile.role)) {
    window.location.href = landingPageFor(result.profile.role);
    return null;
  }

  return result;
}

export { landingPageFor };
