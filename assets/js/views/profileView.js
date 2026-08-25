// Profil pengguna, avatar, daftar kelas, statistik, dan tombol keluar.
import { el } from '../utils/dom.js';
import { header, profileMenu } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { updateProfile, usernameAvailable } from '../api/profile.js';
import {
  signOut,
  reauthenticate,
  updatePasswordWithNonce,
  getSession,
  signInGooglePopup,
  hasPasswordIdentity,
} from '../api/auth.js';
import { deleteMyAccount, deleteClass } from '../api/destructive.js';
import { toast } from '../components/toast.js';
import { openDestructiveDialog } from '../components/modal.js';
import { invisibleCaptcha } from '../components/turnstile.js';
import { showTutorial } from '../components/tutorial.js';
import { listLoginSessions, endLoginSession } from '../api/sessions.js';
import { relativeTime, formatDeadline } from '../utils/datetime.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';
import { progressFor } from '../store.js';
import { roleLabel } from '../utils/roles.js';

// Pengaturan akun: info akun, keamanan (password tersensor), dan daftar
// perangkat yang sedang login beserta waktu — perangkat lain bisa
// dikeluarkan supaya harus masuk ulang.
const accountSettings = (user) => {
  const email = user?.email || '—';
  const joinedAt = user?.created_at ? formatDeadline(user.created_at) : '—';
  const lastLogin = user?.last_sign_in_at ? relativeTime(user.last_sign_in_at) : '—';
  const mask = localStorage.getItem(STORAGE_KEYS.passwordMask(user.id))
    || '— (belum dipasang di perangkat ini)';
  const sessionList = el('div', { class: 'stack' });

  const paintSessions = (sessions) => {
    sessionList.replaceChildren(
      ...(sessions.length
        ? sessions.map((s) => el('div', {
          class: 'panel glass stack',
          style: 'padding:12px;gap:4px',
        },
        el('div', { class: 'row space' },
          el('strong', {}, s.current ? 'Perangkat ini' : 'Perangkat lain'),
          s.current
            ? el('span', { class: 'badge' }, 'Sedang dipakai')
            : el('button', {
              class: 'btn btn-soft',
              type: 'button',
              onclick: async () => {
                const { error } = await endLoginSession(s.session_id);
                if (error) toast(error.message, 'error');
                else {
                  toast('Perangkat itu dikeluarkan. Di sana harus masuk ulang.');
                  loadSessions();
                }
              },
            }, 'Keluar dari sini'),
        ),
        el('p', { class: 'muted small' }, s.user_agent || 'Perangkat tidak dikenal'),
        el('p', { class: 'muted small' },
          `Masuk ${relativeTime(s.created_at)}${s.ip ? ` · IP ${s.ip}` : ''}`),
        ))
        : [el('p', { class: 'muted small' }, 'Belum ada sesi lain.')]),
    );
  };

  const loadSessions = async () => {
    sessionList.replaceChildren(el('p', { class: 'muted small' }, 'Memuat perangkat…'));
    const { data, error } = await listLoginSessions();
    if (error) {
      sessionList.replaceChildren(el('p', { class: 'muted small' }, error.message));
      return;
    }
    paintSessions(data || []);
  };

  loadSessions();

  return el('section', { class: 'panel glass stack' },
    el('p', { class: 'eyebrow' }, 'Akun'),
    el('h2', {}, 'Pengaturan akun'),
    el('div', { class: 'field' },
      el('label', {}, 'Email'),
      el('input', { readonly: true, value: email }),
    ),
    el('div', { class: 'row space' },
      el('div', {},
        el('p', { class: 'muted small' }, 'Terdaftar sejak'),
        el('strong', {}, joinedAt),
      ),
      el('div', {},
        el('p', { class: 'muted small' }, 'Login terakhir'),
        el('strong', {}, lastLogin),
      ),
    ),
    el('div', { class: 'panel glass', style: 'padding:12px' },
      el('p', { class: 'muted small' }, 'Password'),
      el('strong', { style: 'letter-spacing:2px' }, mask),
      el('p', { class: 'muted small' },
        'Demi keamanan hanya 2 karakter awal dan 2 akhir yang ditampilkan. Mask ini tersimpan di perangkat ini saat kamu memasang/mengganti password.'),
    ),
    el('p', { class: 'muted small' },
      'Perangkat yang sedang login ke akunmu (perangkat lain bisa dikeluarkan):'),
    sessionList,
  );
};

