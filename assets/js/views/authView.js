// Halaman masuk dan daftar akun TugasKu.
import { el } from '../utils/dom.js';
import {
  signIn,
  signUp,
  signInGoogle,
  startGoogleVerify,
  checkGoogleVerify,
  sendMagicLink,
  requestPasswordReset,
  updatePassword,
  hasPasswordIdentity,
} from '../api/auth.js';
import { usernameAvailable } from '../api/profile.js';
import { getSupabase } from '../supabaseClient.js';
import { toast } from '../components/toast.js';
import {
  invisibleCaptcha,
  mountTurnstile,
  resetTurnstile,
  turnstileAvailable,
} from '../components/turnstile.js';
import { toggleTheme, getTheme } from '../theme.js';
import { icon } from '../components/icons.js';

// render dipanggil ulang (di main.js) setelah verifikasi Google selesai,
// tapi di sini tidak bisa impor main.js (sirkular), jadi gunakan event.
const renderApp = () => window.dispatchEvent(new CustomEvent('tugasku:render'));

// Widget Turnstile yang tampil (centang "verify you are human"). Wajib lulus
// setiap kali pengguna meminta kode/email verifikasi dikirim.
const visibleCaptcha = () => {
  let token = null;
  let widgetId = null;
  const box = el('div', { class: 'captcha-box' });
  if (turnstileAvailable()) {
    mountTurnstile(box, (value) => { token = value; })
      .then((id) => { widgetId = id; })
      .catch((error) => toast(error.message, 'error'));
  }
  return {
    box,
    token: () => token,
    reset: () => {
      token = null;
      resetTurnstile(widgetId);
    },
    // true bila captcha tidak tersedia (site key kosong) atau sudah lolos.
    ok: () => !turnstileAvailable() || Boolean(token),
  };
};

const brand = () => el('div', { class: 'brand' },
  el('span', { class: 'brand-mark' }, '✓'),
  'TugasKu',
);

