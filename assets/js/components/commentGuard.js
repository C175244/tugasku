// Penjaga form komentar: memunculkan verifikasi bukan robot hanya saat
// aktivitas komentar pengguna terdeteksi tidak wajar.
import { el } from '../utils/dom.js';
import { toast } from './toast.js';
import {
  mountTurnstile,
  resetTurnstile,
  turnstileAvailable,
} from './turnstile.js';
import {
  isCommentActivitySuspicious,
  trackCommentSent,
} from '../utils/antiSpam.js';

// Panjang maksimal satu komentar (sesuai constraint database). Komentar yang
// lebih panjang harus dikirim pengguna dalam beberapa komentar terpisah.
export const COMMENT_MAX_LENGTH = 120;

// Textarea komentar dengan batas karakter dan penghitung sisa.
export const commentField = (placeholder) => {
  const input = el('textarea', {
    rows: '2',
    placeholder,
    maxlength: String(COMMENT_MAX_LENGTH),
  });
  const counter = el('p', { class: 'muted small' }, `${COMMENT_MAX_LENGTH} karakter tersisa`);
  input.addEventListener('input', () => {
    const left = COMMENT_MAX_LENGTH - input.value.length;
    counter.textContent = left > 0
      ? `${left} karakter tersisa`
      : 'Batas 120 karakter tercapai — kirim sisanya di komentar berikutnya';
  });
  return { input, counter };
};

export const commentGuard = () => {
  let token = null;
  let widgetId = null;
  let mounting = false;
  const container = el('div', { class: 'captcha-box', hidden: true });

  const ensureMounted = async () => {
    if (mounting || widgetId != null || !turnstileAvailable()) return;
    mounting = true;
    container.replaceChildren(el('p', { class: 'muted small' },
      'Aktivitas tidak biasa terdeteksi. Verifikasi bahwa kamu bukan robot untuk melanjutkan.'));
    container.hidden = false;
    try {
      widgetId = await mountTurnstile(container, (value) => { token = value; });
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      mounting = false;
    }
  };

  if (isCommentActivitySuspicious()) ensureMounted();

  return {
    node: container,
    // true bila komentar boleh dikirim
    beforeSend: async () => {
      if (!isCommentActivitySuspicious() || !turnstileAvailable()) return true;
      await ensureMounted();
      if (!token) {
        toast('Selesaikan dulu verifikasi bukan robot.', 'error');
        return false;
      }
      return true;
    },
    onSent: () => {
      trackCommentSent();
      if (widgetId != null) {
        token = null;
        resetTurnstile(widgetId);
      }
      if (isCommentActivitySuspicious()) ensureMounted();
    },
  };
};
