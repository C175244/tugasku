// Deteksi aktivitas komentar yang mencurigakan (burst) di sisi pengguna.
// Pagar utama tetap di database (trigger rate limit); ini hanya memutuskan
// kapan verifikasi bukan robot perlu dimunculkan.
const WINDOW_MS = 60_000;
const SUSPICIOUS_LIMIT = 8;

const sentAt = [];

const prune = () => {
  const cutoff = Date.now() - WINDOW_MS;
  while (sentAt.length && sentAt[0] < cutoff) sentAt.shift();
};

export const trackCommentSent = () => {
  sentAt.push(Date.now());
  prune();
};

export const isCommentActivitySuspicious = () => {
  prune();
  return sentAt.length >= SUSPICIOUS_LIMIT;
};
