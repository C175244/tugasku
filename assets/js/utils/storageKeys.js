// Semua nama localStorage agar mudah ditemukan dan tidak typo.
export const STORAGE_KEYS = {
  url: 'tugasku.supabase.url',
  anonKey: 'tugasku.supabase.anonKey',
  theme: 'tugasku.theme',
  filters: 'tugasku.filters',
  cleanup: 'tugasku.cleanup90',
  announcementSeen: 'tugasku.announcementSeen',
  tutorial: (userId) => `tugasku.tutorial.${userId}`,
  passwordMask: (userId) => `tugasku.passwordMask.${userId}`,
};
