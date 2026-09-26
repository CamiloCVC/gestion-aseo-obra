import { formatDateTime } from "./format-date.js";
import { supabase } from "./supabase-client.js";
import { requireRole } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { renderCarousel } from "./carousel.js";
import { loadObras } from "./obras.js";
import { showToast } from "./toast.js";
import { renderIcons } from "./icons.js";
import { downloadBlob } from "./download-file.js";
import { fetchOrdersPage, validateDateRange } from "./orders-query.js";
import { collectOrders, ORDER_COLUMNS } from "./orders-export.js";
import { toCsv, csvFilename } from "./csv.js";
import { pageInfo, formatCounter, renderPager } from "./pagination.js";
import { groupAvancesByDay, fetchAvancePhotos, uploadAvance } from "./avances.js";
import { confirmDialog } from "./confirm-dialog.js";
import "./tooltip.js";

const ORDERS_SELECT = "*, profiles(nombre, email), obras(nombre)";

const tableBody = document.getElementById("orders-body");
const modal = document.getElementById("detail-modal");
const modalBody = document.getElementById("modal-body");
const modalClose = document.getElementById("modal-close");
const avancesModal = document.getElementById("avances-modal");
const avancesBody = document.getElementById("avances-body");
const avancesModalClose = document.getElementById("avances-modal-close");
const avanceInput = document.getElementById("avance-input");
let avanceOrderId = null;
const counter = document.getElementById("orders-counter");
const pager = document.getElementById("pager");
const exportBtn = document.getElementById("export-btn");

const searchInput = document.getElementById("filter-search");
const empleadoSelect = document.getElementById("filter-empleado");
const obraSelect = document.getElementById("filter-obra");
const desdeInput = document.getElementById("filter-desde");
const hastaInput = document.getElementById("filter-hasta");

let currentPage = 1;
let totalOrders = 0;
let requestSeq = 0;
let appliedFilters = {};

const auth = await requireRole(["admin", "superadmin"]);
if (auth) {
  renderHeader(document.getElementById("app-header"), {
    title: "Gestión de Aseo de Obra",
    profile: auth.profile,
    activeHref: "admin.html",
  });
  await loadFilterOptions();
  appliedFilters = readFilters();
  await loadOrders(1);
}

document.getElementById("refresh-btn")?.addEventListener("click", async () => {
  await loadFilterOptions();
  await loadOrders(currentPage);
});

// Los filtros solo se aplican al pulsar «Buscar» (o Enter); tabla, paginador y export usan appliedFilters.
document.getElementById("filters-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const filters = readFilters();
  const rangeError = validateDateRange(filters);
  if (rangeError) {
    showToast(rangeError, "error");
    return;
  }
  appliedFilters = filters;
  loadOrders(1);
});
document.getElementById("filter-clear").addEventListener("click", () => {
  searchInput.value = "";
  empleadoSelect.value = "";
  obraSelect.value = "";
  desdeInput.value = "";
  hastaInput.value = "";
  appliedFilters = readFilters();
  loadOrders(1);
});
exportBtn.addEventListener("click", exportOrders);

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
  return {
    search: searchInput.value,
    empleadoId: empleadoSelect.value,
    obraId: obraSelect.value,
    desde: desdeInput.value,
    hasta: hastaInput.value,
  };
}

async function loadFilterOptions() {
  const [{ data: perfiles }, obras] = await Promise.all([
    supabase.from("profiles").select("id, nombre").order("nombre", { ascending: true }),
    loadObras(),
  ]);

  fillSelect(empleadoSelect, "Todos", (perfiles ?? []).map((p) => ({ value: p.id, label: p.nombre })));
  fillSelect(obraSelect, "Todas", obras.map((o) => ({ value: o.id, label: o.nombre })));
}

function fillSelect(select, allLabel, options) {
  const previous = select.value;
  select.innerHTML =
    `<option value="">${allLabel}</option>` +
    options.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
  select.value = previous;
}

