// API autentikasi: Google, password, magic link, dan sesi pengguna.
import { getSupabase } from '../supabaseClient.js';

export const getSession = async () => {
  const result = await getSupabase()?.auth.getSession();
  return result?.data?.session || null;
};

// Ambil data user TERBARU dari server (lebih segar daripada cache session).
// Diperlukan untuk membaca daftar identities tepat setelah tautan Google /
// pasang password.
export const getUser = async () => {
  const result = await getSupabase()?.auth.getUser();
  return result?.data?.user || null;
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

// Verifikasi kepemilikan akun lewat Google sebagai alternatif kode email.
// Menggunakan REDIRECT PENUH (bukan popup), jadi tahan di Android/browser
// yang memblokir popup. Sebelum berangkat dibuatkan flag di sessionStorage;
// begitu kembali, checkGoogleVerify() mengambil hasilnya.
export const startGoogleVerify = (expectedEmail, purpose, extra = {}) => {
  sessionStorage.setItem('tugasku.googleVerify', JSON.stringify({
    email: expectedEmail,
    purpose,
    extra,
    ts: Date.now(),
  }));
  return signInGoogle();
};

// true bila sesi saat ini ter-verifikasi lewat flag di atas dan emailnya
// cocok; flag langsung dibersihkan (sekali pakai).
export const checkGoogleVerify = (expectedEmail) => {
  const raw = sessionStorage.getItem('tugasku.googleVerify');
  if (!raw) return null;
  try {
    const flag = JSON.parse(raw);
    if (flag.email?.toLowerCase() === expectedEmail?.toLowerCase()) {
      sessionStorage.removeItem('tugasku.googleVerify');
      return flag;
    }
  } catch { /* abaikan */ }
  return null;
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

// Mengirim email reset password. Wajib menyertakan redirectTo ke halaman
// yang memanggil (dengan pathname lengkap seperti /tugasku/index.html),
// karena bila tidak diset, Supabase memakai "site URL" — di perangkat lama
// itu bisa ter-resolve tanpa path sehingga GitHub Pages menampilkan 404.
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

// Memasang password baru sekaligus memverifikasi kode reautentikasi.
// PENTING: kode diverifikasi lewat field `nonce` pada updateUser (PUT /user)
// — BUKAN lewat verifyOtp. Di server, verifyOtp tidak mengenali tipe
// 'reauthentication' dan selalu menjawab "Token has expired or is invalid"
// walau kodenya benar.
export const updatePasswordWithNonce = (password, nonce) => getSupabase().auth.updateUser({
  password,
  nonce,
});

export const updatePassword = (password) => getSupabase().auth.updateUser({ password });

// true bila akun punya cara masuk email+password. Deteksi dua lapis: (1)
// identity "email" di daftar identities — kadang belum terisi tepat setelah
// password dipasang — dan (2) penanda lokal yang disimpan begitu password
// benar-benar berhasil terpasang di perangkat ini.
export const hasPasswordIdentity = (user) => Boolean(
  user?.identities?.some((identity) => identity.provider === 'email'),
);

export const signOut = () => getSupabase().auth.signOut();

export const onAuthChange = (callback) => (
  getSupabase()?.auth.onAuthStateChange(callback)
);
