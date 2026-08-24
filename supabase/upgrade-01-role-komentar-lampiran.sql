-- ============================================================================
-- UPGRADE 01: role bertingkat, komentar khusus admin, lampiran khusus admin,
--             dan pembersihan file otomatis.
-- Aman dijalankan berulang (idempotent) dan TIDAK menghapus data yang sudah ada.
-- Jalankan di Supabase Dashboard > SQL Editor > Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tingkatan role: member < admin < owner kelas < developer
-- ---------------------------------------------------------------------------

alter table public.class_members drop constraint if exists class_members_role_check;
alter table public.class_members
  add constraint class_members_role_check check (role in ('member', 'admin', 'owner'));

-- Pembuat kelas yang sebelumnya berlabel 'admin' dinaikkan jadi 'owner'.
update public.class_members m
set role = 'owner'
from public.classes c
where c.id = m.class_id
  and c.owner_id = m.user_id
  and m.role <> 'owner';

-- Daftar developer (global, di atas owner kelas). Hanya bisa diubah lewat
-- SQL Editor / service role, tidak bisa diubah dari aplikasi.
create table if not exists public.app_developers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.app_developers enable row level security;

drop policy if exists app_developers_select_self on public.app_developers;
create policy app_developers_select_self on public.app_developers
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Fungsi bantu role
-- ---------------------------------------------------------------------------

create or replace function public.is_developer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.app_developers d where d.user_id = auth.uid()
  );
$$;

