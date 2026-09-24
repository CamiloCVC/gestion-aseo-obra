let container;

function getContainer() {
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("role", "status");
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  getContainer().appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 4500);
}
