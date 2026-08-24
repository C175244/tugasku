// Detail kelas: kode room, anggota, jadwal, dan komentar kelas.
import { el } from '../utils/dom.js';
import { header } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { scheduleView } from './scheduleView.js';
import {
  listMembers,
  getClassRole,
  setMemberRole,
  leaveClass,
  kickMember,
  listBans,
  createRejoinCode,
  liftBan,
} from '../api/classes.js';
import { deleteClass } from '../api/destructive.js';
import {
  listClassComments,
  addClassComment,
  deleteComment,
} from '../api/comments.js';
import { toast } from '../components/toast.js';
import { openDestructiveDialog, openModal } from '../components/modal.js';
import { commentField, commentGuard } from '../components/commentGuard.js';
import { relativeTime } from '../utils/datetime.js';
import {
  isAdminOrHigher,
  isOwnerOrDeveloper,
  roleLabel,
  roleRank,
} from '../utils/roles.js';

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
  const roleResult = previewData
    ? { data: previewData.role || 'member' }
    : await getClassRole(classItem.id);
  const viewerRole = roleResult.data || 'member';
  const canManage = isAdminOrHigher(viewerRole);
  const canManageMembers = isOwnerOrDeveloper(viewerRole);
  const commentsResult = previewData
    ? { data: previewData.comments || [] }
    : await listClassComments(classItem.id);
  const comments = commentsResult.data || [];
  const bansResult = previewData || !canManage
    ? { data: [] }
    : await listBans(classItem.id);
  const bans = bansResult.data || [];
  const commentList = el('div', { class: 'stack' });
  const renderComments = () => {
    commentList.replaceChildren();
    comments.forEach((comment) => {
      const own = comment.user_id === user.id;
      commentList.append(el('article', { class: 'comment glass' },
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
        (own || isOwnerOrDeveloper(viewerRole)) && el(
          'div',
          { class: 'comment-actions' },
          el('button', {
            class: 'btn btn-danger-outline small',
            type: 'button',
            onclick: async () => {
              const result = await deleteComment('class_comments', comment.id);
              if (result.error) toast(result.error.message, 'error');
              else onChanged?.();
            },
          }, 'Hapus'),
        ),
      ));
    });
  };
  renderComments();

  const commentField_ = commentField('Tulis pesan untuk kelas...');
  const commentInput = commentField_.input;
  const guard = commentGuard();
  const commentForm = el('form', {
    class: 'stack',
    onsubmit: async (event) => {
      event.preventDefault();
      if (!commentInput.value.trim()) return;
      if (!await guard.beforeSend()) return;
      const result = await addClassComment(
        classItem.id,
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
  commentField_.counter,
  guard.node);

  const openKickDialog = (member) => {
    const reason = el('textarea', {
      rows: '3',
      maxlength: '500',
      placeholder: 'Alasan dikeluarkan (boleh dikosongkan)',
    });
    const form = el('form', {
      class: 'stack',
      onsubmit: async (event) => {
        event.preventDefault();
        const result = await kickMember(
          classItem.id,
          member.user_id,
          reason.value.trim() || null,
        );
        if (result.error) {
          toast(result.error.message, 'error');
          return;
        }
        toast(`@${member.username || 'Pengguna'} dikeluarkan dari kelas.`);
        document.querySelector('.modal-backdrop')?.remove();
        onChanged?.();
      },
    },
    el('p', { class: 'muted small' },
      'Pengguna ini tidak bisa masuk lagi ke kelas ini sampai kamu memberinya kode join ulang sekali pakai.'),
    el('div', { class: 'field' }, el('label', {}, 'Alasan (opsional)'), reason),
    el('button', { class: 'btn btn-danger-outline', type: 'submit' },
      'Keluarkan dari kelas'),
    );
    openModal(`Keluarkan @${member.username || 'pengguna'}?`, form);
  };

  const viewerLevel = roleRank(viewerRole);
  const canKick = (member) => {
    if (viewerLevel < 1 || member.user_id === user.id) return false;
    if (viewerRole === 'developer') return true;
    if (member.user_id === classItem.owner_id) return false;
    const targetLevel = roleRank(member.role);
    if (viewerLevel === 1) return targetLevel <= 1;
    return targetLevel <= 2;
  };

  const roleButtonFor = (member) => {
    if (member.user_id === user.id) return null;
    if (member.role === 'owner' || member.role === 'developer') return null;
    if (viewerRole === 'admin') {
      return member.role === 'member' && el('button', {
        class: 'btn btn-soft',
        type: 'button',
        onclick: async () => {
          const result = await setMemberRole(classItem.id, member.user_id, 'admin');
          if (result.error) toast(result.error.message, 'error');
          else onChanged?.();
        },
      }, 'Jadikan admin');
    }
    if (canManageMembers) {
      return el('button', {
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
      }, member.role === 'admin' ? 'Turunkan' : 'Jadikan admin');
    }
    return null;
  };

  const memberList = el('div', { class: 'stack' },
    ...members.map((member) => el('div', { class: 'row space panel glass' },
      el('div', {},
        el('strong', {},
          `@${member.username || member.full_name || 'Pengguna'}`,
        ),
        el('span', {
          class: `badge role-badge role-${member.role || 'member'}`,
        }, roleLabel(member.role)),
      ),
      el('div', { class: 'row' },
        roleButtonFor(member),
        viewerRole === 'developer'
        && member.user_id !== user.id
        && member.role !== 'owner'
        && el('button', {
          class: 'btn btn-soft',
          type: 'button',
          onclick: async () => {
            const result = await setMemberRole(
              classItem.id,
              member.user_id,
              'owner',
            );
            if (result.error) toast(result.error.message, 'error');
            else onChanged?.();
          },
        }, 'Jadikan owner'),
        canKick(member) && el('button', {
          class: 'btn btn-danger-outline small',
          type: 'button',
          onclick: () => openKickDialog(member),
        }, 'Keluarkan'),
      ),
    )),
  );

  const banList = el('div', { class: 'stack' },
    ...bans.map((ban) => {
      const codeBox = el('span', { class: 'row' });
      const showCode = (code, expiresAt) => {
        codeBox.replaceChildren(
          el('strong', { class: 'room-code' }, code),
          el('button', {
            class: 'btn btn-soft small',
            type: 'button',
            onclick: () => navigator.clipboard?.writeText(code),
          }, 'Salin'),
          expiresAt && el('span', { class: 'muted small' },
            `Berlaku sampai ${new Date(expiresAt).toLocaleString('id-ID')}`),
        );
      };
      if (ban.active_code) showCode(ban.active_code, ban.code_expires_at);
      return el('div', { class: 'row space panel glass' },
        el('div', {},
          el('strong', {}, `@${ban.username || ban.full_name || 'Pengguna'}`),
          el('p', { class: 'muted small' },
            ban.reason || 'Tanpa alasan'),
          el('span', { class: 'muted small' },
            `Dikeluarkan oleh @${ban.kicked_by_username || 'pengurus'} · ${relativeTime(ban.created_at)}`),
          codeBox,
        ),
        el('div', { class: 'row' },
          el('button', {
            class: 'btn btn-soft small',
            type: 'button',
            onclick: async () => {
              const result = await createRejoinCode(classItem.id, ban.user_id);
              if (result.error) toast(result.error.message, 'error');
              else showCode(result.data, null);
            },
          }, 'Buat kode join ulang'),
          el('button', {
            class: 'btn btn-danger-outline small',
            type: 'button',
            onclick: async () => {
              const result = await liftBan(classItem.id, ban.user_id);
              if (result.error) toast(result.error.message, 'error');
              else onChanged?.();
            },
          }, 'Cabut blokir'),
        ),
      );
    }),
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
  const deleteClassButton = canManageMembers && el('button', {
    class: 'btn btn-danger-outline delete-class-button',
    type: 'button',
    onclick: () => openDestructiveDialog({
      title: 'Hapus kelas ini?',
      consequence: 'Seluruh jadwal, tugas, komentar, dan lampiran kelas ini akan dihapus permanen dan tidak bisa dikembalikan.',
      actionLabel: 'Hapus kelas',
      onConfirm: async () => {
        const result = previewData?.onDeleteClass
          ? await previewData.onDeleteClass(classItem.id)
          : await deleteClass(classItem.id);
        if (result?.error) return result;
        toast('Kelas berhasil dihapus.');
        location.hash = '#/kelas';
        return result;
      },
    }),
  }, 'Hapus kelas');

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
        deleteClassButton,
      ),
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Jadwal'),
      scheduleView({
        classId: classItem.id,
        schedules,
        isAdmin: canManage,
        onChanged,
      }),
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, `Anggota (${members.length})`),
      memberList,
    ),
    canManage && bans.length > 0 && el('section', { class: 'panel glass' },
      el('h2', {}, `Diblokir dari kelas (${bans.length})`),
      el('p', { class: 'muted small' },
        'Pengguna ini tidak bisa masuk kembali tanpa kode join ulang sekali pakai.'),
      banList,
    ),
    el('section', { class: 'panel glass' },
      el('h2', {}, 'Obrolan kelas'),
      canManage
        ? commentForm
        : el('p', { class: 'member-notice muted' },
          'Hanya admin yang bisa menulis komentar.',
        ),
      commentList,
    ),
    bottomNav('kelas'),
  );
};
