// Menampilkan pesan singkat di bagian bawah layar.
import { el } from '../utils/dom.js';

export const toast = (message, type = 'info') => {
  document.querySelector('.toast')?.remove();
  const node = el('div', { class: 'toast', role: 'status' }, message);
  if (type === 'error') node.style.background = 'var(--red)';
  document.body.append(node);
  setTimeout(() => node.remove(), 3200);
};
