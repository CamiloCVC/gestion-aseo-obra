import { colombiaDay } from "./format-date.js";
import { compressImage } from "./image-compression.js";

const BUCKET = "evidencias";

// Agrupa avances (cada uno con su propio created_at) en franjas diarias,
// concatenando las fotos de todos los avances de un mismo día. Más
// reciente primero.
export function groupAvancesByDay(avances) {
  const byDay = new Map();
  for (const avance of avances) {
    const day = colombiaDay(new Date(avance.created_at));
    const fotos = byDay.get(day) ?? [];
    byDay.set(day, [...fotos, ...(avance.fotos ?? [])]);
  }
  return [...byDay.entries()]
    .map(([day, fotos]) => ({ day, fotos }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

function avancePath(orderId, fileName) {
  return `ordenes/${orderId}/avances/${Date.now()}-${fileName}`;
}

// Comprime y sube cada foto, luego inserta un solo avance con todas las
// rutas. Si el insert falla, borra de storage lo ya subido.
export async function uploadAvance(supabase, orderId, files, { compress = compressImage } = {}) {
  const paths = [];
  try {
    for (const file of files) {
      const compressed = await compress(file);
      const path = avancePath(orderId, compressed.name);
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, { cacheControl: "31536000" });
      if (error) throw error;
      paths.push(path);
    }

    const { error } = await supabase.from("avances").insert({ orden_id: orderId, fotos: paths });
    if (error) throw error;
  } catch (err) {
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
    throw err;
  }
}

export async function fetchAvancePhotos(supabase, orderId) {
  const { data, error } = await supabase.from("avances").select("fotos").eq("orden_id", orderId);
  if (error) throw error;
  return (data ?? []).flatMap((row) => row.fotos ?? []);
}

// Borra las fotos de storage y las filas de avances de una orden. Se llama
// al completar la orden, cuando el historial de avances deja de ser
// relevante.
export async function cleanupAvancesFor(supabase, orderId) {
  const paths = await fetchAvancePhotos(supabase, orderId);
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }
  const { error } = await supabase.from("avances").delete().eq("orden_id", orderId);
  if (error) throw error;
  return paths;
}
