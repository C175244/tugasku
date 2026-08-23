// Parser dan helper navigasi hash route untuk GitHub Pages.
export const route = () => {
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [name, id, action] = raw.split('/');
  return { name, id, action };
};

export const navigate = (path) => {
  location.hash = `#/${path.replace(/^#\/?/, '')}`;
};
