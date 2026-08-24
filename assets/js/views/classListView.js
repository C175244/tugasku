// Daftar kelas serta dialog untuk membuat atau bergabung ke kelas.
import { el } from '../utils/dom.js';
import { header } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { createClass, joinClass, myKickNotices } from '../api/classes.js';
import { relativeTime } from '../utils/datetime.js';

export const classListView = async ({ classes, onChanged, previewData = null }) => {
  const noticesResult = previewData
    ? { data: previewData.kickNotices || [] }
    : await myKickNotices();
  const kickNotices = noticesResult.data || [];
  const cards = classes.map((item) => el(
      'a',
      {
        class: 'panel glass class-card',
        href: `#/kelas/${item.id}`,
      },
    el('div', { class: 'section-heading' },
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
    const rejoinCode = el('input', {
      maxlength: '8',
      placeholder: 'Kode join ulang (jika pernah dikeluarkan)',
      style: 'text-transform:uppercase',
    });
    const form = el(
      'form',
      {
        class: 'stack',
        onsubmit: async (event) => {
          event.preventDefault();
          const { error } = await joinClass(
            code.value,
            rejoinCode.value.trim() || null,
          );
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
      el('div', { class: 'field' },
        el('label', {}, 'Kode join ulang (opsional)'),
        rejoinCode,
        el('p', { class: 'muted small' },
          'Hanya diisi bila kamu pernah dikeluarkan dari kelas ini.'),
      ),
      el('button', {
        class: 'btn btn-primary',
        type: 'submit',
      }, 'Gabung'),
    );
    openModal('Gabung kelas', form);
  };

  const kickNoticePanel = kickNotices.length > 0 && el(
    'section',
    { class: 'panel glass' },
    el('h2', {}, 'Riwayat dikeluarkan'),
    el('div', { class: 'stack' },
      ...kickNotices.map((notice) => el('div', { class: 'panel glass' },
        el('div', { class: 'row space' },
          el('strong', {}, notice.class_name || 'Kelas terhapus'),
          el('span', { class: 'muted small' }, relativeTime(notice.created_at)),
        ),
        el('p', { class: 'muted small' },
          `Alasan: ${notice.reason || 'Tidak ada alasan yang diberikan.'}`),
        el('p', { class: 'muted small' },
          `Dikeluarkan oleh @${notice.kicked_by_username || 'pengurus'}. `
          + 'Minta kode join ulang ke admin/owner kelas untuk masuk kembali.'),
      )),
    ),
  );

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
    kickNoticePanel,
    bottomNav('kelas'),
  );
};
