// Footer singkat yang tampil di halaman utama.
import { el } from '../utils/dom.js';

export const footer = () => el(
  'footer',
  { class: 'center muted small' },
  'TugasKu · belajar bareng jadi lebih rapi',
);
