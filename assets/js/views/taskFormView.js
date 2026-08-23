// Form tambah dan edit tugas dengan dua jenis deadline.
import { el } from '../utils/dom.js';
import { nextOccurrence, toLocalInput } from '../utils/datetime.js';
import { createTask, updateTask } from '../api/tasks.js';
import { toast } from '../components/toast.js';

const TYPES = [
  'tugas',
  'pr',
  'ulangan',
  'praktik',
  'proyek',
  'presentasi',
  'catatan',
  'lainnya',
];

const PRIORITY_LABELS = {
  1: 'rendah',
  2: 'sedang',
  3: 'tinggi',
};

export const taskFormView = ({
  user,
  classes,
  schedules,
  task = null,
  isAdmin = false,
  onChanged,
}) => {
  const editing = Boolean(task);
  const classSelect = el('select', {},
    ...classes.map((item) => el(
      'option',
      {
        value: item.id,
        selected: item.id === (task?.class_id || classes[0]?.id),
      },
      item.name,
    )),
  );
  const title = el('input', {
    required: true,
    value: task?.title || '',
    placeholder: 'Contoh: Rangkuman bab 3',
  });
  const description = el('textarea', {
    rows: '4',
    placeholder: 'Catatan tambahan (opsional)',
  });
  description.value = task?.description || '';
  const subject = el('input', {
    required: true,
    value: task?.subject || '',
    list: 'subject-options',
    placeholder: 'Matematika',
  });
  const type = el('select', {},
    ...TYPES.map((item) => el(
      'option',
      { value: item, selected: item === (task?.task_type || 'tugas') },
      item,
    )),
  );
  const difficulty = el('select', {},
    ...['mudah', 'sedang', 'sulit'].map((item) => el(
      'option',
      { value: item, selected: item === (task?.difficulty || 'sedang') },
      item,
    )),
  );
  const priority = el('select', {},
    ...[1, 2, 3].map((item) => el(
      'option',
      { value: item, selected: item === (task?.priority || 2) },
      `${item} — ${PRIORITY_LABELS[item]}`,
    )),
  );
  const mode = el('select', {},
    el('option', {
      value: 'date',
      selected: (task?.deadline_mode || 'date') === 'date',
    }, 'Tanggal dan jam tertentu'),
    el('option', {
      value: 'next_subject',
      selected: task?.deadline_mode === 'next_subject',
    }, 'Sampai pelajaran berikutnya'),
  );
  const date = el('input', {
    type: 'datetime-local',
    required: true,
    value: task?.deadline_at ? toLocalInput(task.deadline_at) : '',
  });
  const schedule = el('select', {}, ...schedules
    .filter((item) => item.class_id === (task?.class_id || classes[0]?.id))
    .map((item) => el(
      'option',
      {
        value: item.id,
        selected: item.id === task?.schedule_id,
      },
      `${item.subject} · ${item.start_time.slice(0, 5)}`,
    )));
  const dateField = el('div', { class: 'field' },
    el('label', {}, 'Deadline'),
    date,
  );
  const scheduleField = el('div', { class: 'field hidden' },
    el('label', {}, 'Jadwal pelajaran'),
    schedule,
  );
  const refreshDeadlineFields = () => {
    const next = mode.value === 'next_subject';
    dateField.classList.toggle('hidden', next);
    scheduleField.classList.toggle('hidden', !next);
    date.required = !next;
    schedule.required = next;
  };
  mode.onchange = refreshDeadlineFields;
  classSelect.onchange = () => {
    const matching = schedules.filter(
      (item) => item.class_id === classSelect.value,
    );
    schedule.replaceChildren(...matching.map((item) => el(
      'option',
      { value: item.id },
      `${item.subject} · ${item.start_time.slice(0, 5)}`,
    )));
  };
  refreshDeadlineFields();

  const form = el(
    'form',
    {
      class: 'panel glass stack',
      onsubmit: async (event) => {
        event.preventDefault();
        const chosenSchedule = schedules.find(
          (item) => item.id === schedule.value,
        );
        if (mode.value === 'next_subject' && !chosenSchedule) {
          toast('Pilih jadwal pelajaran terlebih dahulu.', 'error');
          return;
        }
        const deadlineAt = mode.value === 'next_subject'
          ? nextOccurrence(
            new Date(),
            chosenSchedule.day_of_week,
            chosenSchedule.start_time,
          ).toISOString()
          : new Date(date.value).toISOString();
        const values = {
          class_id: classSelect.value,
          title: title.value.trim(),
          description: description.value.trim() || null,
          subject: subject.value.trim() || null,
          schedule_id: mode.value === 'next_subject'
            ? schedule.value
            : null,
          task_type: type.value,
          difficulty: difficulty.value,
          priority: Number(priority.value),
          deadline_mode: mode.value,
          deadline_at: deadlineAt,
        };
        const result = editing
          ? await updateTask(task.id, values)
          : await createTask({ ...values, created_by: user.id });
        if (result.error) {
          toast(result.error.message, 'error');
          return;
        }
        toast(editing ? 'Tugas diperbarui.' : 'Tugas dibuat.');
        onChanged?.();
        location.hash = editing ? `#/tugas/${task.id}` : '#/dashboard';
      },
    },
    el('div', { class: 'field' }, el('label', {}, 'Kelas'), classSelect),
    el('div', { class: 'field' }, el('label', {}, 'Judul'), title),
    el('div', { class: 'field' },
      el('label', {}, 'Deskripsi'),
      description,
    ),
    el('div', { class: 'field' }, el('label', {}, 'Mata pelajaran'), subject),
    el('datalist', { id: 'subject-options' },
      ...schedules.map((item) => el('option', { value: item.subject })),
    ),
    el('div', { class: 'grid grid-2' },
      el('div', { class: 'field' }, el('label', {}, 'Tipe'), type),
      el('div', { class: 'field' },
        el('label', {}, 'Kesulitan'),
        difficulty,
      ),
      el('div', { class: 'field' }, el('label', {}, 'Prioritas'), priority),
      el('div', { class: 'field' }, el('label', {}, 'Jenis deadline'), mode),
    ),
    dateField,
    scheduleField,
    el('div', { class: 'row' },
      el('button', {
        class: 'btn btn-primary',
        type: 'submit',
      }, editing ? 'Simpan perubahan' : 'Buat tugas'),
      el('a', {
        class: 'btn btn-soft',
        href: editing ? `#/tugas/${task.id}` : '#/dashboard',
      }, 'Batal'),
    ),
  );
  return el(
    'main',
    { class: 'shell' },
    el('a', { class: 'back-link', href: '#/dashboard' }, '‹ Kembali'),
    el('h1', {}, editing ? 'Edit tugas' : 'Tambah tugas'),
    form,
  );
};
