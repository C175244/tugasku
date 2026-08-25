// Daftar sesi login (perangkat) milik pengguna sendiri.
import { getSupabase } from '../supabaseClient.js';

// Semua sesi aktif: kapan login, dari perangkat apa (user agent), IP, dan
// apakah sesi itu perangkat yang sedang dipakai sekarang.
export const listLoginSessions = () => getSupabase().rpc('my_login_sessions');

// Keluar dari sesi/perangkat lain — perangkat itu harus masuk ulang.
export const endLoginSession = (sessionId) => getSupabase().rpc(
  'end_login_session',
  { p_session_id: sessionId },
);
