import { PAGE_SIZE, pageInfo } from "./pagination.js";

const PAGE_OUT_OF_RANGE = "PGRST103";

function parseDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month: month - 1, date };
}

export function localDayStartIso(day) {
  const { year, month, date } = parseDay(day);
  return new Date(year, month, date).toISOString();
}

export function nextDayStartIso(day) {
  const { year, month, date } = parseDay(day);
  return new Date(year, month, date + 1).toISOString();
}

// Escapa comodines de LIKE y luego los caracteres del valor entrecomillado de PostgREST.
function quoteIlike(text) {
  const like = text.replace(/[\\%_]/g, "\\$&");
  const quoted = like.replace(/[\\"]/g, "\\$&");
  return `"%${quoted}%"`;
}

export function searchClause(text) {
  const pattern = quoteIlike(text);
  return ["piso", "contratista", "comentarios"].map((column) => `${column}.ilike.${pattern}`).join(",");
}

export function validateDateRange({ desde, hasta }) {
  if (desde && hasta && desde > hasta) return "La fecha «Desde» no puede ser posterior a «Hasta».";
  return null;
}

// Única fuente de filtros: la usan la tabla, el conteo y la exportación.
export function applyOrderFilters(query, { search, empleadoId, obraId, desde, hasta }) {
  let q = query;
  if (empleadoId) q = q.eq("creado_por_id", empleadoId);
  if (obraId) q = q.eq("obra_id", obraId);
  if (desde) q = q.gte("fecha_hora", localDayStartIso(desde));
  if (hasta) q = q.lt("fecha_hora", nextDayStartIso(hasta));
  const term = search?.trim();
  if (term) q = q.or(searchClause(term));
  return q;
}

export async function fetchOrdersPage(client, { select, filters, page }) {
  const filtered = (columns, options) =>
    applyOrderFilters(client.from("ordenes").select(columns, options), filters);

  const run = (target) => {
    const offset = (target - 1) * PAGE_SIZE;
    return filtered(select, { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
  };

  let current = page;
  let result = await run(current);

  // La página pedida ya no existe (p. ej. otro usuario borró órdenes): ir a la última.
  if (result.error?.code === PAGE_OUT_OF_RANGE) {
    const head = await filtered("id", { count: "exact", head: true });
    if (head.error) return { ...head, page: current };
    current = pageInfo(current, head.count).page;
    result = await run(current);
  }

  return { ...result, page: current };
}
