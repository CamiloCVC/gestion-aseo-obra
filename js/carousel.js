import { escapeHtml } from "./escape-html.js";
import { downloadFile } from "./download-file.js";

let lightbox;

// Un solo <dialog> reutilizado por todos los carruseles de la página, para
// agrandar la foto al hacer click (estilo redes sociales).
function getLightbox() {
  if (lightbox) return lightbox;

  lightbox = document.createElement("dialog");
  lightbox.className = "lightbox";
  lightbox.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Cerrar">×</button>
    <img class="lightbox-image" alt="" />
  `;
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
  document.body.appendChild(lightbox);
  return lightbox;
}

function openLightbox(url, alt) {
  const box = getLightbox();
  const img = box.querySelector(".lightbox-image");
  img.src = url;
  img.alt = alt;
  box.showModal();
}

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
        <img class="carousel-image" src="${escapeHtml(urls[index])}" alt="${escapeHtml(labelPrefix)} ${index + 1}" loading="lazy" decoding="async" />
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

    container.querySelector(".carousel-image").addEventListener("click", () => {
      openLightbox(urls[index], `${labelPrefix} ${index + 1}`);
    });

    container.querySelector(".carousel-download").addEventListener("click", () => {
      downloadFile(urls[index], `${labelPrefix}-${index + 1}.jpg`);
    });
  }

  paint();
}
