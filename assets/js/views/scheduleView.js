// Tampilan jadwal per hari dan pengelolaan jadwal oleh admin.
import { el } from '../utils/dom.js';
import { DAY_NAMES } from '../utils/datetime.js';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '../api/schedules.js';
import { toast } from '../components/toast.js';

const scheduleForm = (item, classId, onChanged) => {
  const day = el('select', {},
    ...DAY_NAMES.map((name, index) => el(
      'option',
      { value: index, selected: item?.day_of_week === index },
      name,
    )),
  );
  const subject = el('input', {
    required: true,
    value: item?.subject || '',
    placeholder: 'Matematika',
  });
  const teacher = el('input', {
    value: item?.teacher || '',
    placeholder: 'Nama guru',
  });
  const start = el('input', {
    type: 'time',
    required: true,
    value: item?.start_time?.slice(0, 5) || '07:00',
  });
  const end = el('input', {
    type: 'time',
    required: true,
    value: item?.end_time?.slice(0, 5) || '08:30',
  });
  return el(
    'form',
    {
      class: 'grid grid-2',
      onsubmit: async (event) => {
        event.preventDefault();
        const values = {
          class_id: classId,
          day_of_week: Number(day.value),
          subject: subject.value.trim(),
          teacher: teacher.value.trim() || null,
          start_time: start.value,
          end_time: end.value,
          jam_count: 1,
        };
        const result = item
          ? await updateSchedule(item.id, values)
          : await createSchedule(values);
        if (result.error) {
          toast(result.error.message, 'error');
          return;
        }
        toast(item ? 'Jadwal diperbarui.' : 'Jadwal ditambahkan.');
        onChanged?.();
      },
    },
    el('div', { class: 'field' }, el('label', {}, 'Hari'), day),
    el('div', { class: 'field' }, el('label', {}, 'Mata pelajaran'), subject),
    el('div', { class: 'field' }, el('label', {}, 'Guru'), teacher),
    el('div', { class: 'field' }, el('label', {}, 'Mulai'), start),
    el('div', { class: 'field' }, el('label', {}, 'Selesai'), end),
    el('button', {
      class: 'btn btn-primary',
      type: 'submit',
    }, item ? 'Simpan jadwal' : 'Tambah jadwal'),
  );
};

export const scheduleView = ({
  classId,
  schedules,
  isAdmin = false,
  onChanged,
}) => {
  let selectedDay = new Date().getDay();
  const tabs = el('div', { class: 'tabs' });
  const list = el('div', { class: 'stack' });
  const render = () => {
    tabs.replaceChildren(...DAY_NAMES.map((name, index) => el(
      'button',
      {
        class: `tab ${selectedDay === index ? 'active' : ''}`,
        type: 'button',
        onclick: () => {
          selectedDay = index;
          render();
        },
      },
      name,
    )));
    list.replaceChildren();
    if (isAdmin) list.append(scheduleForm(null, classId, onChanged));
    const dayItems = schedules.filter(
      (item) => item.day_of_week === selectedDay,
    );
    if (!dayItems.length) {
      list.append(el('p', { class: 'muted' }, 'Jadwal hari ini belum diisi.'));
      return;
    }
    dayItems.forEach((item) => {
      const actions = isAdmin && el('div', { class: 'row' },
        el('button', {
          class: 'btn btn-soft',
          type: 'button',
          onclick: () => list.replaceChildren(
            scheduleForm(item, classId, onChanged),
          ),
        }, 'Edit'),
        el('button', {
          class: 'btn btn-danger-outline',
          type: 'button',
          onclick: async () => {
            if (!confirm('Hapus jadwal ini?')) return;
            const result = await deleteSchedule(item.id);
            if (result.error) toast(result.error.message, 'error');
            else onChanged?.();
          },
        }, 'Hapus'),
      );
      list.append(el('div', { class: 'panel glass row space' },
        el('div', {},
          el('strong', {}, item.subject),
          el('div', { class: 'muted small' },
            `${item.start_time.slice(0, 5)}–${item.end_time.slice(0, 5)}`
              + ` · ${item.teacher || 'Guru belum diisi'}`,
          ),
        ),
        actions,
      ));
    });
  };
  render();
  return el('div', { class: 'stack' }, tabs, list);
};