async function loadOrders(page = currentPage) {
  const seq = ++requestSeq;
  const result = await fetchOrdersPage(supabase, {
    select: ORDERS_SELECT,
    filters: appliedFilters,
    page: pageInfo(page, totalOrders).page,
  });
  if (seq !== requestSeq) return; // llegó una respuesta más nueva

  if (result.error) {
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Error cargando órdenes: ${escapeHtml(result.error.message)}</td></tr>`;
    return;
  }

  totalOrders = result.count ?? 0;
  const info = pageInfo(result.page, totalOrders);
  currentPage = info.page;
  counter.textContent = formatCounter(info, totalOrders);
  renderPager(pager, info, (target) => loadOrders(target));
  renderOrders(result.data);
}

function renderOrders(data) {
  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay órdenes que coincidan.</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";
  for (const order of data) {
    const isPending = (order.fotos_despues ?? []).length === 0;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(formatDateTime(order.fecha_hora))}</td>
      <td>${escapeHtml(order.obras?.nombre) || "-"}</td>
      <td>${escapeHtml(order.piso)}</td>
      <td>${escapeHtml(order.contratista)}</td>
      <td>${escapeHtml(order.profiles?.nombre)}</td>
      <td>${(order.fotos_antes ?? []).length} / ${(order.fotos_despues ?? []).length}</td>
      <td><span class="badge ${isPending ? "badge-pendiente" : "badge-completa"}">${isPending ? "Pendiente" : "Completa"}</span></td>
      <td><div class="icon-actions">
        <button class="icon-btn ver-btn" data-tooltip="Ver detalle" aria-label="Ver detalle"><i data-lucide="eye"></i></button>
        ${isPending ? `<button class="icon-btn avances-btn" data-tooltip="Ver avances" aria-label="Ver avances"><i data-lucide="history"></i></button>` : ""}
        ${isPending ? `<button class="icon-btn avance-btn" data-tooltip="Agregar avance" aria-label="Agregar avance"><i data-lucide="camera"></i></button>` : ""}
        ${isPending ? `<a class="icon-btn icon-btn-accent" href="completar-orden.html?id=${escapeHtml(order.id)}" data-tooltip="Completar orden" aria-label="Completar orden"><i data-lucide="check-circle-2"></i></a>` : ""}
        <button class="icon-btn icon-btn-danger delete-btn" data-tooltip="Eliminar orden" aria-label="Eliminar orden"><i data-lucide="trash-2"></i></button>
      </div></td>
    `;
    row.querySelector(".ver-btn").addEventListener("click", () => openDetail(order));
    row.querySelector(".avances-btn")?.addEventListener("click", () => openAvances(order));
    row.querySelector(".avance-btn")?.addEventListener("click", () => {
      avanceOrderId = order.id;
      avanceInput.click();
    });
    row.querySelector(".delete-btn").addEventListener("click", () => deleteOrder(order));
    tableBody.appendChild(row);
  }
  renderIcons();
}

async function exportOrders() {
  exportBtn.disabled = true;
  exportBtn.textContent = "Exportando…";
  try {
    const { rows, total } = await collectOrders(supabase, appliedFilters);
    if (rows.length === 0) {
      showToast("No hay órdenes para exportar.", "info");
      return;
    }
    if (rows.length !== total) {
      showToast("El número de órdenes descargadas no coincide con el total (los datos cambiaron durante la exportación). Vuelve a exportar.", "error");
      return;
    }

    const blob = new Blob([toCsv(ORDER_COLUMNS, rows)], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, csvFilename(appliedFilters));
    showToast(`${rows.length} órdenes exportadas.`, "success");
  } catch (err) {
    showToast(`Error al exportar: ${err.message}`, "error");
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = "Exportar CSV";
  }
}

