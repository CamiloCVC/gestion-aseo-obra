let bubble;

function ensureBubble() {
  if (!bubble) {
    bubble = document.createElement("div");
    bubble.className = "icon-tooltip";
    document.body.appendChild(bubble);
  }
  return bubble;
}

function show(target) {
  const label = target.dataset.tooltip;
  if (!label) return;
  const el = ensureBubble();
  el.textContent = label;
  const rect = target.getBoundingClientRect();
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top - 8}px`;
  el.classList.add("icon-tooltip-visible");
}

function hide() {
  bubble?.classList.remove("icon-tooltip-visible");
}

document.addEventListener("mouseover", (event) => {
  const target = event.target.closest("[data-tooltip]");
  if (target) show(target);
});

document.addEventListener("mouseout", (event) => {
  const target = event.target.closest("[data-tooltip]");
  if (target && !target.contains(event.relatedTarget)) hide();
});

document.addEventListener("focusin", (event) => {
  const target = event.target.closest("[data-tooltip]");
  if (target) show(target);
});

document.addEventListener("focusout", (event) => {
  const target = event.target.closest("[data-tooltip]");
  if (target) hide();
});
