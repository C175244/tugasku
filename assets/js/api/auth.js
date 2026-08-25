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

// Versi Google sign-in yang membuka POPUP (bukan mengalihkan halaman), supaya
// bisa dipakai sebagai alternatif verifikasi di tengah alur (misalnya lupa
// password / pasang password) tanpa menutup formulirnya.
// onSignedIn(session) dipanggil begitu popup selesai dan sesi didapat.
export const signInGooglePopup = (onSignedIn) => {
  const supabase = getSupabase();
  let settled = false;
  const finish = (session) => {
    if (settled) return;
    settled = true;
    sub.data.subscription.unsubscribe();
    window.removeEventListener('message', onMessage);
    pollTimer && clearInterval(pollTimer);
    onSignedIn(session);
  };
  // Dengarkan perubahan sesi (popup membawa sesi baru ke halaman kita).
  const sub = supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
      finish(session);
    }
  });
  // Fallback: pesan dari popup bila event tidak terdengar.
  const onMessage = (event) => {
    if (event.origin !== location.origin) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) finish(data.session);
    });
  };
  window.addEventListener('message', onMessage);
  const pollTimer = setInterval(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) finish(data.session);
    });
  }, 1500);
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${location.origin}${location.pathname}`,
      skipBrowserRedirect: true,
    },
  }).then(({ data, error }) => {
    if (error) { onSignedIn(null); return; }
    window.open(data.url, 'tugasku-google', 'width=520,height=640');
  });
  return sub;
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
