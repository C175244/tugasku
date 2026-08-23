-- ============================================================================
-- TugasKu - Skema Database Supabase (jalankan SEKALI di SQL Editor Supabase)
-- Aman di-jalankan ulang (idempotent): pakai IF NOT EXISTS / DROP POLICY IF EXISTS
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABEL
-- ============================================================================

-- Profil pengguna (1:1 dengan auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-zA-Z0-9_.]{3,24}$')
);

-- Kelas / room
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  room_code   text unique not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint room_code_format check (room_code ~ '^[A-Z0-9]{6}$')
);

-- Anggota kelas
create table if not exists public.class_members (
  class_id    uuid not null references public.classes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('admin', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (class_id, user_id)
);

-- Jadwal pelajaran per hari
create table if not exists public.schedules (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6), -- 0 = Minggu
  subject      text not null,
  teacher      text,
  jam_count    smallint not null default 1 check (jam_count between 1 and 12),
  start_time   time not null,
  end_time     time not null,
  order_index  smallint not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists schedules_class_day_idx on public.schedules (class_id, day_of_week, start_time);

-- Tugas
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes(id) on delete cascade,
  created_by     uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  description    text,
  subject        text,
  schedule_id    uuid references public.schedules(id) on delete set null,
  task_type      text not null default 'tugas'
                 check (task_type in ('tugas','pr','ulangan','praktik','proyek','presentasi','catatan','lainnya')),
  difficulty     text not null default 'sedang' check (difficulty in ('mudah','sedang','sulit')),
  priority       smallint not null default 2 check (priority between 1 and 3), -- 1 rendah, 3 tinggi
  deadline_mode  text not null default 'date' check (deadline_mode in ('date','next_subject')),
  deadline_at    timestamptz not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists tasks_class_deadline_idx on public.tasks (class_id, deadline_at);

-- Lampiran tugas (metadata; file fisik ada di Supabase Storage)
create table if not exists public.task_files (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  class_id     uuid not null references public.classes(id) on delete cascade,
  uploader_id  uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);
create index if not exists task_files_task_idx on public.task_files (task_id);

-- Status pengerjaan PER PENGGUNA (pemisah: hijau/merah tidak saling mempengaruhi)
create table if not exists public.task_progress (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','done')),
  done_at    timestamptz,
  note       text,
  updated_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists task_progress_user_idx on public.task_progress (user_id, class_id);

-- Komentar room kelas
create table if not exists public.class_comments (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists class_comments_class_idx on public.class_comments (class_id, created_at desc);

-- Komentar per tugas
create table if not exists public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);

-- ============================================================================
-- 2. FUNGSI BANTU (SECURITY DEFINER supaya RLS tidak rekursif)
-- ============================================================================

create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.class_members m
    where m.class_id = p_class_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_class_admin(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.class_members m
    where m.class_id = p_class_id and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

-- Profil otomatis dibuat saat user baru mendaftar
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(
    nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'username', ''), '[^a-zA-Z0-9_.]', '', 'g'), ''),
    nullif(regexp_replace(split_part(coalesce(new.email, 'user'), '@', 1), '[^a-zA-Z0-9_.]', '', 'g'), ''),
    'user'
  );
  if char_length(base_username) < 3 then
    base_username := base_username || 'xyz';
  end if;
  base_username := left(base_username, 20);
  final_username := base_username;

  while exists (select 1 from public.profiles p where p.username = final_username) loop
    suffix := suffix + 1;
    final_username := left(base_username, 18) || suffix::text;
  end loop;

  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at otomatis
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at before update on public.tasks
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 3. RPC: buat kelas, gabung kelas, kelola admin
-- ============================================================================

create or replace function public.generate_room_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- tanpa I,O,0,1 biar tidak ambigu
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * char_length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes c where c.room_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_class(p_name text)
returns public.classes
language plpgsql security definer set search_path = public as $$
declare
  new_class public.classes;
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nama kelas wajib diisi';
  end if;

  insert into public.classes (name, room_code, owner_id)
  values (left(trim(p_name), 60), public.generate_room_code(), auth.uid())
  returning * into new_class;

  insert into public.class_members (class_id, user_id, role)
  values (new_class.id, auth.uid(), 'admin');

  return new_class;
end;
$$;

