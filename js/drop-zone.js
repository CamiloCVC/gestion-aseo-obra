export function wireDropZone(zoneEl, inputEl, onFilesChange) {
  const openPicker = () => inputEl.click();
  let leaveTimer;

  zoneEl.addEventListener("click", openPicker);
  zoneEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  });

  // dragenter/dragleave also fire when the pointer crosses child elements
  // (like the <p> text inside the zone), not just on true enter/exit. A
  // stray dragleave from crossing a child would otherwise instantly clear
  // drag-active while the cursor is still over the zone. Debouncing the
  // removal lets a follow-up dragenter/dragover (which bubbles from the
  // child) cancel it — and it always self-clears if the drag truly ends.
  ["dragenter", "dragover"].forEach((evt) =>
    zoneEl.addEventListener(evt, (event) => {
      event.preventDefault();
      clearTimeout(leaveTimer);
      zoneEl.classList.add("drag-active");
    })
  );

  zoneEl.addEventListener("dragleave", (event) => {
    event.preventDefault();
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => zoneEl.classList.remove("drag-active"), 80);
  });

  zoneEl.addEventListener("drop", (event) => {
    event.preventDefault();
    clearTimeout(leaveTimer);
    zoneEl.classList.remove("drag-active");
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) onFilesChange(files);
  });

  inputEl.addEventListener("change", () => {
    onFilesChange(Array.from(inputEl.files));
    inputEl.value = "";
  });
}
