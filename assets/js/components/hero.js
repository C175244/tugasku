// Sapaan singkat dan ajakan membuat kelas di beranda.
import { el } from '../utils/dom.js';

export const hero = (profile, classes) => el(
  'section',
  { class: 'hero glass panel' },
  el('p', { class: 'eyebrow' }, 'Halo, teman!'),
  el('h1', {}, `Hai, ${profile?.full_name || profile?.username || 'Bayu'} 👋`),
  el('p', { class: 'muted' },
    classes.length
      ? `Kamu punya ${classes.length} kelas di TugasKu.`
      : 'Yuk buat atau gabung kelas pertama kamu.',
  ),
  !classes.length && el(
    'a',
    { class: 'btn btn-primary', href: '#/kelas' },
    'Mulai dari Kelas',
  ),
);
