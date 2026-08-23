// Fungsi waktu, termasuk deadline pelajaran berikutnya secara deterministik.
export const DAY_NAMES = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const timeParts = (value) => {
  const [hours = 0, minutes = 0, seconds = 0] = String(value)
    .split(':')
    .map(Number);
  return { hours, minutes, seconds };
};

/**
 * Mengembalikan kejadian jadwal berikutnya, strictly after `now`.
 * dayOfWeek mengikuti JavaScript: Minggu=0 sampai Sabtu=6.
 */
export const nextOccurrence = (nowInput, dayOfWeek, startTime) => {
  const now = new Date(nowInput);
  if (Number.isNaN(now.getTime())) {
    throw new Error('Waktu sekarang tidak valid');
  }
  const { hours, minutes, seconds } = timeParts(startTime);
  const candidate = new Date(now);
  const dayDelta = (Number(dayOfWeek) - now.getDay() + 7) % 7;
  candidate.setDate(now.getDate() + dayDelta);
  candidate.setHours(hours, minutes, seconds, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate;
};

export const toLocalInput = (value) => {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T');
};

export const relativeTime = (value) => {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return 'baru saja';
  if (Math.abs(minutes) < 60) return `${Math.abs(minutes)} menit yang lalu`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${Math.abs(hours)} jam yang lalu`;
  return `${Math.round(hours / 24)} hari yang lalu`;
};

export const formatDeadline = (value) => new Intl.DateTimeFormat(
  'id-ID',
  { dateStyle: 'medium', timeStyle: 'short' },
).format(new Date(value));
