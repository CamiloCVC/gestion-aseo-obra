import { supabase } from "./supabase-client.js";
import { requireActiveProfile } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { renderIcons } from "./icons.js";
import "./tooltip.js";

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
    .select("*, obras(nombre)")
    .eq("creado_por_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Error cargando órdenes: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Aún no has registrado ninguna orden.</td></tr>`;
    return;
  }

  tableBody.innerHTML = data
    .map((order) => {
      const isPending = (order.fotos_despues ?? []).length === 0;
      return `
        <tr>
          <td>${escapeHtml(order.fecha_hora)}</td>
          <td>${escapeHtml(order.obras?.nombre) || "-"}</td>
          <td>${escapeHtml(order.piso)}</td>
          <td>${escapeHtml(order.contratista)}</td>
          <td>${(order.fotos_antes ?? []).length} / ${(order.fotos_despues ?? []).length}</td>
          <td><span class="badge ${isPending ? "badge-pendiente" : "badge-completa"}">${isPending ? "Pendiente" : "Completa"}</span></td>
          <td><div class="icon-actions">${isPending ? `<a class="icon-btn icon-btn-accent" href="completar-orden.html?id=${escapeHtml(order.id)}" data-tooltip="Completar orden" aria-label="Completar orden"><i data-lucide="check-circle-2"></i></a>` : ""}</div></td>
        </tr>
      `;
    })
    .join("");
  renderIcons();
}
