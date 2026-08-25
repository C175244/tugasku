// Konsol developer TugasKu (developer.html).
// Halaman ini sengaja terpisah dan tidak ditautkan dari aplikasi utama.
// Akses berlapis: login email+password, verifikasi anti-bot (Turnstile),
// lalu pemeriksaan role developer di database (RPC is_developer).
import { applyTheme } from '../theme.js';
import { el } from '../utils/dom.js';
import { toast } from '../components/toast.js';
import { openModal, openDestructiveDialog } from '../components/modal.js';
import {
  mountTurnstile,
  turnstileAvailable,
} from '../components/turnstile.js';
import { getSupabase } from '../supabaseClient.js';
import {
  getSession,
  signOut,
  signInGoogle,
  signInGooglePopup,
  requestPasswordReset,
  updatePassword,
} from '../api/auth.js';
import {
  isDeveloper,
  listDeveloperClasses,
  listDeveloperUsers,
  devBanUser,
  devUnbanUser,
  devRemoveMember,
  devDeleteUser,
} from '../api/developer.js';
import { deleteClass } from '../api/destructive.js';
import { setHead } from '../components/head.js';
import { relativeTime, formatDeadline } from '../utils/datetime.js';
import { listAnnouncements, sendAnnouncement } from '../api/announcements.js';
import { roleLabel } from '../utils/roles.js';

applyTheme();
const app = document.querySelector('#app');

// Token aksi sensitif: diminta sekali per sesi sebelum aksi pertama.
let actionToken = null;

const requireActionToken = () => {
  if (!turnstileAvailable() || actionToken) return Promise.resolve(true);
  return new Promise((resolve) => {
    const box = el('div', { class: 'captcha-box' });
    const done = (ok) => {
      document.querySelector('.modal-backdrop')?.remove();
      resolve(ok);
    };
    mountTurnstile(box, (token) => {
      if (!token) return;
      actionToken = token;
      done(true);
    }).catch(() => done(false));
    const content = el('div', { class: 'stack' },
      el('p', { class: 'muted small' },
        'Verifikasi bukan robot diperlukan sebelum aksi sensitif.'),
      box,
    );
    openModal('Verifikasi aksi', content, () => resolve(false));
  });
};

const centerShell = (...children) => el(
  'main',
  { class: 'shell center' },
  el('section', { class: 'panel glass stack' }, ...children),
);

