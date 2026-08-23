// API profil pengguna saat ini.
import { getSupabase } from '../supabaseClient.js';

export const getProfile = async () => {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const updateProfile = (values) => getSupabase()
  .from('profiles')
  .update(values)
  .select()
  .single();
