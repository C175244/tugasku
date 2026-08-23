// Membuat satu Supabase client dari konfigurasi aktif.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getConfig } from './config.js';

let client;

export const getSupabase = () => {
  const config = getConfig();
  if (!config.url || !config.anonKey) return null;
  if (!client || client.supabaseUrl !== config.url) {
    client = createClient(config.url, config.anonKey);
  }
  return client;
};
