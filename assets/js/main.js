// Entry point TugasKu: memuat data, memilih route, dan merender view.
import { getConfig } from './config.js';
import { applyTheme } from './theme.js';
import { getSession, onAuthChange, signOut } from './api/auth.js';
import { getProfile } from './api/profile.js';
import { listClasses, getClassRole } from './api/classes.js';
import { listSchedules } from './api/schedules.js';
import { listTasks, cleanupTasks } from './api/tasks.js';
import { listProgress } from './api/progress.js';
import { setState, store, setProgress } from './store.js';
import { route } from './router.js';
import { setHead } from './components/head.js';
import { loader } from './components/loader.js';
import { toast } from './components/toast.js';
import { setupView } from './views/setupView.js';
import { authView, resetSessionView, accessCodeView } from './views/authView.js';
import { dashboardView } from './views/dashboardView.js';
import { historyView } from './views/historyView.js';
import { classListView } from './views/classListView.js';
import { classDetailView } from './views/classDetailView.js';
import { taskFormView } from './views/taskFormView.js';
import { taskDetailView } from './views/taskDetailView.js';
import { profileView } from './views/profileView.js';
import {
  announcementView,
  showLatestAnnouncement,
} from './views/announcementView.js';
import { listAnnouncements } from './api/announcements.js';
import { startRealtime } from './realtime.js';
import { isDeveloper, listDeveloperClasses } from './api/developer.js';
import { myBanStatus } from './api/moderation.js';
import { isAdminOrHigher } from './utils/roles.js';

applyTheme();
const app = document.querySelector('#app');
let stopRealtime = () => {};
let renderGeneration = 0;
let renderedUserId = null;

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

const bannedView = (status) => {
  const panel = document.createElement('section');
  panel.className = 'panel glass stack';
  const title = document.createElement('h1');
  title.textContent = 'Akun kamu diblokir';
  const reason = document.createElement('p');
  reason.textContent = status.expires_at
    ? `Suspensi sampai ${new Date(status.expires_at).toLocaleString('id-ID')}.`
    : 'Pemblokiran ini bersifat permanen.';
  const detail = document.createElement('p');
  detail.className = 'muted';
  detail.textContent = status.reason
    ? `Alasan: ${status.reason}`
    : 'Tidak ada alasan yang diberikan.';
  const logout = document.createElement('button');
  logout.className = 'btn btn-soft';
  logout.type = 'button';
  logout.textContent = 'Keluar';
  logout.onclick = async () => {
    await signOut();
    location.hash = '#/auth/signin';
  };
  panel.append(title, reason, detail, logout);
  const main = document.createElement('main');
  main.className = 'shell center';
  main.append(panel);
  return main;
};

