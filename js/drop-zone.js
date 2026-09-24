export function wireDropZone(zoneEl, inputEl, onFilesChange) {
  const openPicker = () => inputEl.click();

  zoneEl.addEventListener("click", openPicker);
  zoneEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  });

  ["dragenter", "dragover"].forEach((evt) =>
    zoneEl.addEventListener(evt, (event) => {
      event.preventDefault();
      zoneEl.classList.add("drag-active");
    })
  );

  ["dragleave", "drop"].forEach((evt) =>
    zoneEl.addEventListener(evt, (event) => {
      event.preventDefault();
      zoneEl.classList.remove("drag-active");
    })
  );

  zoneEl.addEventListener("drop", (event) => {
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) onFilesChange(files);
  });

  inputEl.addEventListener("change", () => {
    onFilesChange(Array.from(inputEl.files));
    inputEl.value = "";
  });
}
