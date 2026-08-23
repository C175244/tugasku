// Daftar kelas serta dialog untuk membuat atau bergabung ke kelas.
import { el } from '../utils/dom.js';
import { header } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { createClass, joinClass } from '../api/classes.js';

export const classListView = ({ classes, onChanged }) => {
  const cards = classes.map((item) => el(
    'a',
    {
      class: 'panel glass',
      href: `#/kelas/${item.id}`,
      style: 'text-decoration:none;color:var(--text)',
    },
    el('div', { class: 'row space' },
      el('h3', {}, item.name),
      el('span', { class: 'badge' }, item.room_code),
    ),
    el('p', { class: 'muted small' },
      'Buka kelas untuk tugas, jadwal, dan obrolan.',
    ),
  ));

  const openCreate = () => {
    const name = el('input', {
      required: true,
      placeholder: 'Contoh: XI IPA 1',
    });
    const form = el(
      'form',
      {
        class: 'stack',
        onsubmit: async (event) => {
          event.preventDefault();
          const { error } = await createClass(name.value);
          if (error) {
            toast(error.message, 'error');
            return;
          }
          toast('Kelas berhasil dibuat.');
          onChanged?.();
          document.querySelector('.modal-backdrop')?.remove();
        },
      },
      el('div', { class: 'field' },
        el('label', {}, 'Nama kelas'),
        name,
      ),
      el('button', {
        class: 'btn btn-primary',
        type: 'submit',
      }, 'Buat kelas'),
    );
    openModal('Buat kelas baru', form);
  };

  const openJoin = () => {
    const code = el('input', {
      required: true,
      maxlength: '6',
      placeholder: 'ABC123',
      style: 'text-transform:uppercase',
    });
    const form = el(
      'form',
      {
        class: 'stack',
        onsubmit: async (event) => {
          event.preventDefault();
          const { error } = await joinClass(code.value);
          if (error) {
            toast(error.message, 'error');
            return;
          }
          toast('Berhasil gabung kelas.');
          onChanged?.();
          document.querySelector('.modal-backdrop')?.remove();
        },
      },
      el('div', { class: 'field' },
        el('label', {}, 'Kode room 6 karakter'),
        code,
      ),
      el('button', {
        class: 'btn btn-primary',
        type: 'submit',
      }, 'Gabung'),
    );
    openModal('Gabung kelas', form);
  };

  return el(
    'main',
    { class: 'shell' },
    header({ title: 'Kelas' }),
    el('div', { class: 'row space' },
      el('div', {},
        el('p', { class: 'eyebrow' }, 'Ruang belajar'),
        el('h1', {}, 'Kelas kamu'),
      ),
      el('div', { class: 'row' },
        el('button', {
          class: 'btn btn-primary',
          type: 'button',
          onclick: openCreate,
        }, '+ Buat'),
        el('button', {
          class: 'btn btn-soft',
          type: 'button',
          onclick: openJoin,
        }, 'Gabung'),
      ),
    ),
    el(
      'section',
      { class: 'content' },
      ...(cards.length
        ? cards
        : [el('div', { class: 'panel glass' },
          'Belum ada kelas. Buat atau gabung sekarang, yuk!',
        )]),
    ),
    bottomNav('kelas'),
  );
};
