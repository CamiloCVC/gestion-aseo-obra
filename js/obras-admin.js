import { supabase } from "./supabase-client.js";
import { requireRole } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { loadObras } from "./obras.js";

const obrasBody = document.getElementById("obras-body");
const createForm = document.getElementById("create-obra-form");
const createStatus = document.getElementById("create-obra-status");
const createModal = document.getElementById("create-obra-modal");

document.getElementById("open-create-obra-btn").addEventListener("click", () => {
  createStatus.textContent = "";
  createModal.showModal();
});
document.getElementById("create-obra-cancel").addEventListener("click", () => createModal.close());

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
  obrasBody.querySelectorAll(".save-obra-btn").forEach((btn) => {
    btn.addEventListener("click", () => saveObra(btn.dataset.id));
  });
}

function rowTemplate(obra) {
  return `
    <tr data-id="${escapeHtml(obra.id)}">
      <td><input type="text" class="nombre-input" value="${escapeHtml(obra.nombre)}" /></td>
      <td><input type="checkbox" class="activa-input" ${obra.activa ? "checked" : ""} /></td>
      <td>
        <button class="secondary save-obra-btn" data-id="${escapeHtml(obra.id)}">Guardar</button>
        <span class="save-feedback"></span>
      </td>
    </tr>
  `;
}

async function saveObra(id) {
  const row = obrasBody.querySelector(`tr[data-id="${id}"]`);
  const feedback = row.querySelector(".save-feedback");
  const nombre = row.querySelector(".nombre-input").value.trim();
  const activa = row.querySelector(".activa-input").checked;

  feedback.textContent = "Guardando...";
  const { error } = await supabase.from("obras").update({ nombre, activa }).eq("id", id);
  feedback.textContent = error ? `Error: ${error.message}` : "Guardado.";
}

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  createStatus.textContent = "Creando obra...";

  const nombre = document.getElementById("new-obra-nombre").value.trim();

  const { error } = await supabase.from("obras").insert({ nombre });
  if (error) {
    createStatus.textContent = `Error: ${error.message}`;
    return;
  }

  createStatus.textContent = "";
  createForm.reset();
  await loadAndRenderObras();
  createModal.close();
});
