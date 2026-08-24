// Header aplikasi: navigasi kembali, nama halaman, tema, dan keluar.
import { el } from '../utils/dom.js';
import { toggleTheme, getTheme } from '../theme.js';
import { signOut } from '../api/auth.js';
import { toast } from './toast.js';
import { icon as svgIcon } from './icons.js';

const smallIcon = (name) => {
  if (name === 'back') {
    return el('span', {
      'aria-hidden': 'true',
      style: 'font-size:2rem;line-height:.7',
    }, '‹');
  }
  return svgIcon(name);
};

export const header = ({ title = 'TugasKu', back = false, onBack } = {}) => {
  const themeButton = el('button', {
    class: 'btn btn-soft icon-btn',
    type: 'button',
    'aria-label': 'Ganti tema',
    onclick: () => {
      toggleTheme();
      themeButton.replaceChildren(
        smallIcon(getTheme() === 'dark' ? 'sun' : 'moon'),
      );
    },
  }, smallIcon(getTheme() === 'dark' ? 'sun' : 'moon'));
  const controls = el('div', { class: 'row' }, themeButton);
  if (back) {
    controls.prepend(el('button', {
      class: 'btn btn-soft icon-btn',
      type: 'button',
      'aria-label': 'Kembali',
      onclick: onBack,
    }, smallIcon('back')));
  }
  return el(
    'div',
    { class: 'page-chrome' },
    el(
      'header',
      { class: 'topbar' },
      el('a', { class: 'brand', href: '#/dashboard' },
        el('span', { class: 'brand-mark' }, '✓'),
        el('span', {}, title),
      ),
      el(
        'nav',
        { class: 'desktop-nav', 'aria-label': 'Navigasi utama' },
        el('a', { href: '#/dashboard' }, 'Beranda'),
        el('a', { href: '#/kelas' }, 'Kelas'),
        el('a', { href: '#/riwayat' }, 'Riwayat'),
        el('a', { href: '#/pengumuman' }, 'Pengumuman'),
        el('a', { href: '#/profil' }, 'Profil'),
      ),
      controls,
    ),
    el('div', { class: 'context-strip' }, title),
  );
};

export const profileMenu = (profile) => el(
  'div',
  { class: 'row space glass panel feature-panel' },
  el('div', { class: 'row' },
    el('div', { class: 'avatar' },
      (profile?.username || 'B').charAt(0).toUpperCase(),
    ),
    el('div', {},
      el('strong', {}, profile?.full_name || profile?.username || 'Teman'),
      el('div', { class: 'muted small' }, `@${profile?.username || 'teman'}`),
    ),
  ),
  el('button', {
    class: 'btn btn-soft',
    type: 'button',
    onclick: async () => {
      await signOut();
      toast('Kamu sudah keluar.');
      location.hash = '#/auth/signin';
    },
  }, 'Keluar'),
);
