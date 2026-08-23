// Riwayat tugas yang sudah melewati deadline dan penghapusan otomatis.
import { el } from '../utils/dom.js';
import { header } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { taskCard } from '../components/taskCard.js';
import { emptyState } from '../components/emptyState.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';
import { cleanupTasks, deleteTask } from '../api/tasks.js';
import { toast } from '../components/toast.js';
import { progressFor } from '../store.js';

export const historyView = ({ tasks, onChanged }) => {
  const old = tasks.filter(
    (task) => new Date(task.deadline_at) <= new Date(),
  );
  const toggle = el('input', {
    type: 'checkbox',
    checked: localStorage.getItem(STORAGE_KEYS.cleanup) === 'true',
    onchange: async () => {
      localStorage.setItem(STORAGE_KEYS.cleanup, toggle.checked);
      if (toggle.checked) {
        await cleanupTasks();
        toast('Pembersihan tugas lama dijalankan.');
        onChanged?.();
      }
    },
  });
  const list = old.length
    ? old.map((task) => el(
      'div',
      { class: 'stack' },
      taskCard(task, progressFor(task.id)),
      el('button', {
        class: 'btn btn-danger-outline',
        type: 'button',
        onclick: async () => {
          if (!confirm('Hapus tugas ini?')) return;
          const result = await deleteTask(task.id);
          if (result.error) {
            toast(result.error.message, 'error');
            return;
          }
          toast('Tugas dihapus.');
          onChanged?.();
        },
      }, 'Hapus dari riwayat'),
    ))
    : [emptyState(
      'Riwayat masih kosong',
      'Tugas yang lewat deadline akan muncul di sini.',
    )];

  return el(
    'main',
    { class: 'shell' },
    header({ title: 'Riwayat' }),
    el(
      'section',
      { class: 'panel glass' },
      el('div', { class: 'row space' },
        el('div', {},
          el('h2', {}, 'Riwayat tugas'),
          el('p', { class: 'muted small' },
            'Tugas yang deadlinenya sudah lewat.',
          ),
        ),
        el('label', { class: 'row small' },
          toggle,
          'Hapus otomatis setelah 90 hari',
        ),
      ),
      el('div', { class: 'content' }, ...list),
    ),
    bottomNav('riwayat'),
  );
};
