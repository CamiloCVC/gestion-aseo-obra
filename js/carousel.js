import { escapeHtml } from "./escape-html.js";
import { downloadFile } from "./download-file.js";

export function renderCarousel(container, urls, labelPrefix) {
  let index = 0;

  function paint() {
    if (urls.length === 0) {
      container.innerHTML = `<p class="empty-state">Sin fotos</p>`;
      return;
    }

    container.innerHTML = `
      <div class="carousel">
        <button type="button" class="carousel-nav" data-dir="-1" ${urls.length < 2 ? "disabled" : ""}>‹</button>
        <img class="carousel-image" src="${escapeHtml(urls[index])}" alt="${escapeHtml(labelPrefix)} ${index + 1}" />
        <button type="button" class="carousel-nav" data-dir="1" ${urls.length < 2 ? "disabled" : ""}>›</button>
      </div>
      <div class="carousel-footer">
        <span>${index + 1} / ${urls.length}</span>
        <button type="button" class="secondary carousel-download">Descargar</button>
      </div>
    `;

    container.querySelectorAll(".carousel-nav").forEach((btn) => {
      btn.addEventListener("click", () => {
        index = (index + Number(btn.dataset.dir) + urls.length) % urls.length;
        paint();
      });
    });

    container.querySelector(".carousel-download").addEventListener("click", () => {
      downloadFile(urls[index], `${labelPrefix}-${index + 1}.jpg`);
    });
  }

  paint();
}