// Ganti atau tambah password: kode reautentikasi dikirim ke email akun
// (email ini bawaan Supabase hanya berisi kode, tanpa link). Untuk akun yang
// login lewat Google saja, alur ini sekaligus memasang password pertama.
const passwordSection = (user) => {
  // true setelah password benar-benar terpasang. Deteksi utama lewat
  // identities, ditambah penanda lokal: begitu password berhasil dipasang
  // di sini, aplikasi menyimpan mask-nya — keberadaan mask berarti akun ini
  // sudah punya password.
  let hasPassword = hasPasswordIdentity(user)
    || Boolean(localStorage.getItem(STORAGE_KEYS.passwordMask(user.id)));
  const email = user?.email || '';
  const intro = hasPassword
    ? 'Kode verifikasi akan dikirim ke email akunmu sebelum password bisa diganti.'
    : 'Akunmu masuk lewat Google dan belum punya password. Pasang password supaya bisa masuk dengan email juga. Kode verifikasi dikirim ke email akunmu.';
  const error = el('p', { class: 'error' });
  let sent = false;
  // Captcha tak-kasat-mata, wajib lolos setiap kali kode diminta.
  const getCaptchaToken = invisibleCaptcha();

  const requestCode = async () => {
    // Captcha wajib lolos setiap kali kode diminta, sesuai aturan aplikasi.
    await getCaptchaToken();
    return reauthenticate();
  };

  const sendCode = el('button', {
    class: 'btn btn-soft',
    type: 'button',
    onclick: async () => {
      error.textContent = '';
      sendCode.disabled = true;
      try {
        const result = await requestCode();
        if (result.error) throw result.error;
        sent = true;
        toast(`Kode dikirim ke ${email}. Cek kotak masuk atau folder spam.`);
        rerender();
      } catch (err) {
        // Kode reautentikasi yang dikirim sebelumnya MASIH BERLAKU, jadi
        // kalau email kena rate limit, arahkan pengguna pakai kode lama.
        if (/rate limit/i.test(err.message || '')) {
          error.textContent = 'Pengiriman email sementara dibatasi. Kalau kamu sudah punya kode dari email sebelumnya, langsung pakai di bawah ini.';
          sent = true;
          rerender();
        } else {
          error.textContent = err.message || 'Kode gagal dikirim.';
        }
      } finally {
        sendCode.disabled = false;
      }
    },
  }, 'Kirim kode ke email');

  const code = el('input', {
    inputmode: 'numeric',
    maxlength: '8',
    placeholder: '8 digit kode dari email',
    autocomplete: 'one-time-code',
  });
  const newPassword = el('input', {
    type: 'password',
    minlength: '6',
    placeholder: 'Minimal 6 karakter',
    autocomplete: 'new-password',
  });
  const form = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      error.textContent = '';
      try {
        // Kode + password baru dikirim sekaligus; server memverifikasi kode
        // (nonce) dan menyimpan password dalam satu permintaan.
        const result = await updatePasswordWithNonce(
          newPassword.value,
          code.value.trim(),
        );
        if (result.error) throw result.error;
        // Password berhasil terpasang/diganti: simpan mask (2 awal + 2
        // akhir, sisanya sensor) untuk ditampilkan di Pengaturan akun,
        // dan tandai akun ini kini sudah punya password.
        const wasGoogleOnly = !hasPassword;
        const p = newPassword.value;
        const mask = p.length <= 4 ? '••••' : `${p.slice(0, 2)}${'*'.repeat(Math.max(4, p.length - 4))}${p.slice(-2)}`;
        // Simpan mask sebagai penanda bahwa akun ini kini punya password.
        localStorage.setItem(STORAGE_KEYS.passwordMask(user.id), mask);
        hasPassword = true;
        toast(wasGoogleOnly
          ? 'Password terpasang. Sekarang kamu bisa masuk dengan email juga.'
          : 'Password berhasil diganti.');
        sent = false;
        code.value = '';
        newPassword.value = '';
        rerender();
      } catch (err) {
        error.textContent = err.message?.includes('Nonce')
          ? 'Kode salah atau sudah kedaluwarsa. Minta kode baru.'
          : (err.message || 'Kode salah atau kedaluwarsa.');
      }
    },
  },
  el('p', { class: 'muted small' },
    `Kode dikirim ke ${email}. Kalau kode tidak sampai, cek folder spam; kode terakhir yang dikirim masih berlaku, jadi tidak perlu minta terus-terusan.`),
  el('div', { class: 'field' }, el('label', {}, 'Kode dari email'), code),
  el('div', { class: 'field' },
    el('label', {}, hasPassword ? 'Password baru' : 'Password'),
    newPassword,
  ),
  el('div', { class: 'row' },
    el('button', {
      class: 'btn btn-primary',
      type: 'submit',
    }, hasPassword ? 'Ganti password' : 'Pasang password'),
    el('button', {
      class: 'btn btn-soft',
      type: 'button',
      onclick: async () => {
        const result = await requestCode();
        if (result.error) toast(result.error.message, 'error');
        else toast('Kode baru dikirim ulang.');
      },
    }, 'Kirim ulang kode'),
  ));

  const box = el('section', { class: 'panel glass stack' });

  // Langkah alternatif tanpa email: masuk lewat Google pakai email yang
  // sama untuk membuktikan akun ini milikmu, lalu pasang password baru.
  const googleVerify = el('button', {
    class: 'btn btn-soft',
    type: 'button',
    onclick: () => {
      error.textContent = '';
      signInGooglePopup((session) => {
        if (!session) { error.textContent = 'Login Google dibatalkan.'; return; }
        const sameEmail = session.user?.email?.toLowerCase() === email.toLowerCase();
        if (!sameEmail) {
          error.textContent = `Email Google (${session.user?.email}) tidak sama dengan email akun ini.`;
          return;
        }
        toast('Terverifikasi lewat Google. Sekarang minta kode tidak perlu — tapi kode email tetap yang paling aman.');
        // Langsung tampilkan formulir; pengguna yang terverifikasi Google
        // boleh memasang password (sesi Google = bukti kepemilikan).
        sent = true;
        rerender();
      });
    },
  }, 'Lanjut lewat Google (tanpa email)');

  const rerender = () => {
    box.replaceChildren(
      el('div', {},
        el('p', { class: 'eyebrow' }, 'Akun'),
        el('h2', {}, hasPassword ? 'Ganti password' : 'Pasang password'),
      ),
      el('p', { class: 'muted small' }, intro),
      sendCode,
      el('p', { class: 'small muted' }, 'Email tidak sampai / kena batas? '),
      googleVerify,
      sent && form,
      error,
    );
  };
  rerender();
  return box;
};

