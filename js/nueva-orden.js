import { colombiaNowInputValue, toColombiaIso } from "./format-date.js";
import { supabase } from "./supabase-client.js";
import { requireActiveProfile, landingPageFor } from "./auth.js";
import { renderHeader } from "./layout.js";
import { wireDropZone } from "./drop-zone.js";
import { compressImage } from "./image-compression.js";
import { loadObras } from "./obras.js";
import { escapeHtml } from "./escape-html.js";
import { nuevaOrdenSchema, firstErrorMessage } from "./validation.js";
import { infoDialog } from "./info-dialog.js";

const form = document.getElementById("order-form");
const obraSelect = document.getElementById("obra");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const fechaHoraInput = document.getElementById("fecha-hora");

const state = { antes: [], despues: [] };
let currentProfile = null;

const auth = await requireActiveProfile();
if (auth) {
  currentProfile = auth.profile;
  renderHeader(document.getElementById("app-header"), {
    title: "Gestión de Aseo de Obra",
    profile: auth.profile,
    activeHref: "nueva-orden.html",
  });
  setDefaultFechaHora();
  setupStage("antes");
  setupStage("despues");
  await loadObraOptions();
}

async function loadObraOptions() {
  const obras = await loadObras({ soloActivas: true });
  obraSelect.innerHTML =
    `<option value="">Selecciona una obra</option>` +
    obras.map((obra) => `<option value="${escapeHtml(obra.id)}">${escapeHtml(obra.nombre)}</option>`).join("");
}

function setDefaultFechaHora() {
  fechaHoraInput.value = colombiaNowInputValue();
}

function setupStage(stage) {
  const zone = document.getElementById(`dropzone-${stage}`);
  const input = document.getElementById(`fotos-${stage}`);
  wireDropZone(zone, input, (files) => addFiles(stage, files));
}

function addFiles(stage, files) {
  const images = files.filter((file) => file.type.startsWith("image/"));
  state[stage] = [...state[stage], ...images];
  renderPreview(stage);
}

function removeFile(stage, index) {
  state[stage] = state[stage].filter((_, i) => i !== index);
  renderPreview(stage);
}

function renderPreview(stage) {
  const container = document.getElementById(`preview-${stage}`);
  container.innerHTML = "";
  state[stage].forEach((file, index) => {
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
    removeBtn.addEventListener("click", () => removeFile(stage, index));
    item.appendChild(removeBtn);

    container.appendChild(item);
  });
}

async function uploadPhotos(files, orderId, stage) {
  const paths = [];
  for (const file of files) {
    const compressed = await compressImage(file);
    const path = `ordenes/${orderId}/${stage}/${Date.now()}-${compressed.name}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, compressed);
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const result = nuevaOrdenSchema.safeParse({
    obra_id: obraSelect.value,
    piso: document.getElementById("piso").value,
    contratista: document.getElementById("contratista").value,
    fecha_hora: fechaHoraInput.value,
  });
  if (!result.success) {
    statusEl.textContent = firstErrorMessage(result);
    return;
  }

  if (state.antes.length === 0) {
    statusEl.textContent = "Debes adjuntar al menos una foto de antes.";
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = "Comprimiendo y subiendo evidencia...";

  const orderId = crypto.randomUUID();

  try {
    const [fotosAntesPaths, fotosDespuesPaths] = await Promise.all([
      uploadPhotos(state.antes, orderId, "antes"),
      uploadPhotos(state.despues, orderId, "despues"),
    ]);

    const { error } = await supabase.from("ordenes").insert({
      id: orderId,
      obra_id: result.data.obra_id,
      piso: result.data.piso,
      contratista: result.data.contratista,
      fecha_hora: toColombiaIso(result.data.fecha_hora),
      comentarios: document.getElementById("comentarios").value.trim(),
      fotos_antes: fotosAntesPaths,
      fotos_despues: fotosDespuesPaths,
    });
    if (error) throw error;

    const backHref = landingPageFor(currentProfile?.role);
    const backLabel = backHref === "admin.html" ? "Ir a Órdenes" : "Ir a Mis órdenes";
    const pendingNote =
      fotosDespuesPaths.length === 0
        ? " Quedó como <strong>pendiente</strong> — podrás completarla con las fotos de después cuando termines."
        : "";

    await infoDialog(`Orden registrada correctamente.${pendingNote}`, { okLabel: backLabel });
    window.location.href = backHref;
    return;
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});