// Alur lupa password: kirim link reset ke email (dengan captcha), pengguna
// mengklik link itu dan aplikasi membuka halaman pasang password baru.
const forgotView = () => {
  const getCaptchaToken = invisibleCaptcha();
  const email = el('input', {
    type: 'email',
    required: true,
    placeholder: 'nama@email.com',
    autocomplete: 'email',
  });
  const error = el('p', { class: 'error' });
  let step = 'email';

  const back = el('p', { class: 'small muted' },
    'Ingat passwordnya? ',
    el('a', { href: '#/auth/signin' }, 'Kembali masuk'),
  );

  const sendLink = async () => {
    const captchaToken = await getCaptchaToken();
    const result = await requestPasswordReset(email.value.trim(), captchaToken);
    if (result.error) throw result.error;
  };

  // Langkah alternatif tanpa email: masuk lewat Google memakai email yang
  // sama, lalu pasang password baru (dengan captcha). Dipakai saat kode
  // email kena rate limit.
  const googleStep = () => {
    const gCaptcha = visibleCaptcha();
    const newPassword = el('input', {
      type: 'password',
      required: true,
      minlength: '6',
      placeholder: 'Minimal 6 karakter',
      autocomplete: 'new-password',
    });
    const gError = el('p', { class: 'error' });
    // Begitu kembali dari Google, flag cocok → dianggap terverifikasi.
    let verified = Boolean(checkGoogleVerify(email.value.trim()));
    if (verified) toast(`${email.value.trim()} terverifikasi lewat Google. Pasang password barumu.`);

    const form = el('form', {
      class: 'stack',
      onsubmit: async (event) => {
        event.preventDefault();
        gError.textContent = '';
        if (!verified) {
          gError.textContent = 'Masuk dulu dengan Google pakai email yang sama.';
          return;
        }
        if (!gCaptcha.ok()) {
          gError.textContent = 'Selesaikan dulu verifikasi bukan robot.';
          return;
        }
        const result = await updatePassword(newPassword.value);
        if (result.error) { gError.textContent = result.error.message; gCaptcha.reset(); return; }
        toast('Password baru tersimpan. Silakan masuk.');
        location.hash = '#/auth/signin';
      },
    },
    el('p', { class: 'muted small' },
      'Tidak bisa menerima email? Masuk lewat Google dengan email yang sama — itu cukup untuk membuktikan akun ini milikmu. Setelah itu pasang password baru di sini.'),
    el('button', {
      class: 'btn btn-soft wide',
      type: 'button',
      onclick: () => {
        gError.textContent = '';
        // Redirect penuh ke Google; begitu kembali, langkah ini menampilkan
        // formulirnya otomatis karena flag cocok.
        startGoogleVerify(email.value.trim(), 'lupa-password');
      },
    }, 'Lanjut lewat Google'),
    gCaptcha.box,
    el('div', { class: 'field' }, el('label', {}, 'Password baru'), newPassword),
    gError,
    el('button', {
      class: 'btn btn-primary wide',
      type: 'submit',
    }, 'Pasang password'),
    el('p', { class: 'small muted' },
      el('a', {
        href: '#/auth/forgot',
        onclick: (e) => { e.preventDefault(); step = 'email'; rerender(); },
      }, '‹ Kembali kirim lewat email')),
    );
    return form;
  };

  const renderStep = () => {
    if (step === 'google') return googleStep();
    if (step === 'email') {
      const submit = el('button', {
        class: 'btn btn-primary wide',
        type: 'submit',
      }, 'Kirim link reset ke email');
      return el('form', {
        class: 'stack',
        onsubmit: async (event) => {
          event.preventDefault();
          error.textContent = '';
          submit.disabled = true;
          try {
            await sendLink();
            toast('Link reset dikirim. Cek kotak masuk atau folder spam.');
            step = 'sent';
            rerender();
          } catch (err) {
            error.textContent = err.message || 'Link gagal dikirim.';
          } finally {
            submit.disabled = false;
          }
        },
      },
      el('p', { class: 'muted small' },
        'Masukkan email akunmu. Kami kirim link untuk pasang password baru.'),
      el('div', { class: 'field' }, el('label', {}, 'Email'), email),
      error,
      submit,
      el('p', { class: 'small muted' },
        'Email tidak sampai? ',
        el('a', {
          href: '#/auth/forgot',
          onclick: (e) => { e.preventDefault(); step = 'google'; rerender(); },
        }, 'Lanjut lewat Google (tanpa email)'),
      ));
    }

    const resend = el('button', {
      class: 'btn btn-soft wide',
      type: 'button',
    }, 'Kirim ulang link');
    resend.addEventListener('click', async () => {
      error.textContent = '';
      resend.disabled = true;
      try {
        // Setiap pengiriman ulang wajib lolos captcha lagi.
        await sendLink();
        toast('Link baru dikirim ulang.');
      } catch (err) {
        error.textContent = err.message || 'Link gagal dikirim.';
      } finally {
        resend.disabled = false;
      }
    });
    return el('div', { class: 'stack' },
      el('p', { class: 'muted small' },
        `Link reset sudah dikirim ke ${email.value.trim()}. Klik link di email itu — halaman pasang password baru akan terbuka otomatis. Link berlaku 1 jam.`),
      error,
      resend);
  };

  const card = el('section', {
    class: 'panel glass auth-card',
    style: 'max-width:480px;width:100%',
  });
  const rerender = () => {
    card.replaceChildren(
      brand(),
      el('h1', {}, 'Lupa password'),
      renderStep(),
      back,
    );
  };
  rerender();
  return el('main', { class: 'shell center auth-shell' }, card);
};

