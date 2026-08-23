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
    const diff = new Date(counter.deadline).getTime() - Date.now();
    counter.node.textContent = diff < 0
      ? 'Lewat deadline'
      : `Sisa ${format(diff)}`;
    counter.node.classList.toggle('expired', diff < 0);
  });
};

setInterval(tick, 1000);

export const countdown = (deadline) => {
  const node = el('span', {
    class: 'countdown',
    'data-deadline': deadline,
  });
  const counter = {
    node,
    deadline,
    wasConnected: false,
  };
  counters.add(counter);
  const diff = new Date(deadline).getTime() - Date.now();
  node.textContent = diff < 0
    ? 'Lewat deadline'
    : `Sisa ${format(diff)}`;
  node.classList.toggle('expired', diff < 0);
  return node;
};
