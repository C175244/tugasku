// Detail kelas: kode room, anggota, jadwal, dan komentar kelas.
import { el } from '../utils/dom.js';
import { header } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { scheduleView } from './scheduleView.js';
import { listMembers, setMemberRole, leaveClass } from '../api/classes.js';
import {
  listClassComments,
  addClassComment,
  deleteComment,
} from '../api/comments.js';
import { toast } from '../components/toast.js';
import { relativeTime } from '../utils/datetime.js';

export const classDetailView = async ({
  classItem,
  user,
  schedules,
  onChanged,
  previewData = null,
}) => {
  const memberResult = previewData
    ? { data: previewData.members || [] }
    : await listMembers(classItem.id);
  const members = memberResult.data || [];
  const current = members.find((member) => member.user_id === user.id);
  const isAdmin = current?.role === 'admin';
  const commentsResult = previewData
    ? { data: previewData.comments || [] }
    : await listClassComments(classItem.id);
  const comments = commentsResult.data || [];
  const memberNames = new Map(
    members.map((member) => [member.user_id, member.username || 'Teman']),
  );
  const commentList = el('div', { class: 'stack' });
  const renderComments = () => {
    commentList.replaceChildren();
    comments.forEach((comment) => {
      const own = comment.user_id === user.id;
      commentList.append(el('article', { class: 'comment glass' },
        el('div', { class: 'row space' },
          el('strong', {}, `@${memberNames.get(comment.user_id) || 'teman'}`),
          el('span', { class: 'muted small' },
            relativeTime(comment.created_at),
          ),
        ),
        el('p', {}, comment.body),
        (own || isAdmin) && el('button', {
          class: 'btn btn-danger-outline small',
          type: 'button',
          onclick: async () => {
            const result = await deleteComment('class_comments', comment.id);
            if (result.error) toast(result.error.message, 'error');
            else onChanged?.();
          },
        }, 'Hapus'),
      ));
    });
  };
  renderComments();

  const commentInput = el('textarea', {
    rows: '2',
    placeholder: 'Tulis pesan untuk kelas...',
  });
  const commentForm = el('form', {
    class: 'row',
    onsubmit: async (event) => {
      event.preventDefault();
      if (!commentInput.value.trim()) return;
      const result = await addClassComment(
        classItem.id,
        user.id,
        commentInput.value.trim(),
      );
      if (result.error) toast(result.error.message, 'error');
      else onChanged?.();
    },
  },
  commentInput,
  el('button', {
    class: 'btn btn-primary',
    type: 'submit',
  }, 'Kirim'));

  const memberList = el('div', { class: 'stack' },
    ...members.map((member) => el('div', { class: 'row space panel glass' },
      el('div', {},
        el('strong', {}, `@${member.username || 'teman'}`),
        el('span', {
          class: `badge ${member.role === 'admin' ? 'purple' : ''}`,
        }, member.role === 'admin' ? 'Admin' : 'Anggota'),
      ),
      isAdmin && member.user_id !== user.id && el('button', {
        class: 'btn btn-soft',
        type: 'button',
        onclick: async () => {
          const role = member.role === 'admin' ? 'member' : 'admin';
          const result = await setMemberRole(
            classItem.id,
            member.user_id,
            role,
          );
          if (result.error) toast(result.error.message, 'error');
          else onChanged?.();
        },
      }, member.role === 'admin' ? 'Turunkan' : 'Jadikan admin'),
    )),
  );

  const leave = el('button', {
    class: 'btn btn-danger-outline',
    type: 'button',
    onclick: async () => {
      if (!confirm('Keluar dari kelas ini?')) return;
      const result = await leaveClass(classItem.id);
      if (result.error) toast(result.error.message, 'error');
      else location.hash = '#/kelas';
    },
  }, 'Keluar dari kelas');

  return el(
    'main',
    { class: 'shell' },
    header({
      title: classItem.name,
      back: true,
      onBack: () => { location.hash = '#/kelas'; },
    }),
    el('section', { class: 'panel glass' },
      el('div', { class: 'row space' },
        el('div', {},
          el('p', { class: 'eyebrow' }, 'Kode room'),
          el('h1', {}, classItem.name),
        ),
        el('strong', { class: 'room-code' }, classItem.room_code),
      ),
      el('div', { class: 'row' },
        el('button', {
          class: 'btn btn-soft',
          type: 'button',
          onclick: () => navigator.clipboard?.writeText(classItem.room_code),
        }, 'Salin kode'),
        el('a', {
          class: 'btn btn-soft',
          href: `https://wa.me/?text=${encodeURIComponent(
            `Gabung kelas ${classItem.name} dengan kode ${classItem.room_code}`,
          )}`,
        }, 'Bagikan WhatsApp'),
        leave,
      ),
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Jadwal'),
      scheduleView({
        classId: classItem.id,
        schedules,
        isAdmin,
        onChanged,
      }),
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, `Anggota (${members.length})`),
      memberList,
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Obrolan kelas'),
      commentForm,
      commentList,
    ),
    bottomNav('kelas'),
  );
};