async function deleteOrder(order) {
  const ok = await confirmDialog(
    `¿Eliminar la orden de "${order.piso}" (${formatDateTime(order.fecha_hora)})? Esta acción no se puede deshacer.`
  );
  if (!ok) return;

  let avancePaths = [];
  try {
    avancePaths = await fetchAvancePhotos(supabase, order.id);
  } catch (err) {
    showToast(`Error al eliminar: ${err.message}`, "error");
    return;
  }
  const paths = [...(order.fotos_antes ?? []), ...(order.fotos_despues ?? []), ...avancePaths];
  if (paths.length > 0) {
    await supabase.storage.from("evidencias").remove(paths);
  }

  const { error } = await supabase.from("ordenes").delete().eq("id", order.id);
  if (error) {
    showToast(`Error al eliminar: ${error.message}`, "error");
    return;
  }

  showToast("Orden eliminada.", "success");
  totalOrders = Math.max(0, totalOrders - 1);
  await loadOrders(currentPage);
}

async function signedUrls(paths) {
  if (!paths || paths.length === 0) return [];
  const { data, error } = await supabase.storage
    .from("evidencias")
    .createSignedUrls(paths, 60 * 10);
  if (error) return [];
  return data.map((entry) => entry.signedUrl).filter(Boolean);
}

async function openDetail(order) {
  modalBody.innerHTML = "<p>Cargando fotos...</p>";
  modal.showModal();

  const [antesUrls, despuesUrls] = await Promise.all([
    signedUrls(order.fotos_antes),
    signedUrls(order.fotos_despues),
  ]);

  modalBody.innerHTML = `
    <h3>Orden ${escapeHtml(order.id)}</h3>
    <p><strong>Obra:</strong> ${escapeHtml(order.obras?.nombre) || "-"}</p>
    <p><strong>Piso/Lugar:</strong> ${escapeHtml(order.piso)}</p>
    <p><strong>Contratista:</strong> ${escapeHtml(order.contratista)}</p>
    <p><strong>Fecha y hora:</strong> ${escapeHtml(formatDateTime(order.fecha_hora))}</p>
    <p><strong>Creado por:</strong> ${escapeHtml(order.profiles?.nombre)} (${escapeHtml(order.profiles?.email)})</p>
    <p><strong>Comentarios:</strong> ${escapeHtml(order.comentarios) || "-"}</p>
    <div class="gallery"><h4>Antes</h4><div id="carousel-antes"></div></div>
    <div class="gallery"><h4>Después</h4><div id="carousel-despues"></div></div>
  `;

  await Promise.all([
    renderCarousel(document.getElementById("carousel-antes"), antesUrls, "antes"),
    renderCarousel(document.getElementById("carousel-despues"), despuesUrls, "despues"),
  ]);
}

modalClose.addEventListener("click", () => modal.close());

function formatDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  const formatted = new Date(year, month - 1, date).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Intl devuelve todo en minúscula ("viernes, 25 de septiembre..."); solo
  // la primera letra debe ir en mayúscula, no cada palabra.
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

async function openAvances(order) {
  avancesBody.innerHTML = "<p>Cargando avances...</p>";
  avancesModal.showModal();

  const { data, error } = await supabase
    .from("avances")
    .select("fotos, created_at")
    .eq("orden_id", order.id)
    .order("created_at", { ascending: true });

  if (error) {
    avancesBody.innerHTML = `<p class="empty-state">Error cargando avances: ${escapeHtml(error.message)}</p>`;
    return;
  }

  const groups = groupAvancesByDay(data ?? []);
  if (groups.length === 0) {
    avancesBody.innerHTML = `<p class="empty-state">Sin avances registrados.</p>`;
    return;
  }

  avancesBody.innerHTML = groups
    .map(
      (group, index) => `
        <details class="avance-card" ${index === 0 ? "open" : ""}>
          <summary>
            <i data-lucide="chevron-right" class="avance-chevron"></i>
            <span class="avance-day">${escapeHtml(formatDay(group.day))}</span>
            <span class="avance-count">${group.fotos.length} foto${group.fotos.length === 1 ? "" : "s"}</span>
          </summary>
          <div class="gallery" id="avance-carousel-${index}"></div>
        </details>
      `
    )
    .join("");
  renderIcons();

  await Promise.all(
    groups.map(async (group, index) => {
      const urls = await signedUrls(group.fotos);
      await renderCarousel(document.getElementById(`avance-carousel-${index}`), urls, "avance");
    })
  );
}

avancesModalClose.addEventListener("click", () => avancesModal.close());
