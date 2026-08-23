// Mengatur judul halaman dan warna bar browser.
export const setHead = (title = 'TugasKu') => {
  document.title = `${title} · TugasKu`;
  let theme = document.querySelector('meta[name="theme-color"]');
  if (!theme) {
    theme = document.createElement('meta');
    theme.name = 'theme-color';
    document.head.append(theme);
  }
  theme.content = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface-soft')
    .trim() || '#f7f7f7';
};
