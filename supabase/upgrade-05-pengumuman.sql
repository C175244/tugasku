-- Pengumuman: pesan developer untuk semua pengguna aplikasi utama.
-- Developer menulis di konsol developer; pengguna membaca lewat popup /
-- halaman riwayat. Pola akses sama seperti RPC developer lain (developers).

create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint announcement_body_max_length check (char_length(body) <= 2000)
);

alter table public.announcements enable row level security;

-- Semua pengguna login boleh membaca pengumuman.
create policy "Announcements can be read by signed in users"
  on public.announcements
  for select
  to authenticated
  using (true);

-- Hanya developer boleh menulis langsung ke tabel.
create policy "Only developers can insert announcements"
  on public.announcements
  for insert
  to authenticated
  with check (is_developer());

create or replace function public.send_announcement(message text)
returns void
language plpgsql
security definer
set search_path = public
as $announcements$
begin
  if not is_developer() then
    raise exception 'Akses ditolak: hak developer dibutuhkan.';
  end if;
  if message is null or btrim(message) = '' then
    raise exception 'Pesan kosong.';
  end if;
  insert into public.announcements (sender_id, body)
  values (auth.uid(), btrim(message));
end;
$announcements$;

grant execute on function public.send_announcement(text) to authenticated;
