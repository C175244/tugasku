// Membuat satu Supabase client dari konfigurasi aktif.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getConfig } from './config.js';

let client;

// Saat masuk lewat link recovery/konfirmasi dari email, Supabase mengirim
// kode di query string (?code=...). GitHub Pages kadang menghapus query saat
// memuat ulang, jadi kita baca secepat mungkin sebelum router jalan, lalu
// bersihkan URL. Ini menghindari halaman 404/kode hilang setelah refresh.
const stripAuthParams = () => {
  try {
    const url = new URL(location.href);
    const authParams = ['code', 'error_code', 'error', 'error_description', 'message_code'];
    const hasAny = authParams.some((k) => url.searchParams.has(k));
    if (hasAny) {
      for (const k of authParams) url.searchParams.delete(k);
      history.replaceState(null, '', url.pathname + url.hash + url.search);
    }
  } catch { /* abaikan */ }
};
stripAuthParams();

export const getSupabase = () => {
  const config = getConfig();
  if (!config.url || !config.anonKey) return null;
  if (!client || client.supabaseUrl !== config.url) {
    client = createClient(config.url, config.anonKey);
  }
  return client;
};