// Halaman pasang password baru saat pengguna datang lewat link recovery
// dari email (sesi recovery aktif).
export const resetSessionView = () => {
  const newPassword = el('input', {
    type: 'password',
    required: true,
    minlength: '6',
    placeholder: 'Minimal 6 karakter',
    autocomplete: 'new-password',
  });
  const error = el('p', { class: 'error' });
  const form = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      error.textContent = '';
      try {
        const result = await updatePassword(newPassword.value);
        if (result.error) throw result.error;
        toast('Password baru tersimpan.');
        location.hash = '#/dashboard';
      } catch (err) {
        error.textContent = err.message || 'Sesi kedaluwarsa. Minta link baru.';
      }
    },
  },
  el('div', { class: 'field' }, el('label', {}, 'Password baru'), newPassword),
  error,
  el('button', { class: 'btn btn-primary wide', type: 'submit' },
    'Simpan password baru'),
  );
  return el('main', { class: 'shell center auth-shell' },
    el('section', {
      class: 'panel glass auth-card',
      style: 'max-width:480px;width:100%',
    },
    brand(),
    el('h1', {}, 'Pasang password baru'),
    el('p', { class: 'muted small' },
      'Kamu datang lewat link dari email. Pasang password barumu.'),
    form));
};

// Layar setelah formulir daftar terkirim: pengguna diminta membuka email dan
// mengklik link verifikasi. Kirim ulang selalu minta captcha lagi. Sebagai
// alternatif tanpa email: masuk lewat Google dengan email yang sama — itu
// cukup untuk mengaktifkan akun.
const signupPendingView = (email, password, username) => {
  const captcha = visibleCaptcha();
  const error = el('p', { class: 'error' });
  const resend = el('button', {
    class: 'btn btn-soft wide',
    type: 'button',
  }, 'Kirim ulang email verifikasi');
  resend.addEventListener('click', async () => {
    error.textContent = '';
    if (!captcha.ok()) {
      error.textContent = 'Selesaikan dulu verifikasi bukan robot.';
      return;
    }
    resend.disabled = true;
    try {
      const result = await signUp(email, password, username, captcha.token());
      if (result.error) throw result.error;
      toast('Email verifikasi dikirim ulang.');
      captcha.reset();
    } catch (err) {
      error.textContent = err.message || 'Email gagal dikirim ulang.';
      captcha.reset();
    } finally {
      resend.disabled = false;
    }
  });

  // Alternatif tanpa email: masuk lewat Google memakai email yang sama
  // (redirect penuh + flag). Begitu kembali, flag cocok → pasang password
  // dari data yang tadi tersimpan di extra, lalu akud aktif.
  const gError = el('p', { class: 'error' });
  const verifiedFlag = checkGoogleVerify(email);
  if (verifiedFlag) {
    const { password: pass, username: name } = verifiedFlag.extra || {};
    toast('Akun aktif lewat Google. Selamat datang!');
    location.hash = '#/dashboard';
    // Pasang password dan usernamenya (bila tersimpan) sekaligus.
    if (pass || name) updatePassword(pass).catch(() => {});
    renderApp();
  }
  const gButton = el('button', {
    class: 'btn btn-soft wide',
    type: 'button',
    onclick: () => {
      gError.textContent = '';
      // Simpan data daftar supaya setelah kembali dari Google, akun bisa
      // diaktivasi dan password juga dipasang.
      startGoogleVerify(email, 'daftar', { password, username });
    },
  }, 'Verifikasi lewat Google (tanpa email)');

  return el('main', { class: 'shell center auth-shell' },
    el('section', {
      class: 'panel glass auth-card',
      style: 'max-width:480px;width:100%',
    },
    brand(),
    el('h1', {}, 'Cek email kamu'),
    el('p', { class: 'muted small' },
      `Link verifikasi sudah dikirim ke ${email}. Klik link "Confirm email address" di email itu — akunmu langsung aktif dan kamu otomatis masuk.`),
    el('p', { class: 'muted small' },
      'Email tidak sampai / linknya error? Cek folder spam, kirim ulang di bawah, atau pakai Google dengan email yang sama.'),
    captcha.box,
    error,
    resend,
    el('p', { class: 'small muted' }, '— atau —'),
    gButton,
    gError,
    el('p', { class: 'small muted' },
      'Salah email? ',
      el('a', { href: '#/auth/signup' }, 'Daftar ulang'),
    )));
};

