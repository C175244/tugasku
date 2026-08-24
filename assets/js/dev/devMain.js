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
import { getSession, signOut, signInGoogle } from '../api/auth.js';
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
import { relativeTime } from '../utils/datetime.js';
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

const dashboardView = (session, users, classes, onChanged) => {
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
  const [usersResult, classesResult] = await Promise.all([
    listDeveloperUsers(),
    listDeveloperClasses(),
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
    render,
  ));
};

render();
