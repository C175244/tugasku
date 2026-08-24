// Widget Cloudflare Turnstile (captcha anti-bot), dimuat malas saat dibutuhkan.
import { getConfig } from '../config.js';

let loaderPromise = null;

export const turnstileSiteKey = () => getConfig().turnstileSiteKey;

export const turnstileAvailable = () => Boolean(turnstileSiteKey());

const loadScript = () => {
  if (window.turnstile) return Promise.resolve();
  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Gagal memuat verifikasi anti-bot.'));
      document.head.append(script);
    });
  }
  return loaderPromise;
};

// Merender widget ke dalam container. onToken dipanggil dengan token saat
// pengguna lolos, dan null saat token kedaluwarsa. Mengembalikan widget id.
export const mountTurnstile = async (container, onToken) => {
  if (!turnstileAvailable()) return null;
  await loadScript();
  return window.turnstile.render(container, {
    sitekey: turnstileSiteKey(),
    callback: (token) => onToken(token),
    'expired-callback': () => onToken(null),
    'error-callback': () => onToken(null),
  });
};

export const resetTurnstile = (widgetId) => {
  if (widgetId != null && window.turnstile) window.turnstile.reset(widgetId);
};
