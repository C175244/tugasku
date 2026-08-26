// Beranda berisi tugas mendatang, status pribadi, filter, dan urutan.
import { el, clear } from '../utils/dom.js';
import { header, profileMenu } from '../components/header.js';
import { bottomNav } from '../components/navTabs.js';
import { footer } from '../components/footer.js';
import { hero } from '../components/hero.js';
import { taskCard } from '../components/taskCard.js';
import { filterBar } from '../components/filterBar.js';
import { emptyState } from '../components/emptyState.js';
import { progressFor } from '../store.js';
import {
  notifyNewTask,
  nagDeadline,
  notifOn,
  setNotifOn,
  askNotifPermission,
  notifSupported,
  notifPermission,
} from '../components/notify.js';
import { dailySchedulePanel } from '../components/dailySchedule.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

const difficultyRank = {
  mudah: 1,
  sedang: 2,
  sulit: 3,
};

const byDeadlineSoon = (a, b) => (
  new Date(a.deadline_at) - new Date(b.deadline_at)
);

const byDeadlineLate = (a, b) => byDeadlineSoon(b, a);

const byNewest = (a, b) => (
  new Date(b.created_at) - new Date(a.created_at)
);

const byDifficulty = (a, b) => (
  (difficultyRank[a.difficulty] || 2) - (difficultyRank[b.difficulty] || 2)
);

const byPriority = (a, b) => b.priority - a.priority;

const comparators = {
  deadlineSoon: byDeadlineSoon,
  deadlineLate: byDeadlineLate,
  newest: byNewest,
  easy: byDifficulty,
  hard: (a, b) => byDifficulty(b, a),
  priority: byPriority,
};

const sortTasks = (tasks, sort) => (
  [...tasks].sort(comparators[sort] || byDeadlineSoon)
);

export const dashboardView = ({
  profile,
  classes,
  tasks,
  user,
  schedules,
  onFilter,
}) => {
  const upcoming = tasks.filter(
    (task) => new Date(task.deadline_at) > new Date(),
  );
  // Checkbox notifikasi: minta izin dan simpan preferensi.
  const notifButton = el('button', {
    class: 'btn btn-soft icon-btn',
    type: 'button',
    'aria-label': 'Notifikasi tugas',
    title: 'Notifikasi tugas <12 jam & tugas baru',
  }, el('span', {}, notifOn(user.id) ? '🔔' : '🔕'));
  notifButton.addEventListener('click', async () => {
    if (notifOn(user.id)) {
      setNotifOn(user.id, false);
      notifButton.firstChild.textContent = '🔕';
      toast('Notifikasi nonaktif.');
      return;
    }
    if (notifSupported() && notifPermission() !== 'granted') {
      if (!await askNotifPermission()) {
        toast('Izin notifikasi ditolak. Aktifkan lewat setelan browser.', 'error');
        return;
      }
    }
    setNotifOn(user.id, true);
    notifButton.firstChild.textContent = '🔔';
    toast('Notifikasi aktif.');
  });
  // trigger notif untuk tugas baru dan deadline <12 jam
  if (notifOn(user.id) && notifSupported()) {
    for (const task of upcoming) {
      notifyNewTask(task, user.id);
      nagDeadline(task, user.id, progressFor(task.id));
    }
  }
  const subjects = [...new Set(
    upcoming.map((task) => task.subject).filter(Boolean),
  )];
  const list = el('section', { id: 'task-list', class: 'content' });
  const filters = filterBar({ classes, subjects }, (nextFilters) => {
    renderTasks(nextFilters);
    onFilter?.(nextFilters);
  });
  const body = el(
    'main',
    { class: 'shell' },
    header({ title: 'TugasKu' }),
    profileMenu(profile),
    hero(profile, classes),
    dailySchedulePanel(schedules),
    el('div', { class: 'section-heading' },
      el('h2', {}, 'Tugas mendatang'),
      el('div', { class: 'row' },
        notifButton,
        el('a', {
          class: 'btn btn-primary',
          href: '#/tugas/baru',
        }, '+ Tambah tugas'),
      ),
    ),
    filters,
    list,
    bottomNav('dashboard'),
    footer(),
  );

  const renderTasks = (selected = {
    classId: 'all',
    subject: 'all',
    type: 'all',
    status: 'all',
    sort: 'deadlineSoon',
  }) => {
    let shown = upcoming.filter((task) => (
      (selected.classId === 'all' || task.class_id === selected.classId)
      && (selected.subject === 'all' || task.subject === selected.subject)
      && (selected.type === 'all' || task.task_type === selected.type)
      && (selected.status === 'all'
        || progressFor(task.id) === selected.status)
    ));
    shown = sortTasks(shown, selected.sort);
    clear(list);
    if (!shown.length) {
      list.append(emptyState(
        'Tidak ada tugas yang cocok',
        'Coba ubah filter atau tambahkan tugas baru.',
      ));
      return;
    }
    shown.forEach((task) => {
      list.append(taskCard(task, progressFor(task.id)));
    });
  };

  const saved = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.filters) || 'null',
  );
  renderTasks(saved || undefined);
  return body;
};
