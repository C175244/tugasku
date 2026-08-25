// Pengumuman dari developer: popup untuk pesan yang belum dibaca,
// termasuk pesan pinned yang tetap muncul untuk pengguna baru.
import { el } from '../utils/dom.js';
import { header } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { openModal } from '../components/modal.js';
import { listAnnouncements, myJoinedAt } from '../api/announcements.js';
import { formatDeadline } from '../utils/datetime.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

export const announcementCard = (item) => el(
  'article',
  { class: 'panel glass stack' },
  el('div', { class: 'row space' },
    el('p', { class: 'muted small' }, formatDeadline(item.created_at)),
    item.pinned && el('span', { class: 'badge' }, 'Di-pin'),
  ),
  el('p', { style: 'white-space:pre-wrap;margin:0' }, item.body),
);

// Ambil joinedAt user dari profil (saat akun dibuat).
const getJoinedAt = async (profile) => {
  try {
    const result = await myJoinedAt();
    return result.data?.[0]?.joined_at || profile?.created_at || null;
  } catch { return profile?.created_at || null; }
};

// Tampilkan popup sekali per pengumuman (pinned atau setelah joinedAt).
export const showLatestAnnouncement = async (profile) => {
  const result = await listAnnouncements();
  if (result.error || !result.data?.length) return;
  const joinedAt = await getJoinedAt(profile);
  const joinedMs = joinedAt ? new Date(joinedAt).getTime() : 0;
  const eligible = result.data.filter(
    (item) => item.pinned || new Date(item.created_at).getTime() > joinedMs,
  );
  if (!eligible.length) return;
  const latest = eligible[0];
  const seenKey = `${STORAGE_KEYS.announcementSeen}:${profile?.id || 'main'}`;
  const lastSeen = Number(localStorage.getItem(seenKey) || 0);
  if (latest.id <= lastSeen) return;
  localStorage.setItem(seenKey, String(latest.id));
  try {
    openModal(
      'Pengumuman',
      el('div', { class: 'stack' },
        el('p', { class: 'muted small' }, formatDeadline(latest.created_at)),
        el('p', { style: 'white-space:pre-wrap;margin:0' }, latest.body),
        el('a', { href: '#/pengumuman' }, 'Lihat semua pengumuman'),
      ),
    );
  } catch (err) {
    // Bila modal gagal dibuat (mis. hampagne cloud palsu), jangan blok:
    // dianggap sudah dibaca di halaman pengumuman.
    console.warn('Popup pengumuman tidak bisa ditampilkan:', err);
  }
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