// Halaman login khusus akun massal (nama lengkap + kode akses + password).
// Setelah kode benar, maukun massal pake email yang tersimpan di access_codes;
// begitu masuk, pengguna WAJIB mengganti password lewat verifikasi Google.
export const accessCodeView = (onDone) => {
  const fullName = el('input', {
    required: true,
    placeholder: 'Nama lengkap',
    autocomplete: 'name',
  });
  const code = el('input', {
    required: true,
    maxlength: '6',
    placeholder: 'Kode akses 6 karakter',
    autocomplete: 'off',
    style: 'text-transform:uppercase',
  });
  const password = el('input', {
    type: 'password',
    required: true,
    placeholder: 'Password sementara',
    autocomplete: 'current-password',
  });
  const error = el('p', { class: 'error' });

  const form = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      error.textContent = '';
      // Panggil RPC: cocokkan nama + kode, ambil email dari access_codes.
      const resp = await getSupabase().rpc('login_access_code', {
        p_full_name: fullName.value.trim(),
        p_code: code.value.trim().toUpperCase(),
      });
      const r = resp.data;
      if (resp.error || !r?.ok) {
        error.textContent = r?.error || 'Kode akses salah.';
        return;
      }
      // Login membawa email yang terdaftar di access_codes.
      const result = await signIn(r.email, password.value);
      if (result.error) { error.textContent = result.error.message; return; }
      // Setelah masuk: wajib ganti password — user diarahkan langsung ke
      // Profil → Pasang password yang ada opsi Google, tanpa redirect penuh.
      toast('Masuk berhasil. Selesaikan di Profil untuk mengganti password.');
      location.hash = '#/profil';
      renderApp();
    },
  },
  el('div', { class: 'field' }, el('label', {}, 'Nama lengkap'), fullName),
  el('div', { class: 'field' }, el('label', {}, 'Kode akses'), code),
  el('div', { class: 'field' }, el('label', {}, 'Password sementara'), password),
  error,
  el('button', { class: 'btn btn-primary wide', type: 'submit' },
    'Masuk & selesaikan di Google'),
  el('p', { class: 'small muted' },
    'Katakan "Masuk via kode akses" Kamu menggunakan kode ini untuk masuk. Setelah itu kamu akan diverifikasi lewat Google, lalu harus mengganti passwordmu. ',
    el('a', { href: '#/auth/signin' }, 'Masuk pakai email biasa'),
  ));

  return el(
    'main',
    { class: 'shell center auth-shell' },
    el('section', {
      class: 'panel glass auth-card',
      style: 'max-width:480px;width:100%',
    },
    brand(),
    el('h1', {}, 'Masuk dengan kode akses'),
    el('p', { class: 'muted small' },
      'Untuk yang dibuatkan oleh sekolah: nama lengkap + kode akses + password generate.'),
    form),
  );
};