const developerOverview = (classes, onDeleteClass) => el(
  'section',
  { class: 'panel glass developer-overview' },
  el('div', { class: 'section-heading' },
    el('div', {},
      el('p', { class: 'eyebrow' }, 'Developer'),
      el('h2', {}, 'Ringkasan kelas'),
    ),
  ),
  classes.length
    ? el(
      'div',
      { class: 'table-wrap' },
      el('table', {},
        el('thead', {},
          el('tr', {},
            el('th', {}, 'Kelas'),
            el('th', {}, 'Kode'),
            el('th', {}, 'Pemilik'),
            el('th', {}, 'Anggota'),
            el('th', {}, 'Tugas'),
            el('th', {}, 'Lampiran'),
            el('th', {}, 'Komentar'),
            el('th', {}, 'Aksi'),
          ),
        ),
        el('tbody', {},
          ...classes.map((item) => el('tr', {},
            el('td', {}, item.class_name),
            el('td', {}, item.room_code),
            el('td', {}, item.owner_username || 'Pengguna'),
            el('td', {}, String(item.member_count)),
            el('td', {}, String(item.task_count)),
            el('td', {}, String(item.file_count)),
            el('td', {}, String(item.comment_count)),
            el('td', {},
              el('button', {
                class: 'btn btn-danger-outline small delete-overview-class-button',
                type: 'button',
                onclick: () => onDeleteClass(item),
              }, 'Hapus kelas'),
            ),
          )),
        ),
      ),
    )
    : el('p', { class: 'muted' }, 'Belum ada kelas.'),
);

