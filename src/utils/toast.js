/**
 * Toast Adapter - Replaces wx.showToast/wx.showModal
 */

// Simple toast implementation
let toastContainer = null;

export const showToast = (options) => {
  const { title = '', icon = 'none', duration = 1500 } = options;

  // Create toast container if not exists
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-size: 14px;
    min-width: 120px;
    text-align: center;
    margin-bottom: 16px;
  `;

  // Add icon if success
  if (icon === 'success') {
    toast.innerHTML = `✓ ${title}`;
  } else {
    toast.textContent = title;
  }

  toastContainer.appendChild(toast);

  // Remove after duration
  setTimeout(() => {
    toast.remove();
    if (toastContainer.children.length === 0) {
      toastContainer.remove();
      toastContainer = null;
    }
  }, duration);
};

// Simple modal implementation
export const showModal = (options) => {
  const {
    title = '',
    content = '',
    confirmText = '确认',
    confirmColor = '#07C160',
    showCancel = true,
    cancelText = '取消',
    success
  } = options;

  // Create modal element
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    min-width: 300px;
    max-width: 90%;
  `;

  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.style.cssText = `
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    margin-bottom: 16px;
  `;

  const contentEl = document.createElement('div');
  contentEl.textContent = content;
  contentEl.style.cssText = `
    font-size: 14px;
    color: #666;
    text-align: center;
    margin-bottom: 24px;
    line-height: 1.5;
  `;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 12px;
  `;

  if (showCancel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = cancelText;
    cancelBtn.style.cssText = `
      flex: 1;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      font-size: 14px;
      cursor: pointer;
    `;
    cancelBtn.onclick = () => {
      modal.remove();
      if (success) success({ confirm: false, cancel: true });
    };
    buttonContainer.appendChild(cancelBtn);
  }

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = confirmText;
  confirmBtn.style.cssText = `
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: ${confirmColor};
    color: white;
    font-size: 14px;
    cursor: pointer;
  `;
  confirmBtn.onclick = () => {
    modal.remove();
    if (success) success({ confirm: true, cancel: false });
  };
  buttonContainer.appendChild(confirmBtn);

  modalContent.appendChild(titleEl);
  modalContent.appendChild(contentEl);
  modalContent.appendChild(buttonContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
};

export default { showToast, showModal };
