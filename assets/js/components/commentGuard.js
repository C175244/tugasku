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
