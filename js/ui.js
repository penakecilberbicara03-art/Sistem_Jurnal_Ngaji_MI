/**
 * js/ui.js
 * Komponen antarmuka bersama: Toast notifikasi dan Modal konfirmasi.
 */

import { escapeHtml } from './config.js';

/**
 * Menampilkan toast notifikasi non-blocking.
 * @param {string} message
 * @param {'success' | 'error' | 'info'} type
 */
export function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const tone =
    type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : type === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-slate-200 bg-white text-slate-900';

  const toastEl = document.createElement('div');
  toastEl.className = `pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-md transition-opacity duration-200 ${tone}`;
  toastEl.textContent = message;
  toastContainer.appendChild(toastEl);

  setTimeout(() => {
    toastEl.style.opacity = '0';
    setTimeout(() => toastEl.remove(), 200);
  }, 3500);
}

/**
 * Menampilkan dialog konfirmasi pengganti window.confirm.
 * @param {{ title: string, message: string, confirmText?: string, onConfirm: () => Promise<void> | void }} options
 */
export function showConfirmModal({ title, message, confirmText = 'Lanjutkan', onConfirm }) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div class="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-lg" role="dialog" aria-modal="true">
        <h3 class="text-base font-bold text-slate-900">${escapeHtml(title)}</h3>
        <p class="mt-2 text-sm text-slate-600 leading-relaxed">${escapeHtml(message)}</p>
        <div class="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            id="modal-cancel-btn"
            class="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            id="modal-confirm-btn"
            class="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            ${escapeHtml(confirmText)}
          </button>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    modalContainer.innerHTML = '';
  };

  modalContainer.querySelector('#modal-cancel-btn')?.addEventListener('click', close);
  modalContainer.querySelector('#modal-confirm-btn')?.addEventListener('click', async () => {
    const btn = modalContainer.querySelector('#modal-confirm-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Memproses...';
    }
    try {
      await onConfirm();
    } finally {
      close();
    }
  });
}