// Alur lupa password di konsol developer: kirim link reset ke email (widget
// captcha tampil di popup ini dan wajib lolos setiap pengiriman). Link di
// email membuka kembali halaman ini dengan sesi recovery, lalu muncul
// halaman pasang password baru (lihat onAuthStateChange di bawah).
const forgotDialog = (initialEmail) => {
  const email = el('input', {
    type: 'email',
    required: true,
    value: initialEmail || '',
    placeholder: 'nama@email.com',
  });
  const error = el('p', { class: 'error' });
  const captchaBox = el('div', { class: 'captcha-box' });
  let captchaToken = null;
  let widgetId = null;
  if (turnstileAvailable()) {
    mountTurnstile(captchaBox, (token) => { captchaToken = token; })
      .then((id) => { widgetId = id; })
      .catch((err) => toast(err.message, 'error'));
  }
  const submit = el('button', {
    class: 'btn btn-primary wide',
    type: 'submit',
  }, 'Kirim link reset ke email');

  // Langkah alternatif tanpa email: masuk lewat Google pakai email yang sama
  // untuk membuktikan akun ini milikmu, lalu pasang password baru.
  const gCaptchaBox = el('div', { class: 'captcha-box' });
  let gCaptchaToken = null;
  if (turnstileAvailable()) {
    mountTurnstile(gCaptchaBox, (t) => { gCaptchaToken = t; })
      .catch((e) => toast(e.message, 'error'));
  }
  const gNewPassword = el('input', {
    type: 'password',
    minlength: '6',
    placeholder: 'Minimal 6 karakter',
    autocomplete: 'new-password',
  });
  const gError = el('p', { class: 'error' });
  let gVerified = false;
  const gForm = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      gError.textContent = '';
      if (!gVerified) { gError.textContent = 'Masuk dulu dengan Google pakai email yang sama.'; return; }
      if (turnstileAvailable() && !gCaptchaToken) { gError.textContent = 'Selesaikan dulu verifikasi bukan robot.'; return; }
      const result = await updatePassword(gNewPassword.value);
      if (result.error) { gError.textContent = result.error.message; return; }
      toast('Password baru tersimpan. Silakan masuk.');
      document.querySelector('.modal-backdrop')?.remove();
      await signOut();
      render();
    },
  },
  el('p', { class: 'muted small' },
    'Tidak bisa menerima email? Masuk lewat Google dengan email yang sama, lalu pasang password baru di sini.'),
  el('button', {
    class: 'btn btn-soft wide',
    type: 'button',
    onclick: () => {
      gError.textContent = '';
      signInGooglePopup((session) => {
        if (!session) { gError.textContent = 'Login Google dibatalkan.'; return; }
        const same = session.user?.email?.toLowerCase() === email.value.trim().toLowerCase();
        if (!same) { gError.textContent = 'Email Google tidak sama dengan email akun ini.'; return; }
        gVerified = true;
        toast(`Terverifikasi sebagai ${session.user.email}.`);
      });
    },
  }, 'Lanjut lewat Google'),
  gCaptchaBox,
  el('div', { class: 'field' }, el('label', {}, 'Password baru'), gNewPassword),
  gError,
  el('button', { class: 'btn btn-primary wide', type: 'submit' }, 'Pasang password'),
  );

  const form = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      error.textContent = '';
      if (turnstileAvailable() && !captchaToken) {
        error.textContent = 'Selesaikan dulu verifikasi bukan robot.';
        return;
      }
      submit.disabled = true;
      try {
        const result = await requestPasswordReset(email.value.trim(), captchaToken);
        if (result.error) throw result.error;
        toast(`Link reset dikirim ke ${email.value.trim()}. Klik linknya, halaman pasang password akan terbuka di sini.`);
        captchaToken = null;
        if (widgetId != null && window.turnstile) window.turnstile.reset(widgetId);
      } catch (err) {
        error.textContent = err.message || 'Link gagal dikirim.';
      } finally {
        submit.disabled = false;
      }
    },
  },
  el('p', { class: 'muted small' },
    'Masukkan email akun developer. Kami kirim link untuk pasang password baru.'),
  el('div', { class: 'field' }, el('label', {}, 'Email'), email),
  captchaBox,
  error,
  submit,
  el('p', { class: 'small muted' }, '— atau —'),
  gForm);
  openModal('Lupa password', form);
};

// Halaman pasang password baru saat developer datang lewat link recovery.
const resetPasswordView = () => {
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
      const result = await updatePassword(newPassword.value);
      if (result.error) {
        error.textContent = result.error.message;
        return;
      }
      toast('Password baru tersimpan. Silakan masuk.');
      await signOut();
      render();
    },
  },
  el('div', { class: 'field' }, el('label', {}, 'Password baru'), newPassword),
  error,
  el('button', { class: 'btn btn-primary wide', type: 'submit' },
    'Simpan password baru'));
  return centerShell(
    el('p', { class: 'eyebrow' }, 'Akses terbatas'),
    el('h1', {}, 'Pasang password baru'),
    el('p', { class: 'muted' },
      'Kamu datang lewat link dari email. Pasang password barumu.'),
    form,
  );
};

