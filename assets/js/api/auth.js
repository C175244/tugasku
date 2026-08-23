// API autentikasi: Google, password, magic link, dan sesi pengguna.
import { getSupabase } from '../supabaseClient.js';

export const getSession = async () => {
  const result = await getSupabase()?.auth.getSession();
  return result?.data?.session || null;
};

export const signInGoogle = async () => {
  const supabase = getSupabase();
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${location.origin}${location.pathname}`,
    },
  });
};

export const signUp = (email, password, username) => getSupabase().auth.signUp({
  email,
  password,
  options: { data: { username } },
});

export const signIn = (email, password) => getSupabase().auth.signInWithPassword({
  email,
  password,
});

export const sendMagicLink = (email) => getSupabase().auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${location.origin}${location.pathname}` },
});

export const signOut = () => getSupabase().auth.signOut();

export const onAuthChange = (callback) => (
  getSupabase()?.auth.onAuthStateChange(callback)
);
