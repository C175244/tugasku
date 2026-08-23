// Komponen indikator saat data sedang dimuat.
import { el } from '../utils/dom.js';

export const loader = (message = 'Memuat...') => el(
  'div',
  { class: 'loader' },
  el('span', { class: 'spinner', 'aria-label': message }),
  el('span', { class: 'small' }, message),
);
