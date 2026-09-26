import { formatDateTime } from "./format-date.js";
import { supabase } from "./supabase-client.js";
import { requireActiveProfile, landingPageFor, isStaffRole } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { wireDropZone } from "./drop-zone.js";
import { compressImage } from "./image-compression.js";
import { renderCarousel } from "./carousel.js";
import { cleanupAvancesFor } from "./avances.js";
import { infoDialog } from "./info-dialog.js";

const summaryEl = document.getElementById("order-summary");
const form = document.getElementById("complete-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const existingDespuesGallery = document.getElementById("existing-despues-gallery");

const orderId = new URLSearchParams(window.location.search).get("id");
let despuesFiles = [];
let existingDespuesPaths = [];
let currentProfile = null;

const auth = await requireActiveProfile();
if (auth && orderId) {
  currentProfile = auth.profile;
  renderHeader(document.getElementById("app-header"), {
    title: "Gestión de Aseo de Obra",
    profile: auth.profile,
    activeHref: "",
  });
  await loadOrder(orderId);
} else if (auth) {
  summaryEl.innerHTML = `<p class="empty-state">Falta el id de la orden.</p>`;
  form.hidden = true;
}

async function loadOrder(id) {
  const { data: order, error } = await supabase.from("ordenes").select("*, obras(nombre)").eq("id", id).single();

  if (error || !order) {
    summaryEl.innerHTML = `<p class="empty-state">No se encontró la orden, o no tienes acceso a ella.</p>`;
    form.hidden = true;
    return;
  }

  summaryEl.innerHTML = `
    <p><strong>Obra:</strong> ${escapeHtml(order.obras?.nombre) || "-"}</p>
    <p><strong>Piso/Lugar:</strong> ${escapeHtml(order.piso)}</p>
    <p><strong>Contratista:</strong> ${escapeHtml(order.contratista)}</p>
    <p><strong>Fecha y hora:</strong> ${escapeHtml(formatDateTime(order.fecha_hora))}</p>
    <p><strong>Comentarios:</strong> ${escapeHtml(order.comentarios) || "-"}</p>
  `;

  const antesUrls = (order.fotos_antes ?? []).map(
    (path) => supabase.storage.from("evidencias").getPublicUrl(path).data.publicUrl
  );
  await renderCarousel(document.getElementById("carousel-antes"), antesUrls, "antes");

  const canComplete = order.creado_por_id === auth.session.user.id || isStaffRole(currentProfile?.role);
  const isPending = !order.completada;

  if (!canComplete || !isPending) {
    form.hidden = true;
    statusEl.textContent = !canComplete
      ? "Solo quien creó la orden, o un admin, puede completarla."
      : "Esta orden ya fue completada.";
    return;
  }

  // Orden reabierta: ya tenía fotos de después de un cierre anterior. Se
  // muestran como referencia; el empleado agrega más solo si quiere.
  existingDespuesPaths = order.fotos_despues ?? [];
  if (existingDespuesPaths.length > 0) {
    existingDespuesGallery.hidden = false;
    const existingUrls = existingDespuesPaths.map(
      (path) => supabase.storage.from("evidencias").getPublicUrl(path).data.publicUrl
    );
    await renderCarousel(document.getElementById("carousel-despues-existentes"), existingUrls, "despues");
  }

  wireDropZone(document.getElementById("dropzone-despues"), document.getElementById("fotos-despues"), (files) => {
    despuesFiles = [...despuesFiles, ...files.filter((file) => file.type.startsWith("image/"))];
    renderPreview();
  });

  form.addEventListener("submit", (event) => onSubmit(event, id));
}

function renderPreview() {
  const container = document.getElementById("preview-despues");
  container.innerHTML = "";
  despuesFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "thumb-item";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = `Vista previa ${index + 1}`;
    item.appendChild(img);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "thumb-remove";
    removeBtn.setAttribute("aria-label", "Quitar foto");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      despuesFiles = despuesFiles.filter((_, i) => i !== index);
      renderPreview();
    });
    item.appendChild(removeBtn);

    container.appendChild(item);
  });
}

async function onSubmit(event, id) {
  event.preventDefault();

  if (existingDespuesPaths.length === 0 && despuesFiles.length === 0) {
    statusEl.textContent = "Adjunta al menos una foto de después.";
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = "Comprimiendo y subiendo evidencia...";

  try {
    const newPaths = [];
    for (const file of despuesFiles) {
      const compressed = await compressImage(file);
      const path = `ordenes/${id}/despues/${Date.now()}-${compressed.name}`;
      const { error } = await supabase.storage.from("evidencias").upload(path, compressed, { cacheControl: "31536000" });
      if (error) throw error;
      newPaths.push(path);
    }

    const paths = [...existingDespuesPaths, ...newPaths];
    const { error } = await supabase.from("ordenes").update({ fotos_despues: paths, completada: true }).eq("id", id);
    if (error) throw error;

    try {
      await cleanupAvancesFor(supabase, id);
    } catch (cleanupErr) {
      // ponytail: la orden ya quedó completada; no revertimos por un fallo
      // de limpieza de avances. Best-effort, se puede reintentar a mano.
      console.error("No se pudo limpiar los avances de la orden", cleanupErr);
    }

    const backHref = landingPageFor(currentProfile?.role);
    const backLabel = backHref === "admin.html" ? "Ir a Órdenes" : "Ir a Mis órdenes";
    await infoDialog("Orden completada correctamente.", { okLabel: backLabel });
    window.location.href = backHref;
    return;
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
}
