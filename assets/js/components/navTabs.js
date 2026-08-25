// Navigasi utama di bagian bawah layar ponsel.
import { el } from '../utils/dom.js';
import { icon } from './icons.js';

const items = [
  ['dashboard', 'Beranda', 'home'],
  ['kelas', 'Kelas', 'class'],
  ['riwayat', 'Riwayat', 'history'],
  ['profil', 'Profil', 'user'],
];

export const bottomNav = (active) => el(
  'nav',
  { class: 'bottom-nav', 'aria-label': 'Navigasi utama' },
  ...items.map(([route, label, name]) => el(
    'a',
    {
      class: `nav-item ${active === route ? 'active' : ''}`,
      href: `#/${route}`,
      'data-nav': route,
    },
    icon(name),
    el('span', {}, label),
  )),
);
