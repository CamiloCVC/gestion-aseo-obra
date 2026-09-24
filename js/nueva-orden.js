import { supabase } from "./supabase-client.js";
import { requireActiveProfile, landingPageFor } from "./auth.js";
import { renderHeader } from "./layout.js";
import { wireDropZone } from "./drop-zone.js";
import { compressImage } from "./image-compression.js";

const form = document.getElementById("order-form");
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
}

function setDefaultFechaHora() {
  fechaHoraInput.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
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

  if (state.antes.length === 0 || state.despues.length === 0) {
    statusEl.textContent = "Debes adjuntar al menos una foto de antes y una de después.";
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
      piso: document.getElementById("piso").value.trim(),
      contratista: document.getElementById("contratista").value.trim(),
      fecha_hora: fechaHoraInput.value,
      comentarios: document.getElementById("comentarios").value.trim(),
      fotos_antes: fotosAntesPaths,
      fotos_despues: fotosDespuesPaths,
    });
    if (error) throw error;

    const backHref = landingPageFor(currentProfile?.role);
    const backLabel = backHref === "admin.html" ? "Ir a Órdenes" : "Ir a Mis órdenes";
    statusEl.innerHTML = `Orden registrada correctamente. <a href="${backHref}">${backLabel}</a>`;

    form.reset();
    state.antes = [];
    state.despues = [];
    renderPreview("antes");
    renderPreview("despues");
    setDefaultFechaHora();
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});