create or replace function public.join_class(p_room_code text)
returns public.classes
language plpgsql security definer set search_path = public as $$
declare
  target public.classes;
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;

  select * into target from public.classes
  where room_code = upper(trim(p_room_code));

  if target.id is null then
    raise exception 'Kode room tidak ditemukan';
  end if;

  insert into public.class_members (class_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (class_id, user_id) do nothing;

  -- sinkronkan semua tugas yang masih ada ke dashboard pengguna ini
  insert into public.task_progress (task_id, user_id, class_id, status)
  select t.id, auth.uid(), t.class_id, 'pending'
  from public.tasks t
  where t.class_id = target.id
  on conflict (task_id, user_id) do nothing;

  return target;
end;
$$;

create or replace function public.leave_class(p_class_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.classes c where c.id = p_class_id and c.owner_id = auth.uid()) then
    raise exception 'Pembuat kelas tidak bisa keluar. Hapus kelas atau pindahkan kepemilikan.';
  end if;
  delete from public.class_members where class_id = p_class_id and user_id = auth.uid();
  delete from public.task_progress where class_id = p_class_id and user_id = auth.uid();
end;
$$;

create or replace function public.set_member_role(p_class_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_class_admin(p_class_id) then
    raise exception 'Hanya admin yang bisa mengubah role';
  end if;
  if p_role not in ('admin','member') then
    raise exception 'Role tidak valid';
  end if;
  if exists (select 1 from public.classes c where c.id = p_class_id and c.owner_id = p_user_id)
     and p_role = 'member' then
    raise exception 'Pembuat kelas tetap admin';
  end if;
  update public.class_members set role = p_role
  where class_id = p_class_id and user_id = p_user_id;
end;
$$;

-- Cari profil anggota kelas (username) tanpa membuka seluruh tabel profiles
create or replace function public.class_member_list(p_class_id uuid)
returns table (user_id uuid, username text, full_name text, avatar_url text, role text, joined_at timestamptz)
language sql security definer set search_path = public stable as $$
  select m.user_id, p.username, p.full_name, p.avatar_url, m.role, m.joined_at
  from public.class_members m
  join public.profiles p on p.id = m.user_id
  where m.class_id = p_class_id
    and public.is_class_member(p_class_id)
  order by m.role, p.username;
$$;

-- Saat admin menambah tugas: otomatis bikin baris progress untuk semua anggota
create or replace function public.fanout_task_progress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.task_progress (task_id, user_id, class_id, status)
  select new.id, m.user_id, new.class_id, 'pending'
  from public.class_members m
  where m.class_id = new.class_id
  on conflict (task_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists tasks_fanout_progress on public.tasks;
create trigger tasks_fanout_progress
  after insert on public.tasks
  for each row execute function public.fanout_task_progress();

-- Hapus otomatis tugas yang deadline-nya sudah lewat lebih dari 90 hari
create or replace function public.cleanup_expired_tasks(p_days int default 90)
returns int language plpgsql security definer set search_path = public as $$
declare
  deleted_count int;
begin
  with removed as (
    delete from public.tasks t
    where t.deadline_at < now() - make_interval(days => greatest(p_days, 1))
      and public.is_class_member(t.class_id)
    returning 1
  )
  select count(*) into deleted_count from removed;
  return deleted_count;
end;
$$;

-- Versi untuk pg_cron (menghapus di seluruh tabel, tanpa cek keanggotaan)
create or replace function public.cleanup_expired_tasks_global(p_days int default 90)
returns int language plpgsql security definer set search_path = public as $$
declare
  deleted_count int;
begin
  with removed as (
    delete from public.tasks t
    where t.deadline_at < now() - make_interval(days => greatest(p_days, 1))
    returning 1
  )
  select count(*) into deleted_count from removed;
  return deleted_count;
end;
$$;
revoke all on function public.cleanup_expired_tasks_global(int) from anon, authenticated;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles       enable row level security;
alter table public.classes        enable row level security;
alter table public.class_members  enable row level security;
alter table public.schedules      enable row level security;
alter table public.tasks          enable row level security;
alter table public.task_files     enable row level security;
alter table public.task_progress  enable row level security;
alter table public.class_comments enable row level security;
alter table public.task_comments  enable row level security;

-- profiles: hanya profil sendiri yang bisa dibaca langsung
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- classes: hanya anggota yang bisa melihat (join lewat RPC join_class)
drop policy if exists classes_select_member on public.classes;
create policy classes_select_member on public.classes
  for select to authenticated using (public.is_class_member(id));

drop policy if exists classes_update_admin on public.classes;
create policy classes_update_admin on public.classes
  for update to authenticated using (public.is_class_admin(id)) with check (public.is_class_admin(id));

drop policy if exists classes_delete_owner on public.classes;
create policy classes_delete_owner on public.classes
  for delete to authenticated using (owner_id = auth.uid());

-- class_members
drop policy if exists class_members_select on public.class_members;
create policy class_members_select on public.class_members
  for select to authenticated using (user_id = auth.uid() or public.is_class_member(class_id));

drop policy if exists class_members_delete on public.class_members;
create policy class_members_delete on public.class_members
  for delete to authenticated using (user_id = auth.uid() or public.is_class_admin(class_id));

-- schedules: anggota baca, admin tulis
drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules
  for select to authenticated using (public.is_class_member(class_id));

drop policy if exists schedules_insert on public.schedules;
create policy schedules_insert on public.schedules
  for insert to authenticated with check (public.is_class_admin(class_id));

drop policy if exists schedules_update on public.schedules;
create policy schedules_update on public.schedules
  for update to authenticated using (public.is_class_admin(class_id)) with check (public.is_class_admin(class_id));

drop policy if exists schedules_delete on public.schedules;
create policy schedules_delete on public.schedules
  for delete to authenticated using (public.is_class_admin(class_id));

-- tasks: anggota baca, admin tulis (pembuat tugas boleh edit/hapus miliknya)
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (public.is_class_member(class_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.is_class_admin(class_id) and created_by = auth.uid());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_class_admin(class_id) or created_by = auth.uid())
  with check (public.is_class_admin(class_id) or created_by = auth.uid());

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (public.is_class_admin(class_id) or created_by = auth.uid());

-- task_files: anggota baca & upload, hapus milik sendiri atau admin
drop policy if exists task_files_select on public.task_files;
create policy task_files_select on public.task_files
  for select to authenticated using (public.is_class_member(class_id));

drop policy if exists task_files_insert on public.task_files;
create policy task_files_insert on public.task_files
  for insert to authenticated with check (public.is_class_member(class_id) and uploader_id = auth.uid());

drop policy if exists task_files_delete on public.task_files;
create policy task_files_delete on public.task_files
  for delete to authenticated using (uploader_id = auth.uid() or public.is_class_admin(class_id));

-- task_progress: HANYA milik sendiri (inti pemisah status per orang)
drop policy if exists task_progress_select_self on public.task_progress;
create policy task_progress_select_self on public.task_progress
  for select to authenticated using (user_id = auth.uid());

drop policy if exists task_progress_insert_self on public.task_progress;
create policy task_progress_insert_self on public.task_progress
  for insert to authenticated with check (user_id = auth.uid() and public.is_class_member(class_id));

drop policy if exists task_progress_update_self on public.task_progress;
create policy task_progress_update_self on public.task_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists task_progress_delete_self on public.task_progress;
create policy task_progress_delete_self on public.task_progress
  for delete to authenticated using (user_id = auth.uid());

-- class_comments
drop policy if exists class_comments_select on public.class_comments;
create policy class_comments_select on public.class_comments
  for select to authenticated using (public.is_class_member(class_id));

drop policy if exists class_comments_insert on public.class_comments;
create policy class_comments_insert on public.class_comments
  for insert to authenticated with check (public.is_class_member(class_id) and user_id = auth.uid());

drop policy if exists class_comments_delete on public.class_comments;
create policy class_comments_delete on public.class_comments
  for delete to authenticated using (user_id = auth.uid() or public.is_class_admin(class_id));

-- task_comments
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
  for select to authenticated using (public.is_class_member(class_id));

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert to authenticated with check (public.is_class_member(class_id) and user_id = auth.uid());

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete to authenticated using (user_id = auth.uid() or public.is_class_admin(class_id));

-- ============================================================================
-- 5. STORAGE (bucket privat untuk foto/video/file tugas)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 52428800) -- 50 MB per file
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- Konvensi path file: <class_id>/<task_id>/<uuid>-<nama_file>
drop policy if exists task_files_storage_select on storage.objects;
create policy task_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-files'
    and public.is_class_member(nullif(split_part(name, '/', 1), '')::uuid)
  );

drop policy if exists task_files_storage_insert on storage.objects;
create policy task_files_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-files'
    and public.is_class_member(nullif(split_part(name, '/', 1), '')::uuid)
    and owner = auth.uid()
  );

drop policy if exists task_files_storage_delete on storage.objects;
create policy task_files_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-files'
    and (owner = auth.uid() or public.is_class_admin(nullif(split_part(name, '/', 1), '')::uuid))
  );

-- ============================================================================
-- 6. REALTIME (sinkronisasi otomatis antar akun)
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.class_comments;
alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.task_files;

-- ============================================================================
-- 7. HAK AKSES FUNGSI
-- ============================================================================

grant execute on function public.create_class(text)                 to authenticated;
grant execute on function public.join_class(text)                   to authenticated;
grant execute on function public.leave_class(uuid)                  to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text)  to authenticated;
grant execute on function public.class_member_list(uuid)            to authenticated;
grant execute on function public.cleanup_expired_tasks(int)         to authenticated;
grant execute on function public.is_class_member(uuid)              to authenticated;
grant execute on function public.is_class_admin(uuid)               to authenticated;
