import { formatDateTime } from "./format-date.js";
import { supabase } from "./supabase-client.js";
import { requireActiveProfile } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { renderIcons } from "./icons.js";
import { showToast } from "./toast.js";
import { fetchOrdersPage, validateDateRange } from "./orders-query.js";
import { pageInfo, formatCounter, renderPager } from "./pagination.js";
import { uploadAvance } from "./avances.js";
import "./tooltip.js";

const tableBody = document.getElementById("orders-body");
const counter = document.getElementById("orders-counter");
const pager = document.getElementById("pager");
const desdeInput = document.getElementById("filter-desde");
const hastaInput = document.getElementById("filter-hasta");
const avanceInput = document.getElementById("avance-input");
let avanceOrderId = null;

let currentPage = 1;
let totalOrders = 0;
let requestSeq = 0;
let appliedFilters = {};

const auth = await requireActiveProfile();
if (auth) {
  renderHeader(document.getElementById("app-header"), {
    title: "Gestión de Aseo de Obra",
    profile: auth.profile,
    activeHref: "mis-ordenes.html",
  });
  appliedFilters = readFilters();
  await loadMyOrders(1);
}

// Los filtros solo se aplican al pulsar «Buscar»; tabla y paginador usan appliedFilters.
document.getElementById("filters-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const filters = readFilters();
  const rangeError = validateDateRange(filters);
  if (rangeError) {
    showToast(rangeError, "error");
    return;
  }
  appliedFilters = filters;
  loadMyOrders(1);
});
document.getElementById("filter-clear").addEventListener("click", () => {
  desdeInput.value = "";
  hastaInput.value = "";
  appliedFilters = readFilters();
  loadMyOrders(1);
});

avanceInput.addEventListener("change", async () => {
  const files = Array.from(avanceInput.files).filter((file) => file.type.startsWith("image/"));
  const orderId = avanceOrderId;
  avanceInput.value = "";
  if (!orderId || files.length === 0) return;

  showToast("Subiendo avance...", "info");
  try {
    await uploadAvance(supabase, orderId, files);
    showToast("Avance registrado.", "success");
  } catch (err) {
    showToast(`Error al subir el avance: ${err.message}`, "error");
  }
});

function readFilters() {
  return { empleadoId: auth.session.user.id, desde: desdeInput.value, hasta: hastaInput.value };
}

async function loadMyOrders(page = currentPage) {
  const seq = ++requestSeq;
  const result = await fetchOrdersPage(supabase, {
    select: "*, obras(nombre)",
    filters: appliedFilters,
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
    const filtered = appliedFilters.desde || appliedFilters.hasta;
    tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">${filtered ? "No hay órdenes en ese período." : "Aún no has registrado ninguna orden."}</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";
  for (const order of result.data) {
    const isPending = (order.fotos_despues ?? []).length === 0;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(formatDateTime(order.fecha_hora))}</td>
      <td>${escapeHtml(order.obras?.nombre) || "-"}</td>
      <td>${escapeHtml(order.piso)}</td>
      <td>${escapeHtml(order.contratista)}</td>
      <td>${(order.fotos_antes ?? []).length} / ${(order.fotos_despues ?? []).length}</td>
      <td><span class="badge ${isPending ? "badge-pendiente" : "badge-completa"}">${isPending ? "Pendiente" : "Completa"}</span></td>
      <td><div class="icon-actions">
        ${isPending ? `<button type="button" class="icon-btn avance-btn" data-tooltip="Agregar avance" aria-label="Agregar avance"><i data-lucide="camera"></i></button>` : ""}
        ${isPending ? `<a class="icon-btn icon-btn-accent" href="completar-orden.html?id=${escapeHtml(order.id)}" data-tooltip="Completar orden" aria-label="Completar orden"><i data-lucide="check-circle-2"></i></a>` : ""}
      </div></td>
    `;
    row.querySelector(".avance-btn")?.addEventListener("click", () => {
      avanceOrderId = order.id;
      avanceInput.click();
    });
    tableBody.appendChild(row);
  }
  renderIcons();
}
