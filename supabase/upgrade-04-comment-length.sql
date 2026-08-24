-- Upgrade 04: batas maksimal 120 karakter per komentar
-- ---------------------------------------------------------------------------
-- Komentar panjang harus dipecah menjadi beberapa komentar oleh pengguna.
-- Batas ditegakkan di database supaya tidak bisa diakali dari luar aplikasi.

alter table public.class_comments
  add constraint class_comments_body_max_length
  check (char_length(body) <= 120);

alter table public.task_comments
  add constraint task_comments_body_max_length
  check (char_length(body) <= 120);
