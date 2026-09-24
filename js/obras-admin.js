import { supabase } from "./supabase-client.js";
import { requireRole } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { loadObras } from "./obras.js";
import { showToast } from "./toast.js";
import { renderIcons } from "./icons.js";
import "./tooltip.js";
import { createObraSchema, editObraSchema, firstErrorMessage } from "./validation.js";

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
  renderIcons();
}

function rowTemplate(obra) {
  return `
    <tr data-id="${escapeHtml(obra.id)}">
      <td>${escapeHtml(obra.nombre)}</td>
      <td><span class="badge ${obra.activa ? "badge-completa" : "badge-pendiente"}">${obra.activa ? "Activa" : "Inactiva"}</span></td>
      <td class="icon-actions">
        <button class="icon-btn edit-obra-btn" data-id="${escapeHtml(obra.id)}" data-nombre="${escapeHtml(obra.nombre)}" data-activa="${obra.activa}" data-tooltip="Editar obra" aria-label="Editar obra"><i data-lucide="pencil"></i></button>
        <button class="icon-btn icon-btn-danger delete-obra-btn" data-id="${escapeHtml(obra.id)}" data-nombre="${escapeHtml(obra.nombre)}" data-tooltip="Eliminar obra" aria-label="Eliminar obra"><i data-lucide="trash-2"></i></button>
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

  const parsed = editObraSchema.safeParse({
    nombre: editNombreInput.value,
    activa: editActivaInput.checked,
  });
  if (!parsed.success) {
    showToast(firstErrorMessage(parsed), "error");
    return;
  }

  const { error } = await supabase.from("obras").update(parsed.data).eq("id", editingId);
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

  const parsed = createObraSchema.safeParse({
    nombre: document.getElementById("new-obra-nombre").value,
  });
  if (!parsed.success) {
    showToast(firstErrorMessage(parsed), "error");
    return;
  }

  const { error } = await supabase.from("obras").insert(parsed.data);
  if (error) {
    showToast(`Error al crear la obra: ${error.message}`, "error");
    return;
  }

  showToast(`Obra "${parsed.data.nombre}" creada.`, "success");
  createForm.reset();
  await loadAndRenderObras();
  createModal.close();
});
