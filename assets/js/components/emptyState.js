// Tampilan yang dipakai saat daftar data masih kosong.
import { el } from '../utils/dom.js';

export const emptyState = (title, detail = '') => el(
  'div',
  { class: 'empty glass panel feature-panel' },
  el('div', { class: 'eyebrow' }, 'Belum ada'),
  el('h3', {}, title),
  detail && el('p', { class: 'muted' }, detail),
);
