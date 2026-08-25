// API profil pengguna saat ini.
import { getSupabase } from '../supabaseClient.js';

// true bila username boleh dipakai: belum ada yang memakai dan beda minimal
// 3 karakter (tidak peka huruf besar/kecil) dari semua username yang ada.
export const usernameAvailable = (username) => getSupabase()
  .rpc('username_available', { p_username: username });

export const getProfile = async () => {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const updateProfile = async (userId, values) => {
  const result = await getSupabase()
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select()
    .maybeSingle();
  if (
    result.error?.code === '23505'
    && (
      result.error.constraint === 'profiles_username_key'
      || result.error.message?.includes('profiles_username_key')
    )
  ) {
    return {
      ...result,
      error: {
        ...result.error,
        message: 'Username sudah dipakai, coba yang lain.',
      },
    };
  }
  return result;
};