const loginView = () => {
  const email = el('input', {
    type: 'email',
    required: true,
    autocomplete: 'username',
    placeholder: 'Email developer',
  });
  const password = el('input', {
    type: 'password',
    required: true,
    autocomplete: 'current-password',
    placeholder: 'Password',
  });
  const captchaBox = el('div', { class: 'captcha-box' });
  let captchaToken = null;
  const submit = el('button', {
    class: 'btn btn-primary',
    type: 'submit',
  }, 'Masuk konsol');

  const form = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      if (turnstileAvailable() && !captchaToken) {
        toast('Selesaikan dulu verifikasi bukan robot.', 'error');
        return;
      }
      submit.disabled = true;
      const { error } = await getSupabase().auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value,
        options: captchaToken ? { captchaToken } : {},
      });
      submit.disabled = false;
      if (error) {
        toast(error.message, 'error');
        return;
      }
      render();
    },
  },
  el('div', { class: 'field' }, el('label', {}, 'Email'), email),
  el('div', { class: 'field' }, el('label', {}, 'Password'), password),
  captchaBox,
  submit);

  const googleButton = el('button', {
    class: 'btn btn-soft wide',
    type: 'button',
    onclick: async () => {
      if (turnstileAvailable() && !captchaToken) {
        toast('Selesaikan dulu verifikasi bukan robot.', 'error');
        return;
      }
      const result = await signInGoogle();
      if (result?.error) toast(result.error.message, 'error');
    },
  }, 'Masuk dengan Google');

  const forgotButton = el('button', {
    class: 'btn btn-soft',
    type: 'button',
    onclick: () => forgotDialog(email.value.trim()),
  }, 'Lupa password');

  if (turnstileAvailable()) {
    mountTurnstile(captchaBox, (token) => { captchaToken = token; })
      .catch((error) => toast(error.message, 'error'));
  } else {
    captchaBox.append(el('p', { class: 'muted small' },
      'Site key Turnstile belum diisi di assets/js/config.js, verifikasi anti-bot belum aktif.'));
  }

  return centerShell(
    el('p', { class: 'eyebrow' }, 'Akses terbatas'),
    el('h1', {}, 'Konsol Developer'),
    el('p', { class: 'muted' },
      'Halaman ini hanya untuk akun yang terdaftar sebagai developer.'),
    form,
    googleButton,
    forgotButton,
  );
};

const deniedView = () => centerShell(
  el('h1', {}, 'Akses ditolak'),
  el('p', { class: 'muted' },
    'Akun ini tidak terdaftar sebagai developer.'),
  el('button', {
    class: 'btn btn-soft',
    type: 'button',
    onclick: async () => {
      await signOut();
      render();
    },
  }, 'Keluar'),
);

const membershipChips = (row, onChanged) => (row.memberships || []).map(
  (membership) => el('span', { class: 'badge chip' },
    `${membership.class_name} · ${roleLabel(membership.role)} `,
    el('button', {
      class: 'btn btn-danger-outline small',
      type: 'button',
      title: `Keluarkan dari ${membership.class_name}`,
      onclick: () => {
        const reason = el('textarea', {
          rows: '2',
          maxlength: '500',
          placeholder: 'Alasan (opsional)',
        });
        const form = el('form', {
          class: 'stack',
          onsubmit: async (event) => {
            event.preventDefault();
            if (!await requireActionToken()) return;
            const result = await devRemoveMember(
              membership.class_id,
              row.user_id,
              reason.value.trim() || null,
            );
            if (result.error) {
              toast(result.error.message, 'error');
              return;
            }
            toast('Anggota dikeluarkan dari kelas.');
            document.querySelector('.modal-backdrop')?.remove();
            onChanged();
          },
        },
        el('div', { class: 'field' }, el('label', {}, 'Alasan (opsional)'), reason),
        el('button', { class: 'btn btn-danger-outline', type: 'submit' },
          'Keluarkan'));
        openModal(
          `Keluarkan @${row.username || 'pengguna'} dari ${membership.class_name}?`,
          form,
        );
      },
    }, '×'),
  ),
);

const banDialog = (row, hours, onChanged) => {
  const reason = el('textarea', {
    rows: '2',
    maxlength: '500',
    placeholder: 'Alasan (opsional)',
  });
  const label = hours ? `Suspensi ${hours} jam` : 'Ban permanen';
  const form = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      if (!await requireActionToken()) return;
      const result = await devBanUser(row.user_id, reason.value.trim() || null, hours);
      if (result.error) {
        toast(result.error.message, 'error');
        return;
      }
      toast(`${label} diterapkan ke @${row.username || 'pengguna'}.`);
      document.querySelector('.modal-backdrop')?.remove();
      onChanged();
    },
  },
  el('div', { class: 'field' }, el('label', {}, 'Alasan (opsional)'), reason),
  el('button', { class: 'btn btn-danger-outline', type: 'submit' }, label));
  openModal(`${label} untuk @${row.username || 'pengguna'}?`, form);
};

