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

// Mengirim email reset password. Isi emailnya link (template bawaan Supabase
// tidak bisa diubah di paket gratis); link itu membuka kembali halaman yang
// meminta (redirectTo) dengan sesi recovery, lalu aplikasi menampilkan
// halaman pasang password baru.
export const requestPasswordReset = (email, captchaToken = null) => getSupabase().auth.resetPasswordForEmail(
  email,
  {
    redirectTo: `${location.origin}${location.pathname}`,
    ...(captchaToken ? { captchaToken } : {}),
  },
);

// Meminta kode reautentikasi ke email pengguna yang sedang masuk. Email ini
// bawaannya hanya berisi kode (tanpa link), dan wajib sebelum updateUser
// password karena reauthentication aktif di proyek.
export const reauthenticate = () => getSupabase().auth.reauthenticate();

// Memverifikasi kode reautentikasi (memakai sesi aktif, tanpa perlu email).
export const verifyReauthOtp = (token) => getSupabase().auth.verifyOtp({
  token,
  type: 'reauthentication',
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
