// Detail tugas, status pribadi, lampiran, komentar, dan tombol edit.
import { el } from '../utils/dom.js';
import { header } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { countdown } from '../components/countdown.js';
import { formatDeadline, DAY_NAMES, relativeTime } from '../utils/datetime.js';
import { upsertProgress } from '../api/progress.js';
import { deleteTask } from '../api/tasks.js';
import {
  listFiles,
  signedUrl,
  uploadFile,
  deleteFile,
} from '../api/files.js';
import {
  listTaskComments,
  addTaskComment,
  deleteComment,
} from '../api/comments.js';
import { getClassRole } from '../api/classes.js';
import { commentGuard } from '../components/commentGuard.js';
import { toast } from '../components/toast.js';
import { progressFor } from '../store.js';
import { formatBytes, titleCase } from '../utils/format.js';
import {
  isAdminOrHigher,
  isOwnerOrDeveloper,
  roleLabel,
} from '../utils/roles.js';

export const taskDetailView = async ({
  task,
  user,
  classes,
  onChanged,
  previewData = null,
}) => {
  const classItem = classes.find((item) => item.id === task.class_id);
  const roleResult = previewData
    ? { data: previewData.role || 'member' }
    : await getClassRole(task.class_id);
  const viewerRole = roleResult.data || 'member';
  const canManage = isAdminOrHigher(viewerRole);
  const canEdit = canManage || task.created_by === user.id;
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
      const [openLink, downloadLink] = previewData
        ? [
          { data: { signedUrl: file.preview_url } },
          { data: { signedUrl: file.preview_url } },
        ]
        : await Promise.all([
          signedUrl(file.storage_path),
          signedUrl(file.storage_path, 3600, file.file_name),
        ]);
      const signedOpenUrl = openLink.data?.signedUrl || '#';
      const isMedia = /^(image|video)\//.test(file.mime_type || '');
      const mediaPreview = isMedia
      && (file.mime_type || '').startsWith('image/')
        ? el('img', {
          class: 'file-preview',
          src: signedOpenUrl,
          alt: file.file_name,
          loading: 'lazy',
        })
        : isMedia && el('video', {
          class: 'file-preview',
          src: signedOpenUrl,
          controls: true,
          preload: 'metadata',
        });
      const fileExtension = file.file_name?.includes('.')
        ? file.file_name.split('.').pop().slice(0, 6).toUpperCase()
        : 'FILE';
      fileList.append(el('article', { class: 'file-item' },
        mediaPreview || el(
          'span',
          { class: 'file-type-marker', 'aria-label': `Tipe file ${fileExtension}` },
          fileExtension,
        ),
        el('div', { class: 'file-meta' },
          el('strong', {}, file.file_name),
          el('span', { class: 'muted small' },
            `Diunggah oleh ${file.username || file.full_name || 'Pengguna'}`,
          ),
          el('span', { class: 'muted small' },
            file.mime_type || 'Lampiran',
          ),
          el('span', { class: 'muted small' },
            formatBytes(file.size_bytes),
          ),
        ),
        el('div', { class: 'row file-actions' },
          el('a', {
            class: 'btn btn-soft small',
            href: signedOpenUrl,
            target: '_blank',
            rel: 'noreferrer',
          }, 'Buka'),
          el('a', {
            class: 'btn btn-soft small',
            href: downloadLink.data?.signedUrl || '#',
            download: file.file_name,
          }, 'Unduh'),
          (file.uploader_id === user.id || isOwnerOrDeveloper(viewerRole))
          && el('button', {
            class: 'btn btn-danger-outline',
            type: 'button',
            onclick: async () => {
              const result = await deleteFile(file);
              if (result.error) toast(result.error.message, 'error');
              else onChanged?.();
            },
          }, 'Hapus'),
        ),
      ));
    }
  };
  const renderComments = () => {
    commentList.replaceChildren();
    comments.forEach((comment) => commentList.append(
      el('article', { class: 'comment glass' },
        el('div', { class: 'row space' },
          el('div', { class: 'comment-author' },
            el('strong', {},
              `@${comment.username || comment.full_name || 'Pengguna'}`,
            ),
            el('span', {
              class: `badge role-badge role-${comment.author_role || 'member'}`,
            }, roleLabel(comment.author_role)),
          ),
          el('span', { class: 'muted small' },
            relativeTime(comment.created_at),
          ),
        ),
        el('p', {}, comment.body),
        (comment.user_id === user.id || isOwnerOrDeveloper(viewerRole))
        && el('div', { class: 'comment-actions' },
          el('button', {
            class: 'btn btn-danger-outline small',
            type: 'button',
            onclick: async () => {
              const result = await deleteComment('task_comments', comment.id);
              if (result.error) toast(result.error.message, 'error');
              else onChanged?.();
            },
          }, 'Hapus'),
        ),
      ),
    ));
  };
  await renderFiles();
  renderComments();

  const currentStatus = el('button', {
    class: `btn ${status === 'done' ? 'btn-soft' : 'btn-primary'}`,
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
  const guard = commentGuard();
  const commentForm = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      if (!commentInput.value.trim()) return;
      if (!await guard.beforeSend()) return;
      const result = await addTaskComment(
        task.id,
        task.class_id,
        user.id,
        commentInput.value.trim(),
      );
      if (result.error) toast(result.error.message, 'error');
      else {
        guard.onSent();
        onChanged?.();
      }
    },
  },
  el('div', { class: 'row' },
    commentInput,
    el('button', {
      class: 'btn btn-primary',
      type: 'submit',
    }, 'Kirim'),
  ),
  guard.node);

  const actions = el('div', { class: 'row' },
    currentStatus,
    canEdit && el('a', {
      class: 'btn btn-soft',
      href: `#/tugas/${task.id}/edit`,
    }, 'Edit'),
    canEdit && el('button', {
      class: 'btn btn-danger-outline',
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
      canManage && filePicker,
      canManage && input,
      fileList,
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Komentar'),
      canManage
        ? commentForm
        : el('p', { class: 'member-notice muted' },
          'Hanya admin yang bisa menulis komentar.',
        ),
      commentList,
    ),
    bottomNav('dashboard'),
  );
};
