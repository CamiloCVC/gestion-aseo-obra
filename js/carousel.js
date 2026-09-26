import { escapeHtml } from "./escape-html.js";
import { downloadFile } from "./download-file.js";

const SWIPER_VERSION = "14.2.0";
const SWIPER_JS = `https://cdn.jsdelivr.net/npm/swiper@${SWIPER_VERSION}/swiper-bundle.min.mjs`;
const SWIPER_CSS = `https://cdn.jsdelivr.net/npm/swiper@${SWIPER_VERSION}/swiper-bundle.min.css`;

let lightbox;
let swiperInstance;
let swiperModulePromise;

// Swiper es una librería pesada (gestos táctiles, zoom, navegación) que solo
// hace falta si alguien de hecho abre el visor de fotos — se carga (JS + CSS)
// la primera vez que se necesita, no de entrada.
function loadSwiper() {
  if (!swiperModulePromise) {
    swiperModulePromise = import(SWIPER_JS).then((mod) => {
      if (!document.querySelector("link[data-swiper-css]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = SWIPER_CSS;
        link.dataset.swiperCss = "true";
        document.head.appendChild(link);
      }
      return mod.default;
    });
  }
  return swiperModulePromise;
}

// Un solo <dialog> reutilizado por todos los carruseles de la página: abre
// el carrusel completo agrandado (no solo la foto actual), con navegación,
// swipe y zoom (estilo redes sociales).
function getLightbox() {
  if (lightbox) return lightbox;

  lightbox = document.createElement("dialog");
  lightbox.className = "lightbox";
  lightbox.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Cerrar">×</button>
    <button type="button" class="lightbox-download" aria-label="Descargar">⭳</button>
    <div class="swiper lightbox-swiper">
      <div class="swiper-wrapper"></div>
      <div class="swiper-button-prev"></div>
      <div class="swiper-button-next"></div>
      <div class="swiper-pagination"></div>
    </div>
  `;
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("close", () => {
    swiperInstance?.destroy(true, true);
    swiperInstance = null;
  });
  document.body.appendChild(lightbox);
  return lightbox;
}

async function openLightbox(urls, startIndex, labelPrefix) {
  const Swiper = await loadSwiper();
  const box = getLightbox();

  box.querySelector(".swiper-wrapper").innerHTML = urls
    .map(
      (url, i) => `
        <div class="swiper-slide">
          <div class="swiper-zoom-container">
            <img src="${escapeHtml(url)}" alt="${escapeHtml(labelPrefix)} ${i + 1}" />
          </div>
        </div>
      `
    )
    .join("");

  box.querySelector(".lightbox-download").onclick = () => {
    const i = swiperInstance?.activeIndex ?? startIndex;
    downloadFile(urls[i], `${labelPrefix}-${i + 1}.jpg`);
  };

  swiperInstance = new Swiper(box.querySelector(".lightbox-swiper"), {
    initialSlide: startIndex,
    loop: urls.length > 1,
    zoom: true,
    keyboard: { enabled: true },
    navigation: {
      nextEl: box.querySelector(".swiper-button-next"),
      prevEl: box.querySelector(".swiper-button-prev"),
    },
    pagination: {
      el: box.querySelector(".swiper-pagination"),
      type: "fraction",
    },
  });

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
      openLightbox(urls, index, labelPrefix).catch((err) => console.error("No se pudo abrir el visor de fotos", err));
    });

    container.querySelector(".carousel-download").addEventListener("click", () => {
      downloadFile(urls[index], `${labelPrefix}-${index + 1}.jpg`);
    });
  }

  paint();
}
