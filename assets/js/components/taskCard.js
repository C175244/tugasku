// Kartu ringkas tugas dengan status pribadi dan countdown.
import { el } from '../utils/dom.js';
import { countdown } from './countdown.js';
import { formatDeadline, DAY_NAMES } from '../utils/datetime.js';
import { priorityLabel, titleCase } from '../utils/format.js';

export const taskCard = (task, status = 'pending') => {
  const diff = new Date(task.deadline_at).getTime() - Date.now();
  const near = diff > 0 && diff < 86400000;
  const scheduleLabel = task.deadline_mode === 'next_subject'
    && task.schedule_day != null
    ? `Sampai pelajaran ${task.subject || 'berikutnya'} (${DAY_NAMES[task.schedule_day]})`
    : null;
  return el(
    'article',
    {
      class: `task-card glass ${status === 'done' ? 'done' : ''} ${near ? 'near' : ''}`,
    },
    el('div', { class: 'row space' },
      el('span', {
        class: `badge ${status === 'done' ? 'green' : 'red'}`,
      }, status === 'done' ? 'Sudah dikerjakan' : 'Belum dikerjakan'),
      el('span', { class: 'badge' }, titleCase(task.task_type)),
    ),
    el('a', { href: `#/tugas/${task.id}` },
      el('h3', {}, task.title),
      task.description
        && el('p', { class: 'description muted small' }, task.description),
    ),
    scheduleLabel && el('div', { class: 'badge chip' }, scheduleLabel),
    el('div', { class: 'row space small' },
      el('span', { class: 'muted' },
        `${task.subject || 'Tanpa mapel'} · Prioritas ${priorityLabel(task.priority)}`,
      ),
      countdown(task.deadline_at, task),
    ),
    el('div', { class: 'muted small' },
      `Deadline: ${formatDeadline(task.deadline_at)}`,
    ),
  );
};
