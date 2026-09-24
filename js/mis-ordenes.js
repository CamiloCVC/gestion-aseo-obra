import { supabase } from "./supabase-client.js";
import { requireActiveProfile } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";

const tableBody = document.getElementById("orders-body");

const auth = await requireActiveProfile();
if (auth) {
  renderHeader(document.getElementById("app-header"), {
    title: "Gestión de Aseo de Obra",
    profile: auth.profile,
    activeHref: "mis-ordenes.html",
  });
  await loadMyOrders(auth.session.user.id);
}

async function loadMyOrders(userId) {
  const { data, error } = await supabase
    .from("ordenes")
    .select("*")
    .eq("creado_por_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Error cargando órdenes: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Aún no has registrado ninguna orden.</td></tr>`;
    return;
  }

  tableBody.innerHTML = data
    .map(
      (order) => `
        <tr>
          <td>${escapeHtml(order.fecha_hora)}</td>
          <td>${escapeHtml(order.piso)}</td>
          <td>${escapeHtml(order.contratista)}</td>
          <td>${(order.fotos_antes ?? []).length} / ${(order.fotos_despues ?? []).length}</td>
        </tr>
      `
    )
    .join("");
}
