// Menampilkan pesan singkat di bagian bawah layar.
import { el } from '../utils/dom.js';

export const toast = (message, type = 'info') => {
  document.querySelector('.toast')?.remove();
  const node = el(
    'div',
    {
      class: `toast ${type === 'error' ? 'error' : ''}`,
      role: 'status',
    },
    message,
  );
  document.body.append(node);
  setTimeout(() => node.remove(), 3200);
};
