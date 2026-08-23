// Halaman awal untuk memasukkan URL dan anon key Supabase.
import { el } from '../utils/dom.js';
import { saveConfig } from '../config.js';
import { toggleTheme, getTheme } from '../theme.js';

export const setupView = (onSave) => {
  const url = el('input', {
    type: 'url',
    placeholder: 'https://abcdefgh.supabase.co',
    required: true,
  });
  const key = el('textarea', {
    rows: '4',
    placeholder: 'eyJhbGciOiJIUzI1NiIs...',
    required: true,
  });
  const message = el('p', { class: 'error' });
  const form = el(
    'form',
    {
      class: 'stack',
      onsubmit: (event) => {
        event.preventDefault();
        if (!url.value || !key.value) return;
        saveConfig(url.value, key.value);
        onSave();
      },
    },
    el('div', { class: 'field' },
      el('label', {}, 'Project URL'),
      url,
    ),
    el('div', { class: 'field' },
      el('label', {}, 'Anon key'),
      key,
    ),
    el('p', { class: 'muted small' },
      'Anon key aman ditampilkan di aplikasi karena Row Level Security ',
      '(aturan akses di database) melindungi data. Jangan masukkan ',
      'service_role key.',
    ),
    message,
    el('button', {
      class: 'btn btn-primary wide',
      type: 'submit',
    }, 'Simpan dan mulai'),
  );
  const themeButton = el('button', {
    class: 'btn btn-soft icon-btn',
    'aria-label': 'Ganti tema',
    type: 'button',
    onclick: () => {
      toggleTheme();
      themeButton.textContent = getTheme() === 'dark' ? '☀' : '☾';
    },
  }, getTheme() === 'dark' ? '☀' : '☾');
  return el(
    'main',
    { class: 'shell center' },
    el(
      'section',
      { class: 'panel glass', style: 'max-width:560px;width:100%' },
      el('div', { class: 'row space' },
        el('div', { class: 'brand' },
          el('span', { class: 'brand-mark' }, '✓'),
          'TugasKu',
        ),
        themeButton,
      ),
      el('h1', {}, 'Sambungkan TugasKu'),
      el('p', { class: 'muted' },
        'Tempel Project URL dan anon key Supabase kamu agar aplikasi siap dipakai.',
      ),
      form,
      el('p', { class: 'small muted' },
        'Belum punya Supabase? Ikuti ',
        el('a', { href: 'docs/SETUP-DATABASE.md' }, 'tutorial setup database'),
        '.',
      ),
    ),
  );
};
