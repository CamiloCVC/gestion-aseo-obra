import { supabase } from "./supabase-client.js";
import { requireActiveProfile } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { renderIcons } from "./icons.js";
import { showToast } from "./toast.js";
import { fetchOrdersPage, validateDateRange } from "./orders-query.js";
import { pageInfo, formatCounter, renderPager } from "./pagination.js";
import "./tooltip.js";

const tableBody = document.getElementById("orders-body");
const counter = document.getElementById("orders-counter");
const pager = document.getElementById("pager");
const desdeInput = document.getElementById("filter-desde");
const hastaInput = document.getElementById("filter-hasta");

let currentPage = 1;
let totalOrders = 0;
let requestSeq = 0;

const auth = await requireActiveProfile();
if (auth) {
  renderHeader(document.getElementById("app-header"), {
    title: "Gestión de Aseo de Obra",
    profile: auth.profile,
    activeHref: "mis-ordenes.html",
  });
  await loadMyOrders(1);
}

[desdeInput, hastaInput].forEach((el) => el.addEventListener("change", () => loadMyOrders(1)));
document.getElementById("filter-clear").addEventListener("click", () => {
  desdeInput.value = "";
  hastaInput.value = "";
  loadMyOrders(1);
});

async function loadMyOrders(page = currentPage) {
  const filters = {
    empleadoId: auth.session.user.id,
    desde: desdeInput.value,
    hasta: hastaInput.value,
  };
  const seq = ++requestSeq; // invalida respuestas en vuelo aunque el rango sea inválido
  const rangeError = validateDateRange(filters);
  if (rangeError) {
    showToast(rangeError, "error");
    return;
  }

  const result = await fetchOrdersPage(supabase, {
    select: "*, obras(nombre)",
    filters,
    page: pageInfo(page, totalOrders).page,
  });
  if (seq !== requestSeq) return;

  if (result.error) {
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Error cargando órdenes: ${escapeHtml(result.error.message)}</td></tr>`;
    return;
  }

  totalOrders = result.count ?? 0;
  const info = pageInfo(result.page, totalOrders);
  currentPage = info.page;
  counter.textContent = formatCounter(info, totalOrders);
  renderPager(pager, info, (target) => loadMyOrders(target));

  if (result.data.length === 0) {
    const filtered = desdeInput.value || hastaInput.value;
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">${filtered ? "No hay órdenes en ese período." : "Aún no has registrado ninguna orden."}</td></tr>`;
    return;
  }

  tableBody.innerHTML = result.data
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
