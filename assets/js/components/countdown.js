// Countdown bersama untuk semua kartu tugas yang sedang terpasang.
import { el } from '../utils/dom.js';

const counters = new Set();

const format = (value) => {
  const seconds = Math.max(0, Math.floor(value / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [
    `${days} hari`,
    `${String(hours).padStart(2, '0')} jam`,
    `${String(minutes).padStart(2, '0')} mnt`,
    `${String(secs).padStart(2, '0')} dtk`,
  ].join(' · ');
};

const tick = () => {
  counters.forEach((counter) => {
    if (!counter.node.isConnected && counter.wasConnected) {
      counters.delete(counter);
      return;
    }
    if (counter.node.isConnected) counter.wasConnected = true;
    // Bila ada perpanjangan: deadline aktif sudah habis → berlanjut ke
    // extension_deadline di kolom tugas.
    const effective = counter.task?.extension_deadline
      && new Date(counter.task.deadline_at).getTime() <= Date.now()
        ? counter.task.extension_deadline
        : counter.task?.deadline_at || counter.deadline;
    const diff = new Date(effective).getTime() - Date.now();
    counter.node.textContent = diff < 0
      ? 'Lewat deadline'
      : `Sisa ${format(diff)}`;
    counter.node.classList.toggle('expired', diff < 0);
  });
};

setInterval(tick, 1000);

export const countdown = (deadline, task = null) => {
  const node = el('span', {
    class: 'countdown',
    'data-deadline': deadline,
  });
  const counter = { node, deadline, task, wasConnected: false };
  counters.add(counter);
  const effective = task?.extension_deadline
    && new Date(task.deadline_at).getTime() <= Date.now()
      ? task.extension_deadline
      : deadline;
  const diff = new Date(effective).getTime() - Date.now();
  node.textContent = diff < 0
    ? 'Lewat deadline'
    : `Sisa ${format(diff)}`;
  node.classList.toggle('expired', diff < 0);
  return node;
};
