// Pengumuman dari developer: popup untuk pesan terbaru dan halaman riwayat.
import { el } from '../utils/dom.js';
import { header } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { openModal } from '../components/modal.js';
import { listAnnouncements } from '../api/announcements.js';
import { formatDeadline } from '../utils/datetime.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

export const announcementCard = (item) => el(
  'article',
  { class: 'panel glass stack' },
  el('p', { class: 'muted small' }, formatDeadline(item.created_at)),
  el('p', { style: 'white-space:pre-wrap;margin:0' }, item.body),
);

// Tampilkan popup sekali per pengumuman terbaru; bisa dibaca ulang di
// halaman #/pengumuman.
export const showLatestAnnouncement = async () => {
  const result = await listAnnouncements();
  if (result.error || !result.data?.length) return;
  const latest = result.data[0];
  const lastSeen = Number(localStorage.getItem(STORAGE_KEYS.announcementSeen) || 0);
  if (latest.id <= lastSeen) return;
  localStorage.setItem(STORAGE_KEYS.announcementSeen, String(latest.id));
  openModal(
    'Pengumuman',
    el('div', { class: 'stack' },
      el('p', { class: 'muted small' }, formatDeadline(latest.created_at)),
      el('p', { style: 'white-space:pre-wrap;margin:0' }, latest.body),
      el('a', { href: '#/pengumuman' }, 'Lihat semua pengumuman'),
    ),
  );
};

export const announcementView = ({ announcements = [] }) => el(
  'main',
  { class: 'shell' },
  header({
    title: 'Pengumuman',
    back: true,
    onBack: () => { location.hash = '#/dashboard'; },
  }),
  el('section', { class: 'panel glass' },
    el('h1', {}, 'Pengumuman'),
    el('p', { class: 'muted' }, 'Pesan dari developer untuk semua pengguna.'),
  ),
  announcements.length
    ? el('section', { class: 'stack' }, ...announcements.map(announcementCard))
    : el('section', { class: 'panel glass' },
      el('p', { class: 'muted' }, 'Belum ada pengumuman.')),
  bottomNav('pengumuman'),
);
