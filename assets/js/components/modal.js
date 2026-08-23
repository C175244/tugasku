// Dialog kecil yang bisa ditutup dengan tombol atau klik latar.
import { el } from '../utils/dom.js';

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