export const authView = (mode = 'signin', onDone) => {
  if (mode === 'forgot') return forgotView();
  const isSignUp = mode === 'signup';
  const getCaptchaToken = invisibleCaptcha();
  // Login maupun daftar sekarang sama-sama pakai captcha Cloudflare yang
  // tampil (bukan invisible): wajib dicentang setiap kali masuk/daftar.
  const captcha = visibleCaptcha();
  const email = el('input', {
    type: 'email',
    required: true,
    placeholder: 'nama@email.com',
    autocomplete: 'email',
  });
  const password = el('input', {
    type: 'password',
    required: true,
    minlength: '6',
    placeholder: 'Minimal 6 karakter',
    autocomplete: isSignUp ? 'new-password' : 'current-password',
  });
  const username = el('input', {
    placeholder: 'siswa_rajin',
    minlength: '3',
    maxlength: '24',
    pattern: '[a-zA-Z0-9_.]{3,24}',
    required: isSignUp,
  });
  const error = el('p', { class: 'error' });

  const submit = async (event) => {
    event.preventDefault();
    error.textContent = '';
    // Setiap masuk/daftar wajib menandai captcha Cloudflare yang tampil.
    if (!captcha.ok()) {
      error.textContent = 'Selesaikan dulu verifikasi bukan robot.';
      return;
    }
    try {
      if (isSignUp) {
        const check = await usernameAvailable(username.value.trim());
        if (check.error) throw check.error;
        if (!check.data) {
          error.textContent = 'Username sudah dipakai atau terlalu mirip dengan username lain. Pilih yang beda minimal 3 karakter.';
          return;
        }
        const result = await signUp(
          email.value.trim(),
          password.value,
          username.value.trim(),
          captcha.token(),
        );
        if (result.error) throw result.error;
        // Email yang sudah terdaftar mengembalikan user tanpa identitas.
        if (result.data?.user?.identities?.length === 0) {
          error.textContent = 'Email ini sudah terdaftar. Coba masuk.';
          captcha.reset();
          return;
        }
        toast('Link verifikasi dikirim ke email.');
        document.querySelector('#app').replaceChildren(signupPendingView(
          email.value.trim(),
          password.value,
          username.value.trim(),
        ));
        return;
      }
      const result = await signIn(
        email.value.trim(),
        password.value,
        captcha.token(),
      );
      if (result.error) throw result.error;
      toast('Berhasil masuk.');
      onDone();
    } catch (err) {
      error.textContent = err.message || 'Ada masalah. Coba lagi.';
      captcha?.reset();
    }
  };

  const google = async () => {
    const result = await signInGoogle();
    if (result?.error) error.textContent = result.error.message;
  };

  const magic = async () => {
    try {
      const captchaToken = await getCaptchaToken();
      await sendMagicLink(email.value.trim(), captchaToken);
      toast('Link masuk dikirim ke email.');
    } catch (err) {
      error.textContent = err.message || 'Link tidak bisa dikirim.';
    }
  };

  const form = el(
    'form',
    { class: 'stack', onsubmit: submit },
    isSignUp && el('div', { class: 'field' },
      el('label', {}, 'Username'),
      username,
      el('p', { class: 'muted small' },
        'Huruf/angka/titik/underscore, 3-24 karakter. Tidak boleh sama atau mirip (beda kurang dari 3 karakter) dengan username lain.'),
    ),
    el('div', { class: 'field' }, el('label', {}, 'Email'), email),
    el('div', { class: 'field' },
      el('label', {}, 'Password'),
      password,
    ),
    captcha.box,
    error,
    el('button', {
      class: 'btn btn-primary wide',
      type: 'submit',
    }, isSignUp ? 'Buat akun' : 'Masuk'),
  );
  const themeButton = el('button', {
    class: 'btn btn-soft icon-btn auth-theme',
    type: 'button',
    'aria-label': 'Ganti tema',
    onclick: () => {
      toggleTheme();
      themeButton.replaceChildren(
        icon(getTheme() === 'dark' ? 'sun' : 'moon'),
      );
    },
  }, icon(getTheme() === 'dark' ? 'sun' : 'moon'));

  return el(
    'main',
    { class: 'shell center auth-shell' },
    el('div', { class: 'auth-chrome' }, themeButton),
    el(
      'section',
      { class: 'panel glass auth-card', style: 'max-width:480px;width:100%' },
      brand(),
      el('h1', {}, isSignUp ? 'Bikin akun' : 'Selamat datang lagi'),
      el('p', { class: 'muted' },
        'Atur tugas sekolah bareng teman sekelas.'),
      form,
      el('div', { class: 'row' },
        el('button', {
          class: 'btn btn-soft wide',
          type: 'button',
          onclick: google,
        }, 'Masuk dengan Google'),
        el('button', {
          class: 'btn btn-soft',
          type: 'button',
          onclick: magic,
        }, 'Link email'),
      ),
      el('p', { class: 'small muted' },
        isSignUp ? 'Sudah punya akun? ' : 'Belum punya akun? ',
        el('a', {
          href: `#/auth/${isSignUp ? 'signin' : 'signup'}`,
        }, isSignUp ? 'Masuk' : 'Daftar'),
        !isSignUp && ' · ',
        !isSignUp && el('a', { href: '#/auth/forgot' }, 'Lupa password'),
        !isSignUp && ' · ',
        !isSignUp && el('a', { href: '#/auth/kode' }, 'Masuk pakai kode akses'),
      ),
    ),
  );
};
