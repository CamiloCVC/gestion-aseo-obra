import { supabase } from "./supabase-client.js";
import { requireRole } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { loadObras } from "./obras.js";
import { showToast } from "./toast.js";

const obrasBody = document.getElementById("obras-body");
const createForm = document.getElementById("create-obra-form");
const createModal = document.getElementById("create-obra-modal");
const editForm = document.getElementById("edit-obra-form");
const editModal = document.getElementById("edit-obra-modal");
const editNombreInput = document.getElementById("edit-obra-nombre");
const editActivaInput = document.getElementById("edit-obra-activa");

let editingId = null;

document.getElementById("open-create-obra-btn").addEventListener("click", () => {
  createForm.reset();
  createModal.showModal();
});
document.getElementById("create-obra-cancel").addEventListener("click", () => createModal.close());
document.getElementById("edit-obra-cancel").addEventListener("click", () => editModal.close());

const auth = await requireRole(["superadmin"]);
if (auth) {
  renderHeader(document.getElementById("app-header"), {
    title: "Gestión de Aseo de Obra",
    profile: auth.profile,
    activeHref: "obras.html",
  });
  await loadAndRenderObras();
}

document.getElementById("refresh-obras-btn")?.addEventListener("click", loadAndRenderObras);

async function loadAndRenderObras() {
  const obras = await loadObras();

  if (obras.length === 0) {
    obrasBody.innerHTML = `<tr><td colspan="3" class="empty-state">Aún no hay obras registradas.</td></tr>`;
    return;
  }

  obrasBody.innerHTML = obras.map((obra) => rowTemplate(obra)).join("");
  obrasBody.querySelectorAll(".edit-obra-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id, btn.dataset.nombre, btn.dataset.activa === "true"));
  });
  obrasBody.querySelectorAll(".delete-obra-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteObra(btn.dataset.id, btn.dataset.nombre));
  });
}

function rowTemplate(obra) {
  return `
    <tr data-id="${escapeHtml(obra.id)}">
      <td>${escapeHtml(obra.nombre)}</td>
      <td><span class="badge ${obra.activa ? "badge-completa" : "badge-pendiente"}">${obra.activa ? "Activa" : "Inactiva"}</span></td>
      <td>
        <button class="secondary edit-obra-btn" data-id="${escapeHtml(obra.id)}" data-nombre="${escapeHtml(obra.nombre)}" data-activa="${obra.activa}">Editar</button>
        <button class="secondary danger delete-obra-btn" data-id="${escapeHtml(obra.id)}" data-nombre="${escapeHtml(obra.nombre)}">Eliminar</button>
      </td>
    </tr>
  `;
}

function openEditModal(id, nombre, activa) {
  editingId = id;
  editNombreInput.value = nombre;
  editActivaInput.checked = activa;
  editModal.showModal();
}

async function deleteObra(id, nombre) {
  if (!confirm(`¿Eliminar la obra "${nombre}"? Esta acción no se puede deshacer.`)) return;

  const { error } = await supabase.from("obras").delete().eq("id", id);
  if (error) {
    showToast(
      error.code === "23503" ? "No se puede eliminar: tiene órdenes asociadas. Desactívala en su lugar." : `Error: ${error.message}`,
      "error"
    );
    return;
  }

  showToast(`Obra "${nombre}" eliminada.`, "success");
  await loadAndRenderObras();
}

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nombre = editNombreInput.value.trim();
  const activa = editActivaInput.checked;

  const { error } = await supabase.from("obras").update({ nombre, activa }).eq("id", editingId);
  if (error) {
    showToast(`Error al guardar: ${error.message}`, "error");
    return;
  }

  showToast("Obra actualizada.", "success");
  editModal.close();
  await loadAndRenderObras();
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nombre = document.getElementById("new-obra-nombre").value.trim();

  const { error } = await supabase.from("obras").insert({ nombre });
  if (error) {
    showToast(`Error al crear la obra: ${error.message}`, "error");
    return;
  }

  showToast(`Obra "${nombre}" creada.`, "success");
  createForm.reset();
  await loadAndRenderObras();
  createModal.close();
});
