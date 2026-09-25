export const PAGE_SIZE = 15;

const numberFormat = new Intl.NumberFormat("es-CO");

export function pageInfo(page, total, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const offset = (current - 1) * pageSize;
  return {
    page: current,
    totalPages,
    offset,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, total),
  };
}

export function formatCounter({ from, to }, total) {
  if (total === 0) return "0 de 0";
  return `${numberFormat.format(from)}–${numberFormat.format(to)} de ${numberFormat.format(total)}`;
}

export function renderPager(container, { page, totalPages }, onPage) {
  container.hidden = totalPages <= 1;
  container.innerHTML = `
    <button type="button" class="secondary" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>‹ Anterior</button>
    <span class="pager-status">Página ${page} de ${totalPages}</span>
    <button type="button" class="secondary" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>Siguiente ›</button>
  `;
  container.querySelectorAll("button[data-page]").forEach((button) => {
    button.addEventListener("click", () => onPage(Number(button.dataset.page)));
  });
}
