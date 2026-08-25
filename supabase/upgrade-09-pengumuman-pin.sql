-- Tambahkan kolom `pinned` di pengumuman: yang di-pin tetap muncul sebagai
-- popup juga untuk pengguna baru (akun yang dibuat setelah pengumuman itu).
alter table public.announcements
  add column if not exists pinned boolean not null default false;

-- Ubah send_announcement agar bisa menerima pin (default false).
create or replace function public.send_announcement(message text, pinned boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_developer() then
    raise exception 'Akses ditolak: hak developer dibutuhkan.';
  end if;
  if message is null or btrim(message) = '' then
    raise exception 'Pesan kosong.';
  end if;
  insert into public.announcements (sender_id, body, pinned)
  values (auth.uid(), btrim(message), pinned);
end;
$$;

-- Toggle pinned pada pengumuman — hanya developer.
create or replace function public.pin_announcement(p_id bigint, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_developer() then
    raise exception 'Akses ditolak: hak developer dibutuhkan.';
  end if;
  update public.announcements set pinned = p_pinned where id = p_id;
end;
$$;

-- Tandai membaca: simpan batas waktu akun (untuk pengguna baru). Dipanggil
-- saat pertama kali memuat supaya pengumuman sebelum akun dibuat tidak
-- muncul sebagai popup (kecuali yang pinned).
create or replace function public.my_joined_at()
returns timestamptz
language sql
security definer
set search_path = public
stable
as $$ select created_at from public.profiles where id = auth.uid() $$;
