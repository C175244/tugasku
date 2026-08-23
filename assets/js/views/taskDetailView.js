// Detail tugas, status pribadi, lampiran, komentar, dan tombol edit.
import { el } from '../utils/dom.js';
import { header } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { countdown } from '../components/countdown.js';
import { formatDeadline, DAY_NAMES, relativeTime } from '../utils/datetime.js';
import { upsertProgress } from '../api/progress.js';
import { deleteTask } from '../api/tasks.js';
import { listFiles, signedUrl, uploadFile, deleteFile } from '../api/files.js';
import {
  listTaskComments,
  addTaskComment,
  deleteComment,
} from '../api/comments.js';
import { listMembers } from '../api/classes.js';
import { toast } from '../components/toast.js';
import { progressFor } from '../store.js';
import { titleCase } from '../utils/format.js';

export const taskDetailView = async ({
  task,
  user,
  classes,
  onChanged,
  previewData = null,
}) => {
  const classItem = classes.find((item) => item.id === task.class_id);
  const membersResult = previewData
    ? { data: previewData.members || [] }
    : await listMembers(task.class_id);
  const members = membersResult.data || [];
  const isAdmin = members.some(
    (member) => member.user_id === user.id && member.role === 'admin',
  );
  const canEdit = isAdmin || task.created_by === user.id;
  const filesResult = previewData
    ? { data: previewData.files || [] }
    : await listFiles(task.id);
  const commentsResult = previewData
    ? { data: previewData.comments || [] }
    : await listTaskComments(task.id);
  const files = filesResult.data || [];
  const comments = commentsResult.data || [];
  const status = progressFor(task.id);
  const scheduleLabel = task.deadline_mode === 'next_subject'
    && task.schedule_day != null
    ? `Sampai pelajaran ${task.subject || 'berikutnya'} `
      + `(${DAY_NAMES[task.schedule_day]})`
    : null;
  const fileList = el('div', { class: 'stack' });
  const commentList = el('div', { class: 'stack' });
  const renderFiles = async () => {
    fileList.replaceChildren();
    for (const file of files) {
      const link = await signedUrl(file.storage_path);
      fileList.append(el('div', { class: 'row space panel glass' },
        el('a', {
          href: link.data?.signedUrl || '#',
          target: '_blank',
          rel: 'noreferrer',
        }, file.file_name),
        file.uploader_id === user.id && el('button', {
          class: 'btn btn-soft',
          type: 'button',
          onclick: async () => {
            const result = await deleteFile(file);
            if (result.error) toast(result.error.message, 'error');
            else onChanged?.();
          },
        }, 'Hapus'),
      ));
    }
  };
  const renderComments = () => {
    commentList.replaceChildren();
    comments.forEach((comment) => commentList.append(
      el('article', { class: 'comment glass' },
        el('div', { class: 'row space' },
          el('strong', {}, '@Teman'),
          el('span', { class: 'muted small' },
            relativeTime(comment.created_at),
          ),
        ),
        el('p', {}, comment.body),
        comment.user_id === user.id && el('button', {
          class: 'btn btn-soft small',
          type: 'button',
          onclick: async () => {
            const result = await deleteComment('task_comments', comment.id);
            if (result.error) toast(result.error.message, 'error');
            else onChanged?.();
          },
        }, 'Hapus'),
      ),
    ));
  };
  await renderFiles();
  renderComments();

  const currentStatus = el('button', {
    class: `btn ${status === 'done' ? 'btn-success' : 'btn-danger'}`,
    type: 'button',
    onclick: async () => {
      const next = progressFor(task.id) === 'done' ? 'pending' : 'done';
      const result = await upsertProgress(
        task.id,
        task.class_id,
        user.id,
        next,
        null,
      );
      if (result.error) toast(result.error.message, 'error');
      else onChanged?.();
    },
  }, status === 'done' ? 'Tandai belum selesai' : 'Tandai selesai');

  const fileInputId = `file-input-${task.id}`;
  const input = el('input', {
    id: fileInputId,
    class: 'file-input',
    type: 'file',
    onchange: async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        await uploadFile(file, task.class_id, task.id, user.id);
        toast('Lampiran diunggah.');
        onChanged?.();
      } catch (error) {
        toast(error.message, 'error');
      }
    },
  });
  const filePicker = el(
    'label',
    { class: 'btn btn-soft', for: fileInputId },
    'Pilih lampiran',
  );
  const commentInput = el('textarea', {
    rows: '2',
    placeholder: 'Tulis komentar...',
  });
  const commentForm = el('form', {
    class: 'row',
    onsubmit: async (event) => {
      event.preventDefault();
      if (!commentInput.value.trim()) return;
      const result = await addTaskComment(
        task.id,
        task.class_id,
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

  const actions = el('div', { class: 'row' },
    currentStatus,
    canEdit && el('a', {
      class: 'btn btn-soft',
      href: `#/tugas/${task.id}/edit`,
    }, 'Edit'),
    canEdit && el('button', {
      class: 'btn btn-soft',
      type: 'button',
      onclick: async () => {
        if (!confirm('Hapus tugas ini?')) return;
        const result = await deleteTask(task.id);
        if (result.error) toast(result.error.message, 'error');
        else location.hash = '#/dashboard';
      },
    }, 'Hapus'),
  );

  return el(
    'main',
    { class: 'shell task-detail-shell' },
    header({
      title: 'Detail tugas',
      back: true,
      onBack: () => { location.hash = '#/dashboard'; },
    }),
    el('article', { class: 'panel glass' },
      el('div', { class: 'row space' },
        el('div', { class: 'row' },
          el('span', { class: 'badge' }, classItem?.name || 'Kelas'),
          el('span', { class: 'badge' }, titleCase(task.task_type)),
          el('span', {
            class: `badge ${status === 'done' ? 'green' : 'red'}`,
          }, status === 'done' ? 'Sudah dikerjakan' : 'Belum dikerjakan'),
        ),
      ),
      countdown(task.deadline_at),
      el('h1', {}, task.title),
      task.description && el('p', { class: 'muted' }, task.description),
      el('p', { class: 'muted small' },
        `${task.subject || 'Tanpa mapel'} · Deadline ${formatDeadline(task.deadline_at)}`,
      ),
      scheduleLabel && el('p', { class: 'badge chip' }, scheduleLabel),
      actions,
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Lampiran'),
      filePicker,
      input,
      fileList,
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Komentar'),
      commentForm,
      commentList,
    ),
    bottomNav('dashboard'),
  );
};
