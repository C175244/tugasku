// Menentukan, menerapkan, dan mengganti tema terang/gelap.
import { STORAGE_KEYS } from './utils/storageKeys.js';

export const getTheme = () => (
  localStorage.getItem(STORAGE_KEYS.theme) || 'auto'
);

export const applyTheme = (theme = getTheme()) => {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = theme;
  }
  localStorage.setItem(STORAGE_KEYS.theme, theme);
};

export const toggleTheme = () => {
  const current = getTheme();
  const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = current === 'dark' || (current === 'auto' && systemDark);
  const next = dark ? 'light' : 'dark';
  applyTheme(next);
  return next;
};
