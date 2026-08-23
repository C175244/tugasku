// Entry point TugasKu: memuat data, memilih route, dan merender view.
import { getConfig } from './config.js';
import { applyTheme } from './theme.js';
import { getSession, onAuthChange } from './api/auth.js';
import { getProfile } from './api/profile.js';
import { listClasses, listMembers } from './api/classes.js';
import { listSchedules } from './api/schedules.js';
import { listTasks, cleanupTasks } from './api/tasks.js';
import { listProgress } from './api/progress.js';
import { setState, store, setProgress } from './store.js';
import { route } from './router.js';
import { setHead } from './components/head.js';
import { loader } from './components/loader.js';
import { toast } from './components/toast.js';
import { setupView } from './views/setupView.js';
import { authView } from './views/authView.js';
import { dashboardView } from './views/dashboardView.js';
import { historyView } from './views/historyView.js';
import { classListView } from './views/classListView.js';
import { classDetailView } from './views/classDetailView.js';
import { taskFormView } from './views/taskFormView.js';
import { taskDetailView } from './views/taskDetailView.js';
import { profileView } from './views/profileView.js';
import { startRealtime } from './realtime.js';

applyTheme();
const app = document.querySelector('#app');
let stopRealtime = () => {};

const errorView = (error) => {
  const retry = document.createElement('button');
  retry.className = 'btn btn-primary';
  retry.type = 'button';
  retry.textContent = 'Muat ulang';
  retry.onclick = render;
  const panel = document.createElement('section');
  panel.className = 'panel glass';
  const title = document.createElement('h1');
  title.textContent = 'Ada masalah';
  const text = document.createElement('p');
  text.className = 'error';
  text.textContent = error.message || 'Coba muat ulang halaman.';
  panel.append(title, text, retry);
  const main = document.createElement('main');
  main.className = 'shell center';
  main.append(panel);
  return main;
};

const loadClassData = async (classes, userId) => {
  const results = await Promise.all(classes.map(async (classItem) => {
    const [scheduleResult, memberResult] = await Promise.all([
      listSchedules(classItem.id),
      listMembers(classItem.id),
    ]);
    const members = memberResult.data || [];
    const current = members.find((member) => member.user_id === userId);
    return {
      schedules: scheduleResult.data || [],
      role: current?.role || 'member',
    };
  }));
  const schedules = results.flatMap((result) => result.schedules);
  const roleClasses = classes.map((classItem, index) => ({
    ...classItem,
    role: results[index].role,
  }));
  return { schedules, roleClasses };
};

const enrichTasks = (tasks, schedules) => {
  const byId = new Map(schedules.map((item) => [item.id, item]));
  return tasks.map((task) => {
    const schedule = byId.get(task.schedule_id);
    return {
      ...task,
      schedule_day: schedule?.day_of_week,
      schedule_subject: schedule?.subject,
    };
  });
};

const render = async () => {
  app.replaceChildren(loader());
  const config = getConfig();
  if (!config.url || !config.anonKey) {
    setHead('Setup');
    app.replaceChildren(setupView(() => location.reload()));
    return;
  }

  const session = await getSession();
  if (!session) {
    const current = route();
    setHead('Masuk');
    app.replaceChildren(authView(current.id || 'signin', () => {
      location.hash = '#/dashboard';
      render();
    }));
    return;
  }

  try {
    const [profile, classesResult] = await Promise.all([
      getProfile(),
      listClasses(),
    ]);
    const classes = classesResult.data || [];
    const classData = await loadClassData(classes, session.user.id);
    const tasksResult = await Promise.all(
      classes.map((classItem) => listTasks(classItem.id)),
    );
    const tasks = enrichTasks(
      tasksResult.flatMap((result) => result.data || []),
      classData.schedules,
    );
    const progressResult = await Promise.all(
      classes.map((classItem) => listProgress(classItem.id)),
    );
    store.user = session.user;
    store.profile = profile;
    store.classes = classData.roleClasses;
    store.schedules = classData.schedules;
    store.tasks = tasks;
    setState({});
    setProgress(progressResult.flatMap((result) => result.data || []));
    stopRealtime();
    stopRealtime = startRealtime(
      session.user,
      classes.map((item) => item.id),
      () => render(),
    );
    if (localStorage.getItem('tugasku.cleanup90') === 'true') {
      cleanupTasks().catch(() => {});
    }

    const current = route();
    const common = {
      profile,
      user: session.user,
      classes: classData.roleClasses,
      tasks,
      schedules: classData.schedules,
      onChanged: render,
    };
    let view;
    if (current.name === 'kelas' && current.id) {
      const classItem = classes.find((item) => item.id === current.id);
      if (!classItem) {
        toast('Kamu bukan anggota kelas itu.', 'error');
        location.hash = '#/kelas';
        return;
      }
      const schedules = classData.schedules.filter(
        (item) => item.class_id === classItem.id,
      );
      view = await classDetailView({
        ...common,
        classItem,
        schedules,
      });
    } else if (current.name === 'kelas') {
      view = classListView(common);
    } else if (current.name === 'tugas' && current.id === 'baru') {
      view = taskFormView(common);
    } else if (
      current.name === 'tugas'
      && current.id
      && current.action === 'edit'
    ) {
      const task = tasks.find((item) => item.id === current.id);
      if (!task) throw new Error('Tugas tidak ditemukan');
      const classItem = classData.roleClasses.find(
        (item) => item.id === task.class_id,
      );
      const canEdit = classItem?.role === 'admin'
        || task.created_by === session.user.id;
      if (!canEdit) throw new Error('Kamu tidak punya izin mengedit tugas ini.');
      view = taskFormView({
        ...common,
        task,
        isAdmin: classItem?.role === 'admin',
      });
    } else if (current.name === 'tugas' && current.id) {
      const task = tasks.find((item) => item.id === current.id);
      if (!task) throw new Error('Tugas tidak ditemukan');
      view = await taskDetailView({ ...common, task });
    } else if (current.name === 'riwayat') {
      view = historyView(common);
    } else if (current.name === 'profil') {
      view = profileView(common);
    } else {
      view = dashboardView(common);
    }
    setHead(current.name);
    app.replaceChildren(view);
  } catch (error) {
    setHead('Ada masalah');
    app.replaceChildren(errorView(error));
  }
};

onAuthChange?.(() => render());
window.addEventListener('hashchange', render);
render();
