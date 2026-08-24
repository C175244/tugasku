// Pengumuman: developer mengirim pesan yang dibaca semua pengguna.
import { getSupabase } from '../supabaseClient.js';

// 50 pengumuman terakhir untuk halaman riwayat.
export const listAnnouncements = () => getSupabase()
  .from('announcements')
  .select('id, body, created_at')
  .order('created_at', { ascending: false })
  .limit(50);

export const sendAnnouncement = (message) => getSupabase()
  .rpc('send_announcement', { message });
