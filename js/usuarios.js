import { supabase } from "./supabase-client.js";
import { supabaseUrl } from "./supabase-config.js";
import { requireRole } from "./auth.js";
import { renderHeader } from "./layout.js";
import { escapeHtml } from "./escape-html.js";

const usersBody = document.getElementById("users-body");
const createForm = document.getElementById("create-user-form");
const createStatus = document.getElementById("create-status");
const createModal = document.getElementById("create-user-modal");

document.getElementById("open-create-user-btn").addEventListener("click", () => {
  createStatus.textContent = "";
  createModal.showModal();
});
document.getElementById("create-user-cancel").addEventListener("click", () => createModal.close());

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
    usersBody.innerHTML = `<tr><td colspan="6" class="empty-state">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  usersBody.innerHTML = data.map((user) => rowTemplate(user)).join("");
  usersBody.querySelectorAll(".save-user-btn").forEach((btn) => {
    btn.addEventListener("click", () => saveUser(btn.dataset.id));
  });
  usersBody.querySelectorAll(".delete-user-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteUser(btn.dataset.id, btn.dataset.email));
  });
}

function rowTemplate(user) {
  const isSelf = user.id === auth.session.user.id;
  return `
    <tr data-id="${escapeHtml(user.id)}">
      <td>${escapeHtml(user.email)}</td>
      <td><input type="text" class="nombre-input" value="${escapeHtml(user.nombre)}" /></td>
      <td>
        <select class="role-input">
          <option value="empleado" ${user.role === "empleado" ? "selected" : ""}>Empleado</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
          <option value="superadmin" ${user.role === "superadmin" ? "selected" : ""}>Superadmin</option>
        </select>
      </td>
      <td><input type="checkbox" class="activo-input" ${user.activo ? "checked" : ""} /></td>
      <td>
        <button class="secondary save-user-btn" data-id="${escapeHtml(user.id)}">Guardar</button>
        <span class="save-feedback"></span>
      </td>
      <td>
        ${isSelf ? "" : `<button class="secondary danger delete-user-btn" data-id="${escapeHtml(user.id)}" data-email="${escapeHtml(user.email)}">Eliminar</button>`}
      </td>
    </tr>
  `;
}

async function saveUser(id) {
  const row = usersBody.querySelector(`tr[data-id="${id}"]`);
  const feedback = row.querySelector(".save-feedback");
  const nombre = row.querySelector(".nombre-input").value.trim();
  const role = row.querySelector(".role-input").value;
  const activo = row.querySelector(".activo-input").checked;

  feedback.textContent = "Guardando...";
  const { error } = await supabase.from("profiles").update({ nombre, role, activo }).eq("id", id);
  feedback.textContent = error ? `Error: ${error.message}` : "Guardado.";
}

async function deleteUser(id, email) {
  if (!confirm(`¿Eliminar al usuario ${email}? Esta acción no se puede deshacer.`)) return;

  const row = usersBody.querySelector(`tr[data-id="${id}"]`);
  const feedback = row.querySelector(".save-feedback");
  feedback.textContent = "Eliminando...";

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

    await loadUsers();
  } catch (err) {
    feedback.textContent = `Error: ${err.message}`;
  }
}

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  createStatus.textContent = "Creando usuario...";

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

    createStatus.textContent = `Usuario ${result.email} creado.`;
    createForm.reset();
    await loadUsers();
    createModal.close();
  } catch (err) {
    createStatus.textContent = `Error: ${err.message}`;
  }
});
