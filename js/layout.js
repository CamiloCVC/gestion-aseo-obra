import { supabase } from "./supabase-client.js";
import { escapeHtml } from "./escape-html.js";

const ROLE_LABELS = {
  empleado: "Empleado",
  admin: "Admin",
  superadmin: "Superadmin",
};

export function renderHeader(container, { title, profile, activeHref }) {
  const isStaff = profile?.role === "admin" || profile?.role === "superadmin";

  const links = isStaff
    ? [
        { href: "admin.html", label: "Órdenes" },
        { href: "nueva-orden.html", label: "Nueva orden" },
        ...(profile.role === "superadmin" ? [{ href: "usuarios.html", label: "Usuarios" }] : []),
      ]
    : [
        { href: "mis-ordenes.html", label: "Mis órdenes" },
        { href: "nueva-orden.html", label: "Nueva orden" },
      ];

  container.innerHTML = `
    <div class="topbar">
      <div class="topbar-brand">${escapeHtml(title)}</div>
      <nav class="topbar-nav">
        ${links
          .map(
            (link) =>
              `<a href="${link.href}" class="${link.href === activeHref ? "active" : ""}">${link.label}</a>`
          )
          .join("")}
      </nav>
      <div class="topbar-user">
        <span class="topbar-name">${escapeHtml(profile?.nombre)}</span>
        <span class="badge badge-${profile?.role}">${ROLE_LABELS[profile?.role] ?? ""}</span>
        <button class="secondary" id="logout-btn">Salir</button>
      </div>
    </div>
  `;

  container.querySelector("#logout-btn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
  });
}
