// Konfigurasi Supabase dari placeholder file atau localStorage pengguna.
import { STORAGE_KEYS } from './utils/storageKeys.js';

/*
  CONFIG CONTOH (untuk edit lewat GitHub dari HP):
  1. Buka assets/js/config.js di GitHub, tekan ikon pensil.
  2. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di bawah, tanpa menghapus tanda kutip.
  3. Tekan Commit changes. Jangan pernah menaruh service_role key di sini.
  Kamu juga bisa memasukkan nilai ini lewat halaman Setup aplikasi.
*/
export const SUPABASE_URL = 'https://zvzghjvavnmriqljzizp.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2emdoanZhdm5tcmlxbGp6aXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0ODc5MzQsImV4cCI6MjEwMzA2MzkzNH0.W3teRZF9zcDM1ThrJDMLOmvsh-YotcXUyLxfg6TVY-I';

// Site key Cloudflare Turnstile (captcha). Nilai di bawah adalah kunci uji
// resmi Cloudflare yang selalu lolos — ganti dengan site key asli dari
// https://dash.cloudflare.com/?to=/:account/turnstile untuk produksi
// (isi kedua variabel dengan site key asli yang sama).
// Kosongkan untuk mematikan verifikasi bukan robot (mode pengembangan).
export const TURNSTILE_SITE_KEY = '1x00000000000000000000AA'; // widget tampak
export const TURNSTILE_INVISIBLE_SITE_KEY = '1x00000000000000000000BB'; // widget tak kasat mata

export const getConfig = () => ({
  url: localStorage.getItem(STORAGE_KEYS.url) || SUPABASE_URL,
  anonKey: localStorage.getItem(STORAGE_KEYS.anonKey) || SUPABASE_ANON_KEY,
  turnstileSiteKey: TURNSTILE_SITE_KEY,
  turnstileInvisibleSiteKey: TURNSTILE_INVISIBLE_SITE_KEY || TURNSTILE_SITE_KEY,
});

export const saveConfig = (url, anonKey) => {
  localStorage.setItem(STORAGE_KEYS.url, url.trim());
  localStorage.setItem(STORAGE_KEYS.anonKey, anonKey.trim());
};