const loadClassData = async (classes) => {
  const results = await Promise.all(classes.map(async (classItem) => {
    const [scheduleResult, roleResult] = await Promise.all([
      listSchedules(classItem.id),
      getClassRole(classItem.id),
    ]);
    return {
      schedules: scheduleResult.data || [],
      role: roleResult.data || 'member',
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
  const generation = ++renderGeneration;
  const isCurrent = () => generation === renderGeneration;
  const previousStopRealtime = stopRealtime;
  stopRealtime = () => {};
  previousStopRealtime();
  app.replaceChildren(loader());
  const config = getConfig();
  if (!config.url || !config.anonKey) {
    renderedUserId = null;
    setHead('Setup');
    app.replaceChildren(setupView(() => location.reload()));
    return;
  }

  const session = await getSession();
  if (!isCurrent()) return;
  // Pengguna yang menekan link recovery dari email diarahkan ke sini.
  const incoming = route();
  if (incoming.name === 'auth' && incoming.id === 'reset') {
    renderedUserId = null;
    setHead('Pasang password');
    app.replaceChildren(resetSessionView());
    return;
  }
  if (!session) {
    renderedUserId = null;
    const current = route();
    // Login via kode akses (nama lengkap + kode + password) untuk akun massal.
    if (current.id === 'kode') {
      setHead('Masuk dengan kode akses');
      app.replaceChildren(accessCodeView(() => {
        location.hash = '#/dashboard';
        render();
      }));
      return;
    }
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
    if (!isCurrent()) return;
    if (!profile) {
      signOut().catch(() => {});
      renderedUserId = null;
      toast('Sesi kamu sudah tidak berlaku, silakan masuk lagi.', 'error');
      location.hash = '#/auth/signin';
      return;
    }
    const banResult = await myBanStatus();
    if (!isCurrent()) return;
    if (banResult.data?.banned) {
      renderedUserId = null;
      setHead('Akun diblokir');
      app.replaceChildren(bannedView(banResult.data));
      return;
    }
    const classes = classesResult.data || [];
    const classData = await loadClassData(classes);
    if (!isCurrent()) return;
    const tasksResult = await Promise.all(
      classes.map((classItem) => listTasks(classItem.id)),
    );
    if (!isCurrent()) return;
    const tasks = enrichTasks(
      tasksResult.flatMap((result) => result.data || []),
      classData.schedules,
    );
    const progressResult = await Promise.all(
      classes.map((classItem) => listProgress(classItem.id)),
    );
    if (!isCurrent()) return;
    store.user = session.user;
    store.profile = profile;
    store.classes = classData.roleClasses;
    store.schedules = classData.schedules;
    store.tasks = tasks;
    setState({});
    setProgress(progressResult.flatMap((result) => result.data || []));
    const realtimeStop = startRealtime(
      session.user,
      classes.map((item) => item.id),
      () => render(),
    );
    if (!isCurrent()) {
      realtimeStop();
      return;
    }
    stopRealtime = realtimeStop;
    if (localStorage.getItem('tugasku.cleanup90') === 'true') {
      cleanupTasks().catch(() => {});
    }
    // Popup pengumuman terbaru (hanya yang pinned atau lebih baru daripada
    // akun dibuat) untuk semua pengguna.
    showLatestAnnouncement(profile).catch(() => {});
    // Tur aplikasi yang tidak dibutuhkan lagi.

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
      view = await classListView(common);
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
      const canEdit = isAdminOrHigher(classItem?.role)
        || task.created_by === session.user.id;
      if (!canEdit) throw new Error('Kamu tidak punya izin mengedit tugas ini.');
      view = taskFormView({
        ...common,
        task,
        isAdmin: isAdminOrHigher(classItem?.role),
      });
    } else if (current.name === 'tugas' && current.id) {
      const task = tasks.find((item) => item.id === current.id);
      if (!task) throw new Error('Tugas tidak ditemukan');
      view = await taskDetailView({ ...common, task });
    } else if (current.name === 'riwayat') {
      view = historyView(common);
    } else if (current.name === 'pengumuman') {
      const announcementResult = await listAnnouncements();
      if (!isCurrent()) return;
      if (announcementResult.error) throw announcementResult.error;
      view = announcementView({ announcements: announcementResult.data || [] });
    } else if (current.name === 'profil') {
      const developerResult = await isDeveloper();
      if (developerResult.error) throw developerResult.error;
      const developerData = {
        isDeveloper: Boolean(developerResult.data),
        classes: [],
      };
      if (developerData.isDeveloper) {
        const overviewResult = await listDeveloperClasses();
        if (overviewResult.error) throw overviewResult.error;
        developerData.classes = overviewResult.data || [];
      }
      view = await profileView({ ...common, developerData });
    } else {
      view = dashboardView(common);
    }
    if (!isCurrent()) return;
    setHead(current.name);
    app.replaceChildren(view);
    renderedUserId = session.user.id;
  } catch (error) {
    if (!isCurrent()) return;
    setHead('Ada masalah');
    app.replaceChildren(errorView(error));
  }
};

onAuthChange?.((event, session) => {
  setTimeout(() => {
    // Sesi recovery dibuat saat pengguna menekan link di email reset.
    if (event === 'PASSWORD_RECOVERY') {
      location.hash = '#/auth/reset';
      render();
      return;
    }
    const userId = session?.user?.id || null;
    if (userId === renderedUserId) return;
    render();
  }, 0);
});
window.addEventListener('hashchange', render);
// Dipicu dari layar lain (misalnya verifikasi Google di alur daftar).
window.addEventListener('tugasku:render', render);
render();
