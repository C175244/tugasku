// Format ukuran file, prioritas, teks, dan nama file upload.
export const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export const priorityLabel = (value) => ({
  1: 'Rendah',
  2: 'Sedang',
  3: 'Tinggi',
}[value] || 'Sedang');

export const titleCase = (value = '') => (
  value.charAt(0).toUpperCase() + value.slice(1)
);

export const sanitizeFilename = (name = 'file') => name
  .normalize('NFKD')
  .replace(/[^\w.-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 100) || 'file';
