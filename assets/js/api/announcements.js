// Pengumuman: developer mengirim pesan; yang di-pin muncul juga untuk
// pengguna baru (bila kena joined-at setelahnya non-pinned disaring).
import { getSupabase } from '../supabaseClient.js';

// 50 pengumuman terakhir untuk halaman riwayat.
export const listAnnouncements = () => getSupabase()
  .from('announcements')
  .select('id, body, created_at, pinned')
  .order('created_at', { ascending: false })
  .limit(50);

export const sendAnnouncement = (message, pinned = false) => getSupabase()
  .rpc('send_announcement', { message, pinned });

export const pinAnnouncement = (id, pinned) => getSupabase()
  .rpc('pin_announcement', { p_id: id, p_pinned: pinned });

export const myJoinedAt = () => getSupabase().rpc('my_joined_at');
