let dialog;

function getDialog() {
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "info-dialog";
  dialog.innerHTML = `
    <p class="info-dialog-message"></p>
    <div class="info-dialog-actions">
      <button type="button" class="info-dialog-ok"></button>
    </div>
  `;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.appendChild(dialog);
  return dialog;
}

// Modal de aviso con un solo botón (éxito/confirmación de una acción, no una
// pregunta). El mensaje es HTML controlado por la app, no por el usuario.
// Resuelve cuando se cierra (botón, Escape, o click afuera).
export function infoDialog(message, { okLabel = "Aceptar" } = {}) {
  const box = getDialog();
  const okBtn = box.querySelector(".info-dialog-ok");

  box.querySelector(".info-dialog-message").innerHTML = message;
  okBtn.textContent = okLabel;

  return new Promise((resolve) => {
    const onOk = () => box.close();
    const onClose = () => {
      okBtn.removeEventListener("click", onOk);
      box.removeEventListener("close", onClose);
      resolve();
    };
    okBtn.addEventListener("click", onOk);
    box.addEventListener("close", onClose);
    box.showModal();
  });
}
