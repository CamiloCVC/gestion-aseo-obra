import { supabase } from "./supabase-client.js";
import { requireRole } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";

const tableBody = document.getElementById("orders-body");
const modal = document.getElementById("detail-modal");
const modalBody = document.getElementById("modal-body");
const modalClose = document.getElementById("modal-close");

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

async function loadOrders() {
  const { data, error } = await supabase
    .from("ordenes")
    .select("*, profiles(nombre, email)")
    .order("created_at", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Error cargando órdenes: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Aún no hay órdenes registradas.</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";
  for (const order of data) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(order.fecha_hora)}</td>
      <td>${escapeHtml(order.piso)}</td>
      <td>${escapeHtml(order.contratista)}</td>
      <td>${escapeHtml(order.profiles?.nombre)}</td>
      <td>${(order.fotos_antes ?? []).length} / ${(order.fotos_despues ?? []).length}</td>
      <td><button class="secondary ver-btn">Ver</button></td>
    `;
    row.querySelector(".ver-btn").addEventListener("click", () => openDetail(order));
    tableBody.appendChild(row);
  }
}

async function signedUrls(paths) {
  if (!paths || paths.length === 0) return [];
  const { data, error } = await supabase.storage
    .from("evidencias")
    .createSignedUrls(paths, 60 * 10);
  if (error) return [];
  return data.map((entry) => entry.signedUrl).filter(Boolean);
}

function renderThumbs(urls) {
  if (!urls || urls.length === 0) return "Sin fotos";
  return urls.map((url) => `<img src="${escapeHtml(url)}" alt="Evidencia">`).join("");
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
    <p><strong>Piso/Lugar:</strong> ${escapeHtml(order.piso)}</p>
    <p><strong>Contratista:</strong> ${escapeHtml(order.contratista)}</p>
    <p><strong>Fecha y hora:</strong> ${escapeHtml(order.fecha_hora)}</p>
    <p><strong>Creado por:</strong> ${escapeHtml(order.profiles?.nombre)} (${escapeHtml(order.profiles?.email)})</p>
    <p><strong>Comentarios:</strong> ${escapeHtml(order.comentarios) || "-"}</p>
    <div class="gallery"><h4>Antes</h4><div class="thumbs">${renderThumbs(antesUrls)}</div></div>
    <div class="gallery"><h4>Después</h4><div class="thumbs">${renderThumbs(despuesUrls)}</div></div>
  `;
}

modalClose.addEventListener("click", () => modal.close());
