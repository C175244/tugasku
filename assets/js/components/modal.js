// Dialog kecil yang bisa ditutup dengan tombol atau klik latar.
import { el } from '../utils/dom.js';

const CONFIRMATION_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const confirmationCode = () => {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return [...values]
    .map((value) => CONFIRMATION_CHARS[value % CONFIRMATION_CHARS.length])
    .join('');
};

export const openModal = (title, content, onClose) => {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const close = () => {
    backdrop.remove();
    onClose?.();
  };
  const heading = el(
    'div',
    { class: 'row space' },
    el('h2', {}, title),
    el('button', {
      class: 'btn btn-soft icon-btn',
      'aria-label': 'Tutup',
      onclick: close,
    }, '×'),
  );
  backdrop.append(el(
    'section',
    { class: 'modal glass', role: 'dialog', 'aria-modal': 'true' },
    heading,
    content,
  ));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.body.append(backdrop);
  return { close, node: backdrop };
};

export const openDestructiveDialog = ({
  title,
  consequence,
  actionLabel = 'Hapus',
  onConfirm,
}) => {
  const previousFocus = document.activeElement;
  const code = confirmationCode();
  const backdrop = el('div', {
    class: 'modal-backdrop destructive-dialog',
    dataset: { confirmationCode: code },
  });
  const dialog = el('section', {
    class: 'modal glass',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'destructive-dialog-title',
    tabindex: '-1',
  });
  let closed = false;
  let busy = false;
  const close = () => {
    if (closed || busy) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    previousFocus?.focus?.();
  };
  const focusable = () => [...dialog.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), [href], select, textarea',
  )].filter((node) => node.offsetParent !== null);
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = focusable();
    if (!nodes.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const heading = el(
    'div',
    { class: 'row space' },
    el('h2', { id: 'destructive-dialog-title' }, title),
    el('button', {
      class: 'btn btn-soft icon-btn',
      type: 'button',
      'aria-label': 'Tutup',
      onclick: close,
    }, '×'),
  );
  const error = el('p', {
    class: 'error destructive-dialog-error',
    role: 'alert',
    hidden: true,
  });
  const cancel = el('button', {
    class: 'btn btn-soft',
    type: 'button',
    onclick: close,
  }, 'Batal');
  const content = el('div', { class: 'destructive-dialog-content' });
  const firstStep = () => {
    const continueButton = el('button', {
      class: 'btn btn-danger-outline',
      type: 'button',
      onclick: () => {
        content.replaceChildren(secondStep());
        focusable()[0]?.focus();
      },
    }, 'Lanjutkan');
    return el(
      'div',
      { class: 'stack destructive-dialog-step' },
      el('p', {}, consequence),
      el('p', { class: 'error' },
        'Tindakan ini permanen dan tidak bisa dibatalkan.',
      ),
      el('div', { class: 'row destructive-dialog-actions' },
        cancel,
        continueButton,
      ),
    );
  };
  const secondStep = () => {
    const input = el('input', {
      class: 'destructive-dialog-input',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
      placeholder: 'Ketik kode di sini',
      'aria-label': 'Ketik ulang kode konfirmasi',
    });
    const confirm = el('button', {
      class: 'btn btn-danger-outline',
      type: 'submit',
      disabled: true,
    }, actionLabel);
    const form = el('form', {
      class: 'stack destructive-dialog-step',
      onsubmit: async (event) => {
        event.preventDefault();
        if (busy || input.value !== code) return;
        busy = true;
        confirm.disabled = true;
        cancel.disabled = true;
        input.disabled = true;
        confirm.textContent = 'Memproses…';
        error.hidden = true;
        try {
          const result = await onConfirm?.();
          if (result?.error) {
            error.textContent = result.error.message;
            error.hidden = false;
            busy = false;
            confirm.disabled = false;
            cancel.disabled = false;
            input.disabled = false;
            confirm.textContent = actionLabel;
            return;
          }
          busy = false;
          close();
        } catch (requestError) {
          error.textContent = requestError.message || 'Aksi gagal. Coba lagi.';
          error.hidden = false;
          busy = false;
          confirm.disabled = false;
          cancel.disabled = false;
          input.disabled = false;
          confirm.textContent = actionLabel;
        }
      },
    },
    el('p', {}, 'Ketik ulang kode ini untuk mengonfirmasi:'),
    el('strong', { class: 'destructive-dialog-code' }, code),
    input,
    error,
    el('div', { class: 'row destructive-dialog-actions' },
      cancel,
      confirm,
    ),
    );
    input.addEventListener('input', () => {
      const matches = input.value === code;
      confirm.disabled = !matches;
      if (input.value.length >= code.length && !matches) {
        error.textContent = 'Kode salah. Ketik ulang kode yang tampil di atas.';
        error.hidden = false;
      } else {
        error.hidden = true;
      }
    });
    return form;
  };
  content.append(firstStep());
  dialog.append(heading, content);
  backdrop.append(dialog);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKeydown);
  document.body.append(backdrop);
  queueMicrotask(() => focusable()[0]?.focus() || dialog.focus());
  return { close, node: backdrop, code };
};
