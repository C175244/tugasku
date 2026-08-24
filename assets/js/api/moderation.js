// Status blokir global untuk pengguna yang sedang login.
import { getSupabase } from '../supabaseClient.js';

export const myBanStatus = async () => {
  const result = await getSupabase().rpc('my_ban_status');
  return { ...result, data: result.data?.[0] || null };
};
