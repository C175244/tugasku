// Bagian jadwal harian di Beranda: mapel hari ini dan besok, per kelas.
// Catatan dari admin/owner/developer ditampilkan bila ada di jadwal.
import { el } from '../utils/dom.js';
import { DAY_NAMES } from '../utils/datetime.js';

const dayEntry = (schedules, day, label) => {
  const items = schedules.filter((s) => s.day_of_week === day);
  if (!items.length) return el('p', { class: 'muted small' }, `${label}: tidak ada jadwal.`);
  return el('div', { class: 'stack' },
    ...items.map((s) => el('div', { class: 'row space' },
      el('span', {}, `${s.subject} · ${formatTime(s.start_time)}–${formatTime(s.end_time)}`),
      el('span', { class: 'muted small' }, DAY_NAMES[s.day_of_week]),
    )));
};

const formatTime = (t) => (t || '').slice(0, 5);

// public-list rundown hari ini (0=Min) dan besoknya, dari semua jadwal
// kelas yang dikumpulkan di store.
export const dailySchedule = (dayIndex, schedules, label) => {
  const today = new Date();
  const day = dayIndex === 'today' ? today.getDay() : today.getDay() === 0 ? 6 : today.getDay() - 1;
  const koName = dayIndex === 'today' ? 'Hari ini' : dayIndex === 'tomorrow' ? 'Besok' : label;
  const items = (schedules || []).filter((s) => s.day === day);
  if (!items.length && label !== 'Besok') return null;
  return el('div', {},
    el('p', { class: 'muted small' }, koName),
    items.length
      ? el('div', { class: 'stack' },
        ...items.map((s) => el('div', {
          class: 'row space',
          style: 'padding:4px 0',
        },
        el('span', {}, s.subject),
        s.note && el('span', { class: 'badge' }, 'Catatan'),
        el('span', { class: 'muted small' }, `${(s.start_time || '').slice(0, 5)}–${(s.end_time || '').slice(0, 5)}`),
        )))
      : el('p', { class: 'muted small' }, '(tidak ada jadwal)'));
};

// Bagian lengkap di Beranda: judul + hari ini + besok + catatan (bila ada
// kolom note dari jadwal admin).
export const dailySchedulePanel = (schedules) => {
  const today = new Date();
  const dayToday = today.getDay();
  const dayTomorrow = (dayToday + 1) % 7;
  return el('section', { class: 'panel glass stack' },
    el('p', { class: 'eyebrow' }, 'Jadwal'),
    el('div', { class: 'row space' },
      el('h2', {}, 'Hari ini'),
      el('span', { class: 'muted small' }, DAY_NAMES[dayToday]),
    ),
    dayEntry(schedules, dayToday, 'Hari ini'),
    el('div', { class: 'row space' },
      el('h2', {}, 'Besok'),
      el('span', { class: 'muted small' }, DAY_NAMES[dayTomorrow]),
    ),
    dayEntry(schedules, dayTomorrow, 'Besok'),
  );
};

// Hanya catatan tampil untuk jadwal admin (kolom ada bila RPC sudah dipatch).
export const dailyNote = (schedule) => !schedule.note ? null : el('p', {
  class: 'muted small',
}, `Catatan: ${schedule.note}`);