-- -1 = bukan anggota, 0 = member, 1 = admin, 2 = owner kelas, 3 = developer
create or replace function public.class_role_level(p_class_id uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select case
    when public.is_developer() then 3
    when exists (
      select 1 from public.classes c
      where c.id = p_class_id and c.owner_id = auth.uid()
    ) then 2
    else coalesce((
      select case m.role when 'owner' then 2 when 'admin' then 1 else 0 end
      from public.class_members m
      where m.class_id = p_class_id and m.user_id = auth.uid()
    ), -1)
  end;
$$;

create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.class_role_level(p_class_id) >= 0;
$$;

create or replace function public.is_class_admin(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.class_role_level(p_class_id) >= 1;
$$;

create or replace function public.is_class_owner(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.class_role_level(p_class_id) >= 2;
$$;

-- Role efektif user saat ini di sebuah kelas, dipakai UI untuk sembunyikan aksi.
create or replace function public.my_class_role(p_class_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case public.class_role_level(p_class_id)
    when 3 then 'developer'
    when 2 then 'owner'
    when 1 then 'admin'
    when 0 then 'member'
    else 'none'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Pengaturan role anggota: hanya owner kelas / developer
-- ---------------------------------------------------------------------------

create or replace function public.set_member_role(p_class_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_class_owner(p_class_id) then
    raise exception 'Hanya owner kelas atau developer yang bisa mengubah role';
  end if;
  if p_role not in ('admin', 'member', 'owner') then
    raise exception 'Role tidak valid';
  end if;
  if not exists (
    select 1 from public.class_members m
    where m.class_id = p_class_id and m.user_id = p_user_id
  ) then
    raise exception 'Anggota tidak ditemukan di kelas ini';
  end if;
  if exists (
    select 1 from public.classes c
    where c.id = p_class_id and c.owner_id = p_user_id
  ) and p_role <> 'owner' then
    raise exception 'Pembuat kelas tetap owner';
  end if;
  if p_role = 'owner' and not public.is_developer() then
    raise exception 'Hanya developer yang bisa menambah owner kelas';
  end if;

  update public.class_members set role = p_role
  where class_id = p_class_id and user_id = p_user_id;
end;
$$;

-- Kelas baru: pembuatnya langsung jadi owner.
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
  values (new_class.id, auth.uid(), 'owner');

  return new_class;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS komentar: hanya admin+ yang bisa menulis, semua anggota bisa baca
-- ---------------------------------------------------------------------------

drop policy if exists class_comments_insert on public.class_comments;
create policy class_comments_insert on public.class_comments
  for insert to authenticated with check (
    public.is_class_admin(class_id) and user_id = auth.uid()
  );

drop policy if exists class_comments_delete on public.class_comments;
create policy class_comments_delete on public.class_comments
  for delete to authenticated using (
    user_id = auth.uid() or public.is_class_owner(class_id)
  );

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert to authenticated with check (
    public.is_class_admin(class_id) and user_id = auth.uid()
  );

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete to authenticated using (
    user_id = auth.uid() or public.is_class_owner(class_id)
  );

-- ---------------------------------------------------------------------------
-- 5. RLS lampiran: upload hanya admin+, lihat semua anggota
-- ---------------------------------------------------------------------------

drop policy if exists task_files_insert on public.task_files;
create policy task_files_insert on public.task_files
  for insert to authenticated with check (
    public.is_class_admin(class_id) and uploader_id = auth.uid()
  );

drop policy if exists task_files_delete on public.task_files;
create policy task_files_delete on public.task_files
  for delete to authenticated using (
    uploader_id = auth.uid() or public.is_class_owner(class_id)
  );

drop policy if exists task_files_storage_insert on storage.objects;
create policy task_files_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-files'
    and public.is_class_admin(nullif(split_part(name, '/', 1), '')::uuid)
    and owner = auth.uid()
  );

drop policy if exists task_files_storage_delete on storage.objects;
create policy task_files_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-files'
    and (
      owner = auth.uid()
      or public.is_class_owner(nullif(split_part(name, '/', 1), '')::uuid)
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Daftar komentar & lampiran lengkap dengan username penulis
-- ---------------------------------------------------------------------------

create or replace function public.class_comment_list(p_class_id uuid)
returns table (
  id uuid,
  class_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  username text,
  full_name text,
  author_role text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    cc.id,
    cc.class_id,
    cc.user_id,
    cc.body,
    cc.created_at,
    p.username,
    p.full_name,
    case
      when c.owner_id = cc.user_id then 'owner'
      else coalesce(m.role, 'member')
    end as author_role
  from public.class_comments cc
  join public.classes c on c.id = cc.class_id
  left join public.profiles p on p.id = cc.user_id
  left join public.class_members m on m.class_id = cc.class_id and m.user_id = cc.user_id
  where cc.class_id = p_class_id
    and public.is_class_member(p_class_id)
  order by cc.created_at desc;
$$;

create or replace function public.task_comment_list(p_task_id uuid)
returns table (
  id uuid,
  task_id uuid,
  class_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  username text,
  full_name text,
  author_role text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    tc.id,
    tc.task_id,
    tc.class_id,
    tc.user_id,
    tc.body,
    tc.created_at,
    p.username,
    p.full_name,
    case
      when c.owner_id = tc.user_id then 'owner'
      else coalesce(m.role, 'member')
    end as author_role
  from public.task_comments tc
  join public.classes c on c.id = tc.class_id
  left join public.profiles p on p.id = tc.user_id
  left join public.class_members m on m.class_id = tc.class_id and m.user_id = tc.user_id
  where tc.task_id = p_task_id
    and public.is_class_member(tc.class_id)
  order by tc.created_at;
$$;

create or replace function public.task_file_list(p_task_id uuid)
returns table (
  id uuid,
  task_id uuid,
  class_id uuid,
  uploader_id uuid,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz,
  username text,
  full_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    f.id,
    f.task_id,
    f.class_id,
    f.uploader_id,
    f.storage_path,
    f.file_name,
    f.mime_type,
    f.size_bytes,
    f.created_at,
    p.username,
    p.full_name
  from public.task_files f
  left join public.profiles p on p.id = f.uploader_id
  where f.task_id = p_task_id
    and public.is_class_member(f.class_id)
  order by f.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 7. Ringkasan semua kelas untuk developer
-- ---------------------------------------------------------------------------

create or replace function public.dev_class_overview()
returns table (
  class_id uuid,
  class_name text,
  room_code text,
  owner_username text,
  member_count bigint,
  task_count bigint,
  file_count bigint,
  comment_count bigint,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.name,
    c.room_code,
    p.username,
    (select count(*) from public.class_members m where m.class_id = c.id),
    (select count(*) from public.tasks t where t.class_id = c.id),
    (select count(*) from public.task_files f where f.class_id = c.id),
    (select count(*) from public.class_comments cc where cc.class_id = c.id)
      + (select count(*) from public.task_comments tc where tc.class_id = c.id),
    c.created_at
  from public.classes c
  left join public.profiles p on p.id = c.owner_id
  where public.is_developer()
  order by c.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 8. Pembersihan fisik file di Storage saat metadata terhapus
--    (tugas kadaluarsa >90 hari, atau file dihapus manual)
-- ---------------------------------------------------------------------------

create table if not exists public.storage_cleanup_queue (
  id              bigserial primary key,
  bucket_id       text not null default 'task-files',
  storage_path    text not null,
  enqueued_at     timestamptz not null default now(),
  attempts        int not null default 0,
  last_attempt_at timestamptz,
  request_id      bigint
);
alter table public.storage_cleanup_queue enable row level security;
-- Sengaja tanpa policy: hanya fungsi security definer / service role yang boleh akses.

create or replace function public.enqueue_task_file_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.storage_path is not null and old.storage_path <> '' then
    insert into public.storage_cleanup_queue (storage_path) values (old.storage_path);
  end if;
  return old;
end;
$$;

drop trigger if exists task_files_enqueue_cleanup on public.task_files;
create trigger task_files_enqueue_cleanup
  after delete on public.task_files
  for each row execute function public.enqueue_task_file_cleanup();

create extension if not exists pg_net with schema extensions;

-- Mengirim DELETE ke Storage API untuk setiap file dalam antrean.
-- Butuh dua secret di Vault: 'project_url' dan 'service_role_key'.
create or replace function public.process_storage_cleanup(p_limit int default 100)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_key text;
  r record;
  v_request_id bigint;
  n int := 0;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return -1;
  end if;

  for r in
    select * from public.storage_cleanup_queue
    where attempts < 5
      and (last_attempt_at is null or last_attempt_at < now() - interval '10 minutes')
    order by id
    limit greatest(p_limit, 1)
  loop
    select net.http_delete(
      url := v_url || '/storage/v1/object/' || r.bucket_id || '/' || r.storage_path,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_key,
        'apikey', v_key
      ),
      timeout_milliseconds := 10000
    ) into v_request_id;

    update public.storage_cleanup_queue
    set attempts = attempts + 1,
        last_attempt_at = now(),
        request_id = v_request_id
    where id = r.id;
    n := n + 1;
  end loop;

  return n;
end;
$$;

-- Menghapus antrean yang responsnya sukses (2xx atau 404 = objek sudah hilang).
create or replace function public.reconcile_storage_cleanup()
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n int;
begin
  with done as (
    delete from public.storage_cleanup_queue q
    using net._http_response r
    where r.id = q.request_id
      and (r.status_code between 200 and 299 or r.status_code in (400, 404))
    returning 1
  )
  select count(*) into n from done;
  return n;
end;
$$;

revoke all on function public.process_storage_cleanup(int) from anon, authenticated;
revoke all on function public.reconcile_storage_cleanup() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Hak eksekusi fungsi baru
-- ---------------------------------------------------------------------------

grant execute on function public.is_developer()                to authenticated;
grant execute on function public.class_role_level(uuid)        to authenticated;
grant execute on function public.is_class_owner(uuid)          to authenticated;
grant execute on function public.my_class_role(uuid)           to authenticated;
grant execute on function public.class_comment_list(uuid)      to authenticated;
grant execute on function public.task_comment_list(uuid)       to authenticated;
grant execute on function public.task_file_list(uuid)          to authenticated;
grant execute on function public.dev_class_overview()          to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Penjadwalan otomatis (pg_cron)
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema extensions;

do $$
begin
  perform cron.unschedule('tugasku-hapus-tugas-lama');
exception when others then null;
end $$;
select cron.schedule('tugasku-hapus-tugas-lama', '15 2 * * *',
  $$select public.cleanup_expired_tasks_global(90);$$);

do $$
begin
  perform cron.unschedule('tugasku-bersihkan-storage');
exception when others then null;
end $$;
select cron.schedule('tugasku-bersihkan-storage', '*/5 * * * *',
  $$select public.process_storage_cleanup(100);$$);

do $$
begin
  perform cron.unschedule('tugasku-rekonsiliasi-storage');
exception when others then null;
end $$;
select cron.schedule('tugasku-rekonsiliasi-storage', '3-59/5 * * * *',
  $$select public.reconcile_storage_cleanup();$$);
