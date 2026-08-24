// Profil pengguna, avatar, daftar kelas, statistik, dan tombol keluar.
import { el } from '../utils/dom.js';
import { header, profileMenu } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { updateProfile } from '../api/profile.js';
import { signOut } from '../api/auth.js';
import { deleteMyAccount, deleteClass } from '../api/destructive.js';
import { toast } from '../components/toast.js';
import { openDestructiveDialog } from '../components/modal.js';
import { progressFor } from '../store.js';
import { roleLabel } from '../utils/roles.js';

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
        const result = await updateProfile(user.id, {
          username: username.value.trim(),
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
