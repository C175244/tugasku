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

export const signUp = (email, password, username, captchaToken = null) => getSupabase().auth.signUp({
  email,
  password,
  options: {
    data: { username },
    ...(captchaToken ? { captchaToken } : {}),
  },
});

export const signIn = (email, password, captchaToken = null) => getSupabase().auth.signInWithPassword({
  email,
  password,
  options: captchaToken ? { captchaToken } : {},
});

export const sendMagicLink = (email, captchaToken = null) => getSupabase().auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${location.origin}${location.pathname}`,
    ...(captchaToken ? { captchaToken } : {}),
  },
});

// Mengirim kode reset password ke email (Supabase mengirim OTP lewat email
// recovery). Berlaku untuk pengguna yang lupa password maupun akun login
// Google yang belum punya password.
export const requestPasswordReset = (email, captchaToken = null) => getSupabase().auth.resetPasswordForEmail(
  email,
  captchaToken ? { captchaToken } : {},
);

// Memverifikasi kode dari email dan membuka sesi agar password bisa diganti.
export const verifyRecoveryOtp = (email, token) => getSupabase().auth.verifyOtp({
  email,
  token,
  type: 'recovery',
});

export const updatePassword = (password) => getSupabase().auth.updateUser({ password });

// true bila akun belum punya password (misalnya daftar lewat Google saja).
export const hasPasswordIdentity = (user) => Boolean(
  user?.identities?.some((identity) => identity.provider === 'email'),
);

export const signOut = () => getSupabase().auth.signOut();

export const onAuthChange = (callback) => (
  getSupabase()?.auth.onAuthStateChange(callback)
);