const userRow = (row, selfId, onChanged) => el('tr', {},
  el('td', {}, row.full_name || '-'),
  el('td', {}, `@${row.username || 'pengguna'}`),
  el('td', {}, row.email || '-'),
  el('td', {}, ...membershipChips(row, onChanged)),
  el('td', {},
    row.is_developer && el('span', { class: 'badge role-badge role-developer' }, 'Developer'),
    row.banned && el('span', { class: 'badge red' },
      row.ban_expires_at
        ? `Suspensi sampai ${new Date(row.ban_expires_at).toLocaleString('id-ID')}`
        : 'Diban permanen'),
  ),
  el('td', {},
    !row.is_developer && row.user_id !== selfId && el('div', { class: 'row' },
      el('button', {
        class: 'btn btn-soft small',
        type: 'button',
        onclick: () => banDialog(row, 24, onChanged),
      }, 'Suspensi 24 jam'),
      el('button', {
        class: 'btn btn-soft small',
        type: 'button',
        onclick: () => banDialog(row, null, onChanged),
      }, 'Ban'),
      row.banned && el('button', {
        class: 'btn btn-soft small',
        type: 'button',
        onclick: async () => {
          const result = await devUnbanUser(row.user_id);
          if (result.error) toast(result.error.message, 'error');
          else onChanged();
        },
      }, 'Cabut blokir'),
      el('button', {
        class: 'btn btn-danger-outline small',
        type: 'button',
        onclick: () => openDestructiveDialog({
          title: `Hapus akun @${row.username || 'pengguna'}?`,
          consequence: 'Seluruh data akun ini, termasuk kelas yang ia miliki, akan dihapus permanen dan tidak bisa dikembalikan.',
          actionLabel: 'Hapus akun',
          onConfirm: async () => {
            if (!await requireActionToken()) {
              return { error: { message: 'Verifikasi anti-bot dibatalkan.' } };
            }
            const result = await devDeleteUser(row.user_id);
            if (!result.error) onChanged();
            return result;
          },
        }),
      }, 'Hapus akun'),
    ),
  ),
);

// Panel pengumuman: developer menulis pesan yang muncul sebagai popup di
// aplikasi utama untuk semua pengguna, plus riwayat pesan terkirim.
const announcementPanel = (announcements, onChanged) => {
  const input = el('textarea', {
    rows: '3',
    maxlength: '2000',
    required: true,
    placeholder: 'Tulis pengumuman untuk semua pengguna...',
  });
  const error = el('p', { class: 'error' });
  const form = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      error.textContent = '';
      const result = await sendAnnouncement(input.value);
      if (result.error) {
        error.textContent = result.error.message;
        return;
      }
      input.value = '';
      toast('Pengumuman terkirim ke semua pengguna.');
      onChanged();
    },
  },
  el('div', { class: 'field' }, el('label', {}, 'Pesan'), input),
  error,
  el('button', { class: 'btn btn-primary', type: 'submit' },
    'Kirim ke semua pengguna'),
  );
  return el('section', { class: 'panel glass stack' },
    el('h2', {}, 'Pengumuman untuk semua pengguna'),
    form,
    el('h3', {}, 'Riwayat pengumuman'),
    announcements.length
      ? el('div', { class: 'stack' },
        ...announcements.map((item) => el('div', { class: 'stack' },
          el('p', { class: 'muted small' }, formatDeadline(item.created_at)),
          el('p', { style: 'white-space:pre-wrap;margin:0' }, item.body),
        )),
      )
      : el('p', { class: 'muted' }, 'Belum ada pengumuman terkirim.'),
  );
};

