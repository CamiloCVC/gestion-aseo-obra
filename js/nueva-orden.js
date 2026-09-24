import { supabase } from "./supabase-client.js";
import { requireActiveProfile, landingPageFor } from "./auth.js";
import { renderHeader } from "./layout.js";

const form = document.getElementById("order-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const fechaHoraInput = document.getElementById("fecha-hora");

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
}

function setDefaultFechaHora() {
  fechaHoraInput.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

async function uploadPhotos(files, orderId, stage) {
  const paths = [];
  for (const file of files) {
    const path = `ordenes/${orderId}/${stage}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file);
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fotosAntes = Array.from(document.getElementById("fotos-antes").files);
  const fotosDespues = Array.from(document.getElementById("fotos-despues").files);

  if (fotosAntes.length === 0 || fotosDespues.length === 0) {
    statusEl.textContent = "Debes adjuntar al menos una foto de antes y una de después.";
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = "Subiendo evidencia...";

  const orderId = crypto.randomUUID();

  try {
    const [fotosAntesPaths, fotosDespuesPaths] = await Promise.all([
      uploadPhotos(fotosAntes, orderId, "antes"),
      uploadPhotos(fotosDespues, orderId, "despues"),
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
    setDefaultFechaHora();
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});
