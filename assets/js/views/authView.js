// Halaman masuk dan daftar akun TugasKu.
import { el } from '../utils/dom.js';
import {
  signIn,
  signUp,
  signInGoogle,
  sendMagicLink,
  requestPasswordReset,
  verifyRecoveryOtp,
  updatePassword,
} from '../api/auth.js';
import { toast } from '../components/toast.js';
import { invisibleCaptcha } from '../components/turnstile.js';
import { toggleTheme, getTheme } from '../theme.js';
import { icon } from '../components/icons.js';

// Alur lupa password: minta kode ke email, verifikasi kode, lalu pasang
// password baru. Sesudah berhasil, pengguna diminta masuk lagi.
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

  const renderStep = () => {
    if (step === 'email') {
      const submit = el('button', {
        class: 'btn btn-primary wide',
        type: 'submit',
      }, 'Kirim kode ke email');
      return el('form', {
        class: 'stack',
        onsubmit: async (event) => {
          event.preventDefault();
          error.textContent = '';
          submit.disabled = true;
          try {
            const captchaToken = await getCaptchaToken();
            const result = await requestPasswordReset(
              email.value.trim(),
              captchaToken,
            );
            if (result.error) throw result.error;
            toast('Kode dikirim ke email. Cek kotak masuk atau folder spam.');
            step = 'code';
            rerender();
          } catch (err) {
            error.textContent = err.message || 'Kode gagal dikirim.';
          } finally {
            submit.disabled = false;
          }
        },
      },
      el('p', { class: 'muted small' },
        'Masukkan email akunmu. Kami kirim kode verifikasi ke email itu.'),
      el('div', { class: 'field' }, el('label', {}, 'Email'), email),
      error,
      submit);
    }

    const code = el('input', {
      required: true,
      inputmode: 'numeric',
      maxlength: '8',
      placeholder: '8 digit kode dari email',
      autocomplete: 'one-time-code',
    });
    const newPassword = el('input', {
      type: 'password',
      required: true,
      minlength: '6',
      placeholder: 'Minimal 6 karakter',
      autocomplete: 'new-password',
    });
    const submit = el('button', {
      class: 'btn btn-primary wide',
      type: 'submit',
    }, 'Simpan password baru');
    return el('form', {
      class: 'stack',
      onsubmit: async (event) => {
        event.preventDefault();
        error.textContent = '';
        submit.disabled = true;
        try {
          const check = await verifyRecoveryOtp(email.value.trim(), code.value.trim());
          if (check.error) throw check.error;
          const result = await updatePassword(newPassword.value);
          if (result.error) throw result.error;
          toast('Password baru tersimpan. Masuk dengan password barumu.');
          location.hash = '#/auth/signin';
        } catch (err) {
          error.textContent = err.message || 'Kode salah atau kedaluwarsa.';
        } finally {
          submit.disabled = false;
        }
      },
    },
    el('p', { class: 'muted small' },
      `Kode verifikasi sudah dikirim ke ${email.value.trim()}. Kode berlaku 1 jam.`),
    el('div', { class: 'field' }, el('label', {}, 'Kode dari email'), code),
    el('div', { class: 'field' },
      el('label', {}, 'Password baru'),
      newPassword,
    ),
    error,
    submit,
    el('p', { class: 'small muted' },
      'Kode tidak sampai? ',
      el('a', {
        href: '#/auth/forgot',
        onclick: (event) => {
          event.preventDefault();
          step = 'email';
          rerender();
        },
      }, 'Kirim ulang kode'),
    ));
  };

  const card = el('section', {
    class: 'panel glass auth-card',
    style: 'max-width:480px;width:100%',
  });
  const rerender = () => {
    card.replaceChildren(
      el('div', { class: 'brand' },
        el('span', { class: 'brand-mark' }, '✓'),
        'TugasKu',
      ),
      el('h1', {}, 'Lupa password'),
      error,
      renderStep(),
      back,
    );
  };
  rerender();
  return el('main', { class: 'shell center auth-shell' }, card);
};

export const authView = (mode = 'signin', onDone) => {
  if (mode === 'forgot') return forgotView();
  const isSignUp = mode === 'signup';
  const getCaptchaToken = invisibleCaptcha();
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
    placeholder: 'bayu_keren',
    minlength: '3',
    maxlength: '24',
    pattern: '[a-zA-Z0-9_.]{3,24}',
    required: isSignUp,
  });
  const error = el('p', { class: 'error' });

  const submit = async (event) => {
    event.preventDefault();
    error.textContent = '';
    try {
      const captchaToken = await getCaptchaToken();
      const result = isSignUp
        ? await signUp(email.value, password.value, username.value, captchaToken)
        : await signIn(email.value, password.value, captchaToken);
      if (result.error) throw result.error;
      toast(isSignUp
        ? 'Akun dibuat! Cek email kalau diminta.'
        : 'Berhasil masuk.');
      onDone();
    } catch (err) {
      error.textContent = err.message || 'Ada masalah. Coba lagi.';
    }
  };

  const google = async () => {
    const result = await signInGoogle();
    if (result?.error) error.textContent = result.error.message;
  };

  const magic = async () => {
    try {
      const captchaToken = await getCaptchaToken();
      await sendMagicLink(email.value, captchaToken);
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
    ),
    el('div', { class: 'field' }, el('label', {}, 'Email'), email),
    el('div', { class: 'field' },
      el('label', {}, 'Password'),
      password,
    ),
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
      el('div', { class: 'brand' },
        el('span', { class: 'brand-mark' }, '✓'),
        'TugasKu',
      ),
      el('h1', {}, isSignUp ? 'Bikin akun' : 'Selamat datang lagi'),
      el('p', { class: 'muted' },
        'Atur tugas sekolah bareng teman sekelas.',
      ),
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
      ),
    ),
  );
};
