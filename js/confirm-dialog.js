let dialog;

function getDialog() {
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.className = "confirm-dialog";
  dialog.innerHTML = `
    <p class="confirm-dialog-message"></p>
    <div class="confirm-dialog-actions">
      <button type="button" class="secondary confirm-dialog-cancel"></button>
      <button type="button" class="confirm-dialog-confirm"></button>
    </div>
  `;
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.appendChild(dialog);
  return dialog;
}

// Reemplazo estético de confirm() nativo. Resuelve true/false; cerrar con
// Escape, click afuera, o "Cancelar" siempre resuelve false.
export function confirmDialog(message, { confirmLabel = "Eliminar", cancelLabel = "Cancelar", danger = true } = {}) {
  const box = getDialog();
  const confirmBtn = box.querySelector(".confirm-dialog-confirm");
  const cancelBtn = box.querySelector(".confirm-dialog-cancel");

  box.querySelector(".confirm-dialog-message").textContent = message;
  confirmBtn.textContent = confirmLabel;
  confirmBtn.className = `confirm-dialog-confirm ${danger ? "danger" : ""}`;
  cancelBtn.textContent = cancelLabel;

  return new Promise((resolve) => {
    let result = false;

    const onConfirm = () => {
      result = true;
      box.close();
    };
    const onCancel = () => box.close();
    const onClose = () => {
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      box.removeEventListener("close", onClose);
      resolve(result);
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    box.addEventListener("close", onClose);
    box.showModal();
  });
}
