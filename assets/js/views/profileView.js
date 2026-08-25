// Profil pengguna, avatar, daftar kelas, statistik, dan tombol keluar.
import { el } from '../utils/dom.js';
import { header, profileMenu } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { updateProfile, usernameAvailable } from '../api/profile.js';
import {
  signOut,
  reauthenticate,
  verifyReauthOtp,
  updatePassword,
  hasPasswordIdentity,
} from '../api/auth.js';
import { deleteMyAccount, deleteClass } from '../api/destructive.js';
import { toast } from '../components/toast.js';
import { openDestructiveDialog } from '../components/modal.js';
import { invisibleCaptcha } from '../components/turnstile.js';
import { progressFor } from '../store.js';
import { roleLabel } from '../utils/roles.js';

// Ganti atau tambah password: kode reautentikasi dikirim ke email akun
// (email ini bawaan Supabase hanya berisi kode, tanpa link). Untuk akun yang
// login lewat Google saja, alur ini sekaligus memasang password pertama.
const passwordSection = (user) => {
  const hasPassword = hasPasswordIdentity(user);
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
        error.textContent = err.message || 'Kode gagal dikirim.';
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
        const check = await verifyReauthOtp(code.value.trim());
        if (check.error) throw check.error;
        const result = await updatePassword(newPassword.value);
        if (result.error) throw result.error;
        toast(hasPassword
          ? 'Password berhasil diganti.'
          : 'Password terpasang. Sekarang kamu bisa masuk dengan email juga.');
        sent = false;
        code.value = '';
        newPassword.value = '';
        rerender();
      } catch (err) {
        error.textContent = err.message || 'Kode salah atau kedaluwarsa.';
      }
    },
  },
  el('p', { class: 'muted small' },
    `Kode sudah dikirim ke ${email}. Kode berlaku 1 jam.`),
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
  const rerender = () => {
    box.replaceChildren(
      el('div', {},
        el('p', { class: 'eyebrow' }, 'Akun'),
        el('h2', {}, hasPassword ? 'Ganti password' : 'Pasang password'),
      ),
      el('p', { class: 'muted small' }, intro),
      sendCode,
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
