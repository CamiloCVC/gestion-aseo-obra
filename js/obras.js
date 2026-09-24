import { supabase } from "./supabase-client.js";

export async function loadObras({ soloActivas = false } = {}) {
  let query = supabase.from("obras").select("id, nombre, activa").order("nombre", { ascending: true });
  if (soloActivas) query = query.eq("activa", true);
  const { data, error } = await query;
  if (error) return [];
  return data;
}