export const profileView = async ({
  profile,
  classes,
  tasks,
  user,
  onChanged,
  developerData = null,
  previewData = null,
}) => {
  const overview = developerData || { isDeveloper: false, classes: [] };
  const username = el('input', {
    required: true,
    minlength: '3',
    maxlength: '24',
    pattern: '[a-zA-Z0-9_.]{3,24}',
    value: profile?.username || '',
  });
  const fullName = el('input', {
    value: profile?.full_name || '',
    placeholder: 'Nama lengkap',
  });
  const pending = tasks.filter(
    (task) => progressFor(task.id) !== 'done',
  ).length;
  const done = tasks.length - pending;
  const form = el(
    'form',
    {
      class: 'panel glass stack',
      onsubmit: async (event) => {
        event.preventDefault();
        const nextUsername = username.value.trim();
        if (nextUsername.toLowerCase() !== (profile?.username || '').toLowerCase()) {
          const check = await usernameAvailable(nextUsername);
          if (check.error) {
            toast(check.error.message, 'error');
            return;
          }
          if (!check.data) {
            toast('Username sudah dipakai atau terlalu mirip dengan username lain. Bedakan minimal 3 karakter.', 'error');
            return;
          }
        }
        const result = await updateProfile(user.id, {
          username: nextUsername,
          full_name: fullName.value.trim() || null,
        });
        if (result.error) toast(result.error.message, 'error');
        else {
          toast('Profil disimpan.');
          onChanged?.();
        }
      },
    },
    el('div', { class: 'field' }, el('label', {}, 'Username'), username),
    el('div', { class: 'field' },
      el('label', {}, 'Nama lengkap'),
      fullName,
    ),
    el('button', {
      class: 'btn btn-primary',
      type: 'submit',
    }, 'Simpan profil'),
  );
  const avatar = profile?.avatar_url
    ? el('img', {
      class: 'avatar-image',
      src: profile.avatar_url,
      alt: `Foto profil ${profile.username}`,
    })
    : el('div', { class: 'avatar avatar-large' },
      (profile?.username || 'B').charAt(0).toUpperCase(),
    );
  const logout = el('button', {
    class: 'btn btn-soft',
    type: 'button',
    onclick: async () => {
      await signOut();
      location.hash = '#/auth/signin';
    },
  }, 'Keluar dari akun');
  const confirmDeleteClass = (classItem) => openDestructiveDialog({
    title: 'Hapus kelas ini?',
    consequence: 'Seluruh jadwal, tugas, komentar, dan lampiran kelas ini akan dihapus permanen dan tidak bisa dikembalikan.',
    actionLabel: 'Hapus kelas',
    onConfirm: async () => {
      const result = developerData?.onDeleteClass
        ? await developerData.onDeleteClass(classItem.class_id)
        : await deleteClass(classItem.class_id);
      if (result?.error) return result;
      toast('Kelas berhasil dihapus.');
      onChanged?.();
      return result;
    },
  });
  const deleteAccount = el('button', {
    class: 'btn btn-danger-outline delete-account-button',
    type: 'button',
    onclick: () => openDestructiveDialog({
      title: 'Hapus akun ini?',
      consequence: 'Seluruh data akun ini, termasuk kelas yang kamu miliki, akan dihapus permanen dan tidak bisa dikembalikan.',
      actionLabel: 'Hapus akun',
      onConfirm: async () => {
        const result = previewData?.onDeleteAccount
          ? await previewData.onDeleteAccount()
          : await deleteMyAccount();
        if (result?.error) return result;
        await signOut().catch(() => {});
        toast('Akun berhasil dihapus. Sampai jumpa.');
        location.hash = '#/auth/signin';
        return result;
      },
    }),
  }, 'Hapus akun');

  return el(
    'main',
    { class: 'shell' },
    header({ title: 'Profil' }),
    profileMenu(profile),
    el('section', { class: 'panel glass row' },
      avatar,
      el('div', {},
        el('p', { class: 'eyebrow' }, 'Profil kamu'),
        el('h1', {}, profile?.full_name || `@${profile?.username || 'teman'}`),
        el('p', { class: 'muted' }, user?.email || ''),
      ),
    ),
    el('section', { class: 'stats grid grid-2' },
      el('div', { class: 'panel glass stat-card' },
        el('strong', { class: 'stat-number' }, String(pending)),
        el('span', { class: 'muted small' }, 'Belum dikerjakan'),
      ),
      el('div', { class: 'panel glass stat-card' },
        el('strong', { class: 'stat-number' }, String(done)),
        el('span', { class: 'muted small' }, 'Sudah dikerjakan'),
      ),
    ),
    form,
    passwordSection(user),
    accountSettings(user),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Bantuan'),
      el('p', { class: 'muted small' },
        'Baru pertama pakai TugasKu atau lupa cara pakainya? Buka lagi panduan langkah demi langkah.'),
      el('button', {
        class: 'btn btn-soft',
        type: 'button',
        onclick: () => showTutorial(),
      }, 'Ulangi tutorial'),
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Kelas kamu'),
      el('div', { class: 'stack' },
        ...classes.map((item) => el(
          'a',
          { class: 'row space', href: `#/kelas/${item.id}` },
          el('strong', {}, item.name),
          el('span', {
            class: `badge role-badge role-${item.role || 'member'}`,
          }, roleLabel(item.role)),
        )),
      ),
    ),
    logout,
    deleteAccount,
    overview.isDeveloper && developerOverview(
      overview.classes,
      confirmDeleteClass,
    ),
    bottomNav('profil'),
  );
};
