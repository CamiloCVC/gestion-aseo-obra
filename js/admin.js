import { supabase } from "./supabase-client.js";
import { requireRole } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { renderCarousel } from "./carousel.js";
import { loadObras } from "./obras.js";
import { showToast } from "./toast.js";
import { renderIcons } from "./icons.js";
import "./tooltip.js";

const tableBody = document.getElementById("orders-body");
const modal = document.getElementById("detail-modal");
const modalBody = document.getElementById("modal-body");
const modalClose = document.getElementById("modal-close");

const searchInput = document.getElementById("filter-search");
const empleadoSelect = document.getElementById("filter-empleado");
const obraSelect = document.getElementById("filter-obra");
const fechaInput = document.getElementById("filter-fecha");

let allOrders = [];

const auth = await requireRole(["admin", "superadmin"]);
if (auth) {
  renderHeader(document.getElementById("app-header"), {
    title: "Gestión de Aseo de Obra",
    profile: auth.profile,
    activeHref: "admin.html",
  });
  await loadOrders();
}

document.getElementById("refresh-btn")?.addEventListener("click", loadOrders);
[searchInput, empleadoSelect, obraSelect, fechaInput].forEach((el) =>
  el.addEventListener("input", renderFilteredOrders)
);
document.getElementById("filter-clear").addEventListener("click", () => {
  searchInput.value = "";
  empleadoSelect.value = "";
  obraSelect.value = "";
  fechaInput.value = "";
  renderFilteredOrders();
});

async function loadOrders() {
  const [{ data, error }, obras] = await Promise.all([
    supabase
      .from("ordenes")
      .select("*, profiles(nombre, email), obras(nombre)")
      .order("created_at", { ascending: false }),
    loadObras(),
  ]);

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Error cargando órdenes: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  allOrders = data;
  populateFilterOptions(data, obras);
  renderFilteredOrders();
}

function populateFilterOptions(orders, obras) {
  const empleados = new Map();
  orders.forEach((order) => {
    if (order.profiles) empleados.set(order.creado_por_id, order.profiles.nombre);
  });

  empleadoSelect.innerHTML =
    `<option value="">Todos</option>` +
    [...empleados.entries()]
      .map(([id, nombre]) => `<option value="${escapeHtml(id)}">${escapeHtml(nombre)}</option>`)
      .join("");

  obraSelect.innerHTML =
    `<option value="">Todas</option>` +
    obras.map((obra) => `<option value="${escapeHtml(obra.id)}">${escapeHtml(obra.nombre)}</option>`).join("");
}

function renderFilteredOrders() {
  const search = searchInput.value.trim().toLowerCase();
  const empleadoId = empleadoSelect.value;
  const obraId = obraSelect.value;
  const fecha = fechaInput.value;

  const filtered = allOrders.filter((order) => {
    if (empleadoId && order.creado_por_id !== empleadoId) return false;
    if (obraId && order.obra_id !== obraId) return false;
    if (fecha && !order.fecha_hora.startsWith(fecha)) return false;
    if (search) {
      const haystack = `${order.piso} ${order.contratista} ${order.comentarios ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  renderOrders(filtered);
}

function renderOrders(data) {
  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay órdenes que coincidan.</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";
  for (const order of data) {
    const isPending = (order.fotos_despues ?? []).length === 0;
    const isOwn = order.creado_por_id === auth.session.user.id;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(order.fecha_hora)}</td>
      <td>${escapeHtml(order.obras?.nombre) || "-"}</td>
      <td>${escapeHtml(order.piso)}</td>
      <td>${escapeHtml(order.contratista)}</td>
      <td>${escapeHtml(order.profiles?.nombre)}</td>
      <td>${(order.fotos_antes ?? []).length} / ${(order.fotos_despues ?? []).length}</td>
      <td><span class="badge ${isPending ? "badge-pendiente" : "badge-completa"}">${isPending ? "Pendiente" : "Completa"}</span></td>
      <td><div class="icon-actions">
        <button class="icon-btn ver-btn" data-tooltip="Ver detalle" aria-label="Ver detalle"><i data-lucide="eye"></i></button>
        ${isPending && isOwn ? `<a class="icon-btn icon-btn-accent" href="completar-orden.html?id=${escapeHtml(order.id)}" data-tooltip="Completar orden" aria-label="Completar orden"><i data-lucide="check-circle-2"></i></a>` : ""}
        <button class="icon-btn icon-btn-danger delete-btn" data-tooltip="Eliminar orden" aria-label="Eliminar orden"><i data-lucide="trash-2"></i></button>
      </div></td>
    `;
    row.querySelector(".ver-btn").addEventListener("click", () => openDetail(order));
    row.querySelector(".delete-btn").addEventListener("click", () => deleteOrder(order));
    tableBody.appendChild(row);
  }
  renderIcons();
}

async function deleteOrder(order) {
  if (!confirm(`¿Eliminar la orden de "${order.piso}" (${order.fecha_hora})? Esta acción no se puede deshacer.`)) {
    return;
  }

  const paths = [...(order.fotos_antes ?? []), ...(order.fotos_despues ?? [])];
  if (paths.length > 0) {
    await supabase.storage.from("evidencias").remove(paths);
  }

  const { error } = await supabase.from("ordenes").delete().eq("id", order.id);
  if (error) {
    showToast(`Error al eliminar: ${error.message}`, "error");
    return;
  }

  showToast("Orden eliminada.", "success");
  await loadOrders();
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
    <p><strong>Fecha y hora:</strong> ${escapeHtml(order.fecha_hora)}</p>
    <p><strong>Creado por:</strong> ${escapeHtml(order.profiles?.nombre)} (${escapeHtml(order.profiles?.email)})</p>
    <p><strong>Comentarios:</strong> ${escapeHtml(order.comentarios) || "-"}</p>
    <div class="gallery"><h4>Antes</h4><div id="carousel-antes"></div></div>
    <div class="gallery"><h4>Después</h4><div id="carousel-despues"></div></div>
  `;

  renderCarousel(document.getElementById("carousel-antes"), antesUrls, "antes");
  renderCarousel(document.getElementById("carousel-despues"), despuesUrls, "despues");
}

modalClose.addEventListener("click", () => modal.close());
