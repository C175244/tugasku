// Konfigurasi Supabase dari placeholder file atau localStorage pengguna.
import { STORAGE_KEYS } from './utils/storageKeys.js';

/*
  CONFIG CONTOH (untuk edit lewat GitHub dari HP):
  1. Buka assets/js/config.js di GitHub, tekan ikon pensil.
  2. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di bawah, tanpa menghapus tanda kutip.
  3. Tekan Commit changes. Jangan pernah menaruh service_role key di sini.
  Kamu juga bisa memasukkan nilai ini lewat halaman Setup aplikasi.
*/
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const getConfig = () => ({
  url: localStorage.getItem(STORAGE_KEYS.url) || SUPABASE_URL,
  anonKey: localStorage.getItem(STORAGE_KEYS.anonKey) || SUPABASE_ANON_KEY,
});

export const saveConfig = (url, anonKey) => {
  localStorage.setItem(STORAGE_KEYS.url, url.trim());
  localStorage.setItem(STORAGE_KEYS.anonKey, anonKey.trim());
};
