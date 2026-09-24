import { supabase } from "./supabase-client.js";
import { supabaseUrl } from "./supabase-config.js";
import { requireRole } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";
import { showToast } from "./toast.js";
import { renderIcons } from "./icons.js";
import "./tooltip.js";

const usersBody = document.getElementById("users-body");
const createForm = document.getElementById("create-user-form");
const createModal = document.getElementById("create-user-modal");
const editForm = document.getElementById("edit-user-form");
const editModal = document.getElementById("edit-user-modal");
const editNombreInput = document.getElementById("edit-user-nombre");
const editRoleInput = document.getElementById("edit-user-role");
const editActivoInput = document.getElementById("edit-user-activo");

let editingId = null;

document.getElementById("open-create-user-btn").addEventListener("click", () => {
  createForm.reset();
  createModal.showModal();
});
document.getElementById("create-user-cancel").addEventListener("click", () => createModal.close());
document.getElementById("edit-user-cancel").addEventListener("click", () => editModal.close());

const auth = await requireRole(["superadmin"]);
if (auth) {
  renderHeader(document.getElementById("app-header"), {
    title: "Gestión de Aseo de Obra",
    profile: auth.profile,
    activeHref: "usuarios.html",
  });
  await loadUsers();
}

document.getElementById("refresh-users-btn")?.addEventListener("click", loadUsers);

async function loadUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, email, role, activo")
    .order("email", { ascending: true });

  if (error) {
    usersBody.innerHTML = `<tr><td colspan="5" class="empty-state">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  usersBody.innerHTML = data.map((user) => rowTemplate(user)).join("");
  usersBody.querySelectorAll(".edit-user-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset));
  });
  usersBody.querySelectorAll(".delete-user-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteUser(btn.dataset.id, btn.dataset.email));
  });
  renderIcons();
}

const ROLE_LABELS = { empleado: "Empleado", admin: "Admin", superadmin: "Superadmin" };

function rowTemplate(user) {
  const isSelf = user.id === auth.session.user.id;
  return `
    <tr data-id="${escapeHtml(user.id)}">
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.nombre)}</td>
      <td>${ROLE_LABELS[user.role] ?? escapeHtml(user.role)}</td>
      <td><span class="badge ${user.activo ? "badge-completa" : "badge-pendiente"}">${user.activo ? "Activo" : "Inactivo"}</span></td>
      <td class="icon-actions">
        <button class="icon-btn edit-user-btn" data-id="${escapeHtml(user.id)}" data-nombre="${escapeHtml(user.nombre)}" data-role="${escapeHtml(user.role)}" data-activo="${user.activo}" data-tooltip="Editar usuario" aria-label="Editar usuario"><i data-lucide="pencil"></i></button>
        ${isSelf ? "" : `<button class="icon-btn icon-btn-danger delete-user-btn" data-id="${escapeHtml(user.id)}" data-email="${escapeHtml(user.email)}" data-tooltip="Eliminar usuario" aria-label="Eliminar usuario"><i data-lucide="trash-2"></i></button>`}
      </td>
    </tr>
  `;
}

function openEditModal(dataset) {
  editingId = dataset.id;
  editNombreInput.value = dataset.nombre;
  editRoleInput.value = dataset.role;
  editActivoInput.checked = dataset.activo === "true";
  editModal.showModal();
}

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const nombre = editNombreInput.value.trim();
  const role = editRoleInput.value;
  const activo = editActivoInput.checked;

  const { error } = await supabase.from("profiles").update({ nombre, role, activo }).eq("id", editingId);
  if (error) {
    showToast(`Error al guardar: ${error.message}`, "error");
    return;
  }

  showToast("Usuario actualizado.", "success");
  editModal.close();
  await loadUsers();
});

async function deleteUser(id, email) {
  if (!confirm(`¿Eliminar al usuario ${email}? Esta acción no se puede deshacer.`)) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Error desconocido");

    showToast(`Usuario ${email} eliminado.`, "success");
    await loadUsers();
  } catch (err) {
    showToast(`Error al eliminar: ${err.message}`, "error");
  }
}

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = document.getElementById("new-email").value.trim();
  const nombre = document.getElementById("new-nombre").value.trim();
  const password = document.getElementById("new-password").value;
  const role = document.getElementById("new-role").value;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, password, nombre, role }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Error desconocido");

    showToast(`Usuario ${result.email} creado.`, "success");
    createForm.reset();
    await loadUsers();
    createModal.close();
  } catch (err) {
    showToast(`Error al crear: ${err.message}`, "error");
  }
});
