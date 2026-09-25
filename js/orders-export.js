import { applyOrderFilters } from "./orders-query.js";

const BATCH_SIZE = 1000; // max_rows por defecto de Supabase

const pad = (n) => String(n).padStart(2, "0");

function formatLocal(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const isPending = (order) => (order.fotos_despues ?? []).length === 0;

export const ORDER_COLUMNS = [
  { header: "Fecha/hora", value: (order) => formatLocal(order.fecha_hora) },
  { header: "Obra", value: (order) => order.obras?.nombre ?? "" },
  { header: "Piso/Lugar", value: (order) => order.piso },
  { header: "Contratista", value: (order) => order.contratista },
  { header: "Creado por", value: (order) => order.profiles?.nombre ?? "" },
  { header: "Email", value: (order) => order.profiles?.email ?? "" },
  { header: "Fotos antes", value: (order) => (order.fotos_antes ?? []).length },
  { header: "Fotos después", value: (order) => (order.fotos_despues ?? []).length },
  { header: "Estado", value: (order) => (isPending(order) ? "Pendiente" : "Completa") },
  { header: "Comentarios", value: (order) => order.comentarios ?? "" },
  { header: "ID", value: (order) => order.id },
];

export async function fetchAllOrders(fetchBatch, batchSize = BATCH_SIZE) {
  const byId = new Map();
  for (let from = 0; ; from += batchSize) {
    const rows = await fetchBatch(from, from + batchSize - 1);
    rows.forEach((row) => byId.set(row.id, row));
    if (rows.length < batchSize) break;
  }
  return [...byId.values()];
}

// Trae TODAS las órdenes del filtro. El corte fijo usa el `created_at` más nuevo según el
// servidor (no el reloj del navegador), así órdenes nuevas no desplazan los lotes;
// `total` permite detectar borrados durante la descarga.
export async function collectOrders(client, filters) {
  const base = (columns, options) =>
    applyOrderFilters(client.from("ordenes").select(columns, options), filters);

  const newest = await base("created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(1);
  if (newest.error) throw new Error(newest.error.message);
  if (!newest.count) return { rows: [], total: 0 };

  const cutoff = newest.data[0].created_at;
  const rows = await fetchAllOrders(async (from, to) => {
    const { data, error } = await base("*, profiles(nombre, email), obras(nombre)")
      .lte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return data;
  });

  return { rows, total: newest.count };
}
