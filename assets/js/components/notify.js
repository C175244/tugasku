// Push notifikasi browser (Permission API): simpan preferensi per pengguna
// (global); berfungsi walau halaman ditutup (as git).
import { el } from '../utils/dom.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

export const notifSupported = () => 'Notification' in window;

export const notifPermission = () => (notifSupported() ? Notification.permission : 'denied');

// Meminta izin dan mengembalikan true bila diizinkan.
export const askNotifPermission = async () => {
  if (!notifSupported()) return false;
  if (notifPermission() === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

export const notifOn = (userId) => localStorage.getItem(
  STORAGE_KEYS.notif(userId),
) !== 'off';

export const setNotifOn = (userId, on) => localStorage.setItem(
  STORAGE_KEYS.notif(userId),
  on ? 'on' : 'off',
);

// Kirim notifikasi browser; mengembalikan false bila tidak bisa.
export const showNotif = (title, options = {}) => {
  if (!notifSupported() || notifPermission() !== 'granted') return false;
  try {
    new Notification(title, { icon: '/tugasku/favicon.svg', ...options });
    return true;
  } catch {
    return false;
  }
};

// Pemicuan tersisa waktu <12 jam dan belum dikerjakan (sekali per tugas).
const nagDeadlineOriginal = (task, userId) => {
  const lastKey = `${STORAGE_KEYS.notif(userId)}:last-${task.id}`;
  if (new Date(task.deadline_at) - Date.now() <= 12 * 3600 * 1000
      && new Date(task.deadline_at) > new Date()
      && localStorage.getItem(lastKey) !== 'done') {
    if (showNotif(`Sisa <12 jam: ${task.title}`, {
      body: `Deadline ${new Date(task.deadline_at).toLocaleString('id-ID')}. Segera dikerjakan!`,
    })) {
      // Tandai sudah dinotif supaya tidak spam tiap reload.
      localStorage.setItem(lastKey, 'done');
    }
  }
};

// Versi dengan progres: lewati bila sudah selesai.
export const nagDeadline = (task, userId, progress) => {
  if (progress !== 'done') nagDeadlineOriginal(task, userId);
};

// Notif tugas baru (dipanggil saat realtime atau di dashboard).
export const notifyNewTask = (task, userId) => {
  const key = `${STORAGE_KEYS.notif(userId)}:seen-${task.id}`;
  if (localStorage.getItem(key)) return;
  if (showNotif(`Tugas baru: ${task.title}`, {
    body: `${task.subject || 'Tugas baru'} · Deadline ${new Date(task.deadline_at).toLocaleString('id-ID')}`,
  })) {
    localStorage.setItem(key, 'true');
  }
};
