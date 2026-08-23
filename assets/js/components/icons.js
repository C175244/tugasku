// Kumpulan ikon SVG inline agar aplikasi tidak bergantung pada CDN ikon.
import { el } from '../utils/dom.js';

const paths = {
  home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  class: 'M4 4h16v16H4z M8 8h3v3H8z M13 8h3v3h-3z M8 13h3v3H8z M13 13h3v3h-3z',
  history: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  moon: 'M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z',
  sun: 'M12 3v2m0 14v2M3 12h2m14 0h2m-3.36-6.36 1.42-1.42M5.94 18.06l1.42-1.42m0-9.98L5.94 5.94m12.12 12.12-1.42-1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
};

export const icon = (name, label = '') => {
  const svg = el('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'aria-hidden': label ? 'false' : 'true',
    role: label ? 'img' : null,
  });
  if (label) svg.setAttribute('aria-label', label);
  svg.append(el('path', {
    d: paths[name] || paths.home,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));
  return svg;
};
