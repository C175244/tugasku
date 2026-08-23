// Filter dan urutan beranda yang disimpan di localStorage.
import { el } from '../utils/dom.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

const defaults = {
  classId: 'all',
  subject: 'all',
  type: 'all',
  status: 'all',
  sort: 'deadlineSoon',
};

export const filterBar = (options = {}, onChange) => {
  const saved = {
    ...defaults,
    ...(JSON.parse(localStorage.getItem(STORAGE_KEYS.filters) || 'null') || {}),
  };
  const wrap = el('div', { class: 'grid grid-2 glass panel' });
  const add = (label, key, choices) => {
    const select = el(
      'select',
      {
        onchange: () => {
          saved[key] = select.value;
          localStorage.setItem(
            STORAGE_KEYS.filters,
            JSON.stringify(saved),
          );
          onChange(saved);
        },
      },
      ...choices.map(([value, text]) => el(
        'option',
        { value, selected: String(saved[key]) === value },
        text,
      )),
    );
    wrap.append(el(
      'div',
      { class: 'field' },
      el('label', {}, label),
      select,
    ));
  };
  add('Kelas', 'classId', [
    ['all', 'Semua kelas'],
    ...(options.classes || []).map((item) => [item.id, item.name]),
  ]);
  add('Mapel', 'subject', [
    ['all', 'Semua mapel'],
    ...(options.subjects || []).map((subject) => [subject, subject]),
  ]);
  add('Tipe tugas', 'type', [
    ['all', 'Semua tipe'],
    ...['tugas', 'pr', 'ulangan', 'praktik', 'proyek', 'presentasi', 'catatan', 'lainnya']
      .map((type) => [type, type]),
  ]);
  add('Status', 'status', [
    ['all', 'Semua status'],
    ['pending', 'Belum dikerjakan'],
    ['done', 'Sudah dikerjakan'],
  ]);
  add('Urutkan', 'sort', [
    ['deadlineSoon', 'Deadline terdekat'],
    ['deadlineLate', 'Deadline terlama'],
    ['newest', 'Baru ditambahkan'],
    ['easy', 'Mudah → sulit'],
    ['hard', 'Sulit → mudah'],
    ['priority', 'Prioritas'],
  ]);
  return wrap;
};
