import { escapeHtml } from "./escape-html.js";
import { downloadFile } from "./download-file.js";
import { renderIcons } from "./icons.js";

const SWIPER_VERSION = "14.2.0";
const SWIPER_JS = `https://cdn.jsdelivr.net/npm/swiper@${SWIPER_VERSION}/swiper-bundle.min.mjs`;
const SWIPER_CSS = `https://cdn.jsdelivr.net/npm/swiper@${SWIPER_VERSION}/swiper-bundle.min.css`;

let swiperModulePromise;

// Swiper es una librería pesada (gestos táctiles, zoom, navegación) que solo
// hace falta si alguien de hecho ve un carrusel — se carga (JS + CSS) la
// primera vez que se necesita, no de entrada.
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

// Todas las fotos se pintan como <img> reales desde el inicio (sin módulo
// "lazy" de Swiper): el navegador las pide todas en paralelo apenas se monta
// el carrusel, en vez de una por una a medida que se navega.
function slidesMarkup(urls, labelPrefix) {
  return urls
    .map(
      (url, i) => `
        <div class="swiper-slide">
          <div class="swiper-zoom-container">
            <img src="${escapeHtml(url)}" alt="${escapeHtml(labelPrefix)} ${i + 1}" decoding="async" />
          </div>
        </div>
      `
    )
    .join("");
}

// --- Lightbox: un solo <dialog> reutilizado por toda la página, con el
// carrusel completo agrandado (swipe, flechas, teclado, zoom). ---

let lightbox;
let lightboxSwiper;

function getLightbox() {
  if (lightbox) return lightbox;

  lightbox = document.createElement("dialog");
  lightbox.className = "lightbox";
  lightbox.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Cerrar"><i data-lucide="x"></i></button>
    <button type="button" class="lightbox-download" aria-label="Descargar"><i data-lucide="download"></i></button>
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
    lightboxSwiper?.destroy(true, true);
    lightboxSwiper = null;
  });
  document.body.appendChild(lightbox);
  renderIcons();
  return lightbox;
}

async function openLightbox(urls, startIndex, labelPrefix) {
  const Swiper = await loadSwiper();
  const box = getLightbox();

  box.querySelector(".swiper-wrapper").innerHTML = slidesMarkup(urls, labelPrefix);

  box.querySelector(".lightbox-download").onclick = () => {
    const i = lightboxSwiper?.activeIndex ?? startIndex;
    downloadFile(urls[i], `${labelPrefix}-${i + 1}.jpg`);
  };

  lightboxSwiper = new Swiper(box.querySelector(".lightbox-swiper"), {
    initialSlide: startIndex,
    loop: urls.length > 1,
    zoom: true,
    keyboard: { enabled: true },
    navigation: urls.length > 1 && {
      nextEl: box.querySelector(".swiper-button-next"),
      prevEl: box.querySelector(".swiper-button-prev"),
    },
    pagination: urls.length > 1 && {
      el: box.querySelector(".swiper-pagination"),
      type: "fraction",
    },
  });

  box.showModal();
}

// --- Carrusel compacto embebido (Ver detalle / Ver avances) ---

export async function renderCarousel(container, urls, labelPrefix) {
  if (urls.length === 0) {
    container.innerHTML = `<p class="empty-state">Sin fotos</p>`;
    return;
  }

  const multiple = urls.length > 1;
  container.innerHTML = `
    <div class="swiper compact-swiper">
      <div class="swiper-wrapper">${slidesMarkup(urls, labelPrefix)}</div>
      ${multiple ? `<div class="swiper-button-prev"></div><div class="swiper-button-next"></div><div class="swiper-pagination"></div>` : ""}
    </div>
    <div class="carousel-footer">
      <button type="button" class="secondary carousel-download">Descargar</button>
    </div>
  `;

  const swiperEl = container.querySelector(".compact-swiper");
  const Swiper = await loadSwiper();
  const swiper = new Swiper(swiperEl, {
    loop: multiple,
    navigation: multiple && {
      nextEl: container.querySelector(".swiper-button-next"),
      prevEl: container.querySelector(".swiper-button-prev"),
    },
    pagination: multiple && {
      el: container.querySelector(".swiper-pagination"),
      type: "fraction",
    },
  });

  swiperEl.querySelectorAll(".swiper-slide img").forEach((img, i) => {
    img.addEventListener("click", () => {
      openLightbox(urls, i, labelPrefix).catch((err) => console.error("No se pudo abrir el visor de fotos", err));
    });
  });

  container.querySelector(".carousel-download").addEventListener("click", () => {
    const i = swiper.realIndex ?? 0;
    downloadFile(urls[i], `${labelPrefix}-${i + 1}.jpg`);
  });
}
