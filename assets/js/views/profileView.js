// Profil pengguna, avatar, daftar kelas, statistik, dan tombol keluar.
import { el } from '../utils/dom.js';
import { header, profileMenu } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { updateProfile } from '../api/profile.js';
import { signOut } from '../api/auth.js';
import { toast } from '../components/toast.js';
import { progressFor } from '../store.js';

export const profileView = ({
  profile,
  classes,
  tasks,
  user,
  onChanged,
}) => {
  const username = el('input', {
    required: true,
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
        const result = await updateProfile({
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
      location.hash = '#/masuk';
    },
  }, 'Keluar dari akun');

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
          el('span', { class: 'badge' }, item.role || 'Anggota'),
        )),
      ),
    ),
    logout,
    bottomNav('profil'),
  );
};