const dashboardView = (session, users, classes, announcements, onChanged) => {
  const search = el('input', {
    type: 'search',
    placeholder: 'Cari nama, username, atau email...',
  });
  const tableWrap = el('div', { class: 'table-wrap' });

  const renderUsers = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = users.filter((row) => !query
      || (row.full_name || '').toLowerCase().includes(query)
      || (row.username || '').toLowerCase().includes(query)
      || (row.email || '').toLowerCase().includes(query));
    tableWrap.replaceChildren(el('table', {},
      el('thead', {}, el('tr', {},
        el('th', {}, 'Nama lengkap'),
        el('th', {}, 'Username'),
        el('th', {}, 'Email'),
        el('th', {}, 'Peran di kelas'),
        el('th', {}, 'Status'),
        el('th', {}, 'Aksi'),
      )),
      el('tbody', {}, ...filtered.map((row) => userRow(row, session.user.id, onChanged))),
    ));
  };
  search.addEventListener('input', renderUsers);
  renderUsers();

  return el('main', { class: 'shell' },
    el('div', { class: 'row space' },
      el('div', {},
        el('p', { class: 'eyebrow' }, 'Konsol developer'),
        el('h1', {}, 'Administrasi TugasKu'),
      ),
      el('button', {
        class: 'btn btn-soft',
        type: 'button',
        onclick: async () => {
          await signOut();
          render();
        },
      }, 'Keluar'),
    ),
    el('section', { class: 'stats grid grid-2' },
      el('div', { class: 'panel glass stat-card' },
        el('strong', { class: 'stat-number' }, String(users.length)),
        el('span', { class: 'muted small' }, 'Pengguna terdaftar'),
      ),
      el('div', { class: 'panel glass stat-card' },
        el('strong', { class: 'stat-number' }, String(classes.length)),
        el('span', { class: 'muted small' }, 'Kelas aktif'),
      ),
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Semua pengguna'),
      el('div', { class: 'field' }, search),
      tableWrap,
    ),
    announcementPanel(announcements, onChanged),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Semua kelas'),
      classes.length
        ? el('div', { class: 'table-wrap' },
          el('table', {},
            el('thead', {}, el('tr', {},
              el('th', {}, 'Kelas'),
              el('th', {}, 'Kode'),
              el('th', {}, 'Pemilik'),
              el('th', {}, 'Anggota'),
              el('th', {}, 'Tugas'),
              el('th', {}, 'Dibuat'),
              el('th', {}, 'Aksi'),
            )),
            el('tbody', {}, ...classes.map((item) => el('tr', {},
              el('td', {}, item.class_name),
              el('td', {}, item.room_code),
              el('td', {}, `@${item.owner_username || 'pengguna'}`),
              el('td', {}, String(item.member_count)),
              el('td', {}, String(item.task_count)),
              el('td', {}, relativeTime(item.created_at)),
              el('td', {},
                el('button', {
                  class: 'btn btn-danger-outline small',
                  type: 'button',
                  onclick: () => openDestructiveDialog({
                    title: `Hapus kelas ${item.class_name}?`,
                    consequence: 'Seluruh jadwal, tugas, komentar, dan lampiran kelas ini akan dihapus permanen dan tidak bisa dikembalikan.',
                    actionLabel: 'Hapus kelas',
                    onConfirm: async () => {
                      if (!await requireActionToken()) {
                        return { error: { message: 'Verifikasi anti-bot dibatalkan.' } };
                      }
                      const result = await deleteClass(item.class_id);
                      if (!result.error) onChanged();
                      return result;
                    },
                  }),
                }, 'Hapus kelas'),
              ),
            ))),
          ),
        )
        : el('p', { class: 'muted' }, 'Belum ada kelas.'),
    ),
  );
};

const render = async () => {
  setHead('Konsol Developer');
  app.replaceChildren(el('main', { class: 'shell center' },
    el('p', { class: 'muted' }, 'Memuat...')));
  const session = await getSession();
  if (!session) {
    app.replaceChildren(loginView());
    return;
  }
  const developerResult = await isDeveloper();
  if (!developerResult.data) {
    app.replaceChildren(deniedView());
    return;
  }
  const [usersResult, classesResult, announcementsResult] = await Promise.all([
    listDeveloperUsers(),
    listDeveloperClasses(),
    listAnnouncements(),
  ]);
  if (usersResult.error) {
    toast(usersResult.error.message, 'error');
    app.replaceChildren(deniedView());
    return;
  }
  app.replaceChildren(dashboardView(
    session,
    usersResult.data || [],
    classesResult.data || [],
    announcementsResult.data || [],
    render,
  ));
};

// Developer yang datang lewat link reset password di email mendapat sesi
// recovery — tampilkan halaman pasang password baru, bukan dasbor.
getSupabase().auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    app.replaceChildren(resetPasswordView());
  }
});

render();
