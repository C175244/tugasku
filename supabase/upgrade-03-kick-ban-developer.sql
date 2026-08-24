-- ============================================================================
-- UPGRADE 03: kick anggota dengan alasan, kode join ulang sekali pakai,
--             ban/suspensi global, konsol developer, dan anti-spam komentar.
-- Aman dijalankan berulang (idempotent) dan TIDAK menghapus data yang sudah ada.
-- Jalankan di Supabase Dashboard > SQL Editor > Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Blokir kelas (catatan kick) dan kode join ulang sekali pakai
-- ---------------------------------------------------------------------------

create table if not exists public.class_bans (
  class_id    uuid not null references public.classes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  reason      text,
  kicked_by   uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  lifted_at   timestamptz,
  primary key (class_id, user_id)
);
alter table public.class_bans enable row level security;
-- Sengaja tanpa policy tulis: semua lewat RPC security definer.

-- Yang pernah dikeluarkan boleh membaca catatannya sendiri (untuk melihat alasan).
drop policy if exists class_bans_select_self on public.class_bans;
create policy class_bans_select_self on public.class_bans
  for select to authenticated using (user_id = auth.uid());

create table if not exists public.class_rejoin_codes (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  code        text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  used_at     timestamptz,
  unique (class_id, user_id, code)
);
alter table public.class_rejoin_codes enable row level security;
-- Tanpa policy: hanya RPC security definer yang boleh membaca/menulis.

create or replace function public.is_class_banned(p_class_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.class_bans b
    where b.class_id = p_class_id
      and b.user_id = p_user_id
      and b.lifted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Ban / suspensi global (khusus developer)
-- ---------------------------------------------------------------------------

create table if not exists public.app_bans (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  reason      text,
  banned_by   uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz, -- null = permanen
  lifted_at   timestamptz
);
alter table public.app_bans enable row level security;

drop policy if exists app_bans_select_self on public.app_bans;
create policy app_bans_select_self on public.app_bans
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_app_banned(p_user_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.app_bans b
    where b.user_id = coalesce(p_user_id, auth.uid())
      and b.lifted_at is null
      and (b.expires_at is null or b.expires_at > now())
  );
$$;

create or replace function public.assert_not_banned()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_app_banned() then
    raise exception 'Akun kamu sedang diblokir dari aplikasi ini.';
  end if;
end;
$$;

-- Status blokir untuk ditampilkan ke pengguna yang sedang login.
create or replace function public.my_ban_status()
returns table (banned boolean, reason text, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select true, b.reason, b.expires_at
  from public.app_bans b
  where b.user_id = auth.uid()
    and b.lifted_at is null
    and (b.expires_at is null or b.expires_at > now())
  union all
  select false, null, null
  where not public.is_app_banned()
  limit 1;
$$;

create or replace function public.dev_ban_user(p_user_id uuid, p_reason text default null, p_hours int default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_developer() then
    raise exception 'Hanya developer yang bisa memblokir pengguna';
  end if;
  if exists (select 1 from public.app_developers d where d.user_id = p_user_id) then
    raise exception 'Developer tidak bisa diblokir';
  end if;

  insert into public.app_bans (user_id, reason, banned_by, expires_at, lifted_at)
  values (
    p_user_id,
    nullif(left(trim(coalesce(p_reason, '')), 500), ''),
    auth.uid(),
    case when p_hours is null then null
         else now() + make_interval(hours => greatest(p_hours, 1)) end,
    null
  )
  on conflict (user_id) do update
    set reason = excluded.reason,
        banned_by = excluded.banned_by,
        created_at = now(),
        expires_at = excluded.expires_at,
        lifted_at = null;
end;
$$;

create or replace function public.dev_unban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_developer() then
    raise exception 'Hanya developer yang bisa mencabut blokir';
  end if;
  update public.app_bans set lifted_at = now()
  where user_id = p_user_id and lifted_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Kick anggota dengan alasan (opsional)
-- ---------------------------------------------------------------------------
-- Aturan hierarki: developer (3) > owner kelas (2) > admin (1) > member (0).
-- Admin boleh mengeluarkan admin lain dan member. Owner boleh mengeluarkan
-- admin, member, dan owner lain. Pembuat kelas (classes.owner_id) hanya bisa
-- dikeluarkan oleh developer. Developer tidak bisa dikeluarkan.

create or replace function public.kick_member(p_class_id uuid, p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_level int;
  v_target_level int;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;
  perform public.assert_not_banned();
  if p_user_id = auth.uid() then
    raise exception 'Tidak bisa mengeluarkan diri sendiri. Gunakan keluar kelas.';
  end if;

  v_actor_level := public.class_role_level(p_class_id);
  if v_actor_level < 1 then
    raise exception 'Hanya admin, owner, atau developer yang bisa mengeluarkan anggota';
  end if;

  select case
    when exists (select 1 from public.app_developers d where d.user_id = m.user_id) then 3
    when exists (select 1 from public.classes c where c.id = m.class_id and c.owner_id = m.user_id) then 2
    else case m.role when 'owner' then 2 when 'admin' then 1 else 0 end
  end into v_target_level
  from public.class_members m
  where m.class_id = p_class_id and m.user_id = p_user_id;

  if v_target_level is null then
    raise exception 'Anggota tidak ditemukan di kelas ini';
  end if;
  if v_target_level >= 3 then
    raise exception 'Developer tidak bisa dikeluarkan dari kelas';
  end if;
  if v_actor_level < 3 then
    if v_actor_level = 1 and v_target_level > 1 then
      raise exception 'Admin hanya bisa mengeluarkan admin atau anggota biasa';
    end if;
    if v_actor_level = 2 and v_target_level > 2 then
      raise exception 'Tidak bisa mengeluarkan pengguna ini';
    end if;
    if exists (
      select 1 from public.classes c
      where c.id = p_class_id and c.owner_id = p_user_id
    ) then
      raise exception 'Pembuat kelas hanya bisa dikeluarkan oleh developer';
    end if;
  end if;

  v_reason := nullif(left(trim(coalesce(p_reason, '')), 500), '');

  delete from public.class_members
  where class_id = p_class_id and user_id = p_user_id;
  delete from public.task_progress
  where class_id = p_class_id and user_id = p_user_id;

  insert into public.class_bans (class_id, user_id, reason, kicked_by, lifted_at)
  values (p_class_id, p_user_id, v_reason, auth.uid(), null)
  on conflict (class_id, user_id) do update
    set reason = excluded.reason,
        kicked_by = excluded.kicked_by,
        created_at = now(),
        lifted_at = null;
end;
$$;

-- Developer bisa mengeluarkan siapa pun (termasuk owner) dari kelas mana pun
-- tanpa persetujuan, dari konsol developer yang terpisah.
create or replace function public.dev_remove_member(p_class_id uuid, p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_developer() then
    raise exception 'Hanya developer yang bisa mengeluarkan anggota lewat konsol';
  end if;
  perform public.kick_member(p_class_id, p_user_id, p_reason);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Gabung kelas: wajib kode join ulang bila pernah dikeluarkan
-- ---------------------------------------------------------------------------

drop function if exists public.join_class(text);

create or replace function public.join_class(p_room_code text, p_rejoin_code text default null)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.classes;
  v_code_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;
  perform public.assert_not_banned();

  select * into target from public.classes
  where room_code = upper(trim(p_room_code));

  if target.id is null then
    raise exception 'Kode room tidak ditemukan';
  end if;

  if public.is_class_banned(target.id, auth.uid()) then
    if coalesce(trim(p_rejoin_code), '') = '' then
      raise exception 'Kamu pernah dikeluarkan dari kelas ini. Minta kode join ulang sekali pakai ke admin/owner kelas.';
    end if;

    select rc.id into v_code_id
    from public.class_rejoin_codes rc
    where rc.class_id = target.id
      and rc.user_id = auth.uid()
      and rc.code = upper(trim(p_rejoin_code))
      and rc.used_at is null
      and rc.expires_at > now();

    if v_code_id is null then
      raise exception 'Kode join ulang tidak valid atau sudah kedaluwarsa';
    end if;

    update public.class_rejoin_codes set used_at = now() where id = v_code_id;
    update public.class_bans set lifted_at = now()
    where class_id = target.id and user_id = auth.uid();
  end if;

  insert into public.class_members (class_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (class_id, user_id) do nothing;

  insert into public.task_progress (task_id, user_id, class_id, status)
  select t.id, auth.uid(), t.class_id, 'pending'
  from public.tasks t
  where t.class_id = target.id
  on conflict (task_id, user_id) do nothing;

  return target;
end;
$$;

-- Kode join ulang hanya dibuat saat diminta lewat tombol oleh admin/owner/developer.
create or replace function public.create_rejoin_code(p_class_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  if not public.is_class_admin(p_class_id) then
    raise exception 'Hanya admin, owner, atau developer yang bisa membuat kode join ulang';
  end if;
  if not public.is_class_banned(p_class_id, p_user_id) then
    raise exception 'Pengguna ini tidak sedang diblokir dari kelas';
  end if;

  -- Pakai ulang kode aktif yang belum dipakai bila masih ada.
  select rc.code into v_code
  from public.class_rejoin_codes rc
  where rc.class_id = p_class_id
    and rc.user_id = p_user_id
    and rc.used_at is null
    and rc.expires_at > now()
  order by rc.created_at desc
  limit 1;

  if v_code is null then
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * char_length(alphabet))::int, 1);
    end loop;
    insert into public.class_rejoin_codes (class_id, user_id, code, created_by)
    values (p_class_id, p_user_id, v_code, auth.uid());
  end if;

  return v_code;
end;
$$;

create or replace function public.lift_ban(p_class_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_class_admin(p_class_id) then
    raise exception 'Hanya admin, owner, atau developer yang bisa mencabut blokir';
  end if;
  update public.class_bans set lifted_at = now()
  where class_id = p_class_id and user_id = p_user_id and lifted_at is null;
  delete from public.class_rejoin_codes
  where class_id = p_class_id and user_id = p_user_id and used_at is null;
end;
$$;

-- Daftar pengguna yang diblokir dari sebuah kelas (untuk admin+).
create or replace function public.class_ban_list(p_class_id uuid)
returns table (
  user_id uuid,
  username text,
  full_name text,
  reason text,
  kicked_by_username text,
  created_at timestamptz,
  active_code text,
  code_expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.user_id,
    p.username,
    p.full_name,
    b.reason,
    k.username,
    b.created_at,
    (
      select rc.code from public.class_rejoin_codes rc
      where rc.class_id = b.class_id and rc.user_id = b.user_id
        and rc.used_at is null and rc.expires_at > now()
      order by rc.created_at desc limit 1
    ),
    (
      select rc.expires_at from public.class_rejoin_codes rc
      where rc.class_id = b.class_id and rc.user_id = b.user_id
        and rc.used_at is null and rc.expires_at > now()
      order by rc.created_at desc limit 1
    )
  from public.class_bans b
  left join public.profiles p on p.id = b.user_id
  left join public.profiles k on k.id = b.kicked_by
  where b.class_id = p_class_id
    and b.lifted_at is null
    and public.is_class_admin(p_class_id)
  order by b.created_at desc;
$$;

-- Riwayat dikeluarkan untuk pengguna yang sedang login (beserta alasannya).
create or replace function public.my_kick_notices()
returns table (
  class_id uuid,
  class_name text,
  reason text,
  kicked_by_username text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.class_id,
    c.name,
    b.reason,
    p.username,
    b.created_at
  from public.class_bans b
  left join public.classes c on c.id = b.class_id
  left join public.profiles p on p.id = b.kicked_by
  where b.user_id = auth.uid()
  order by b.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 5. Pengaturan role: admin boleh menambah admin lain
-- ---------------------------------------------------------------------------

create or replace function public.set_member_role(p_class_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_level int;
  v_target_role text;
begin
  v_actor_level := public.class_role_level(p_class_id);
  if v_actor_level < 1 then
    raise exception 'Hanya admin, owner, atau developer yang bisa mengubah role';
  end if;
  if p_role not in ('admin', 'member', 'owner') then
    raise exception 'Role tidak valid';
  end if;

  select m.role into v_target_role
  from public.class_members m
  where m.class_id = p_class_id and m.user_id = p_user_id;

  if v_target_role is null then
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
  -- Admin hanya boleh menaikkan member menjadi admin. Menurunkan admin atau
  -- menyentuh owner hanya untuk owner kelas / developer.
  if v_actor_level = 1 and not (v_target_role = 'member' and p_role = 'admin') then
    raise exception 'Admin hanya bisa menambahkan admin baru dari anggota biasa';
  end if;

  update public.class_members set role = p_role
  where class_id = p_class_id and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Ringkasan semua pengguna untuk konsol developer
-- ---------------------------------------------------------------------------
-- Nama lengkap, username, email, peran di setiap kelas, dan status blokir.

create or replace function public.dev_user_overview()
returns table (
  user_id uuid,
  username text,
  full_name text,
  email text,
  created_at timestamptz,
  is_developer boolean,
  banned boolean,
  ban_reason text,
  ban_expires_at timestamptz,
  memberships jsonb
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    u.id,
    p.username,
    p.full_name,
    u.email::text,
    u.created_at,
    exists (select 1 from public.app_developers d where d.user_id = u.id),
    public.is_app_banned(u.id),
    (
      select b.reason from public.app_bans b
      where b.user_id = u.id and b.lifted_at is null
        and (b.expires_at is null or b.expires_at > now())
    ),
    (
      select b.expires_at from public.app_bans b
      where b.user_id = u.id and b.lifted_at is null
        and (b.expires_at is null or b.expires_at > now())
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'class_id', c.id,
        'class_name', c.name,
        'role', case when c.owner_id = m.user_id then 'owner' else m.role end
      ) order by c.name)
      from public.class_members m
      join public.classes c on c.id = m.class_id
      where m.user_id = u.id
    ), '[]'::jsonb)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.is_developer()
  order by u.created_at;
$$;

-- ---------------------------------------------------------------------------
-- 7. Penegakan blokir global pada aksi utama
-- ---------------------------------------------------------------------------

create or replace function public.create_class(p_name text)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  new_class public.classes;
begin
  if auth.uid() is null then
    raise exception 'Harus login';
  end if;
  perform public.assert_not_banned();
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

create or replace function public.enforce_not_banned_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_not_banned();
  return new;
end;
$$;

drop trigger if exists class_comments_not_banned on public.class_comments;
create trigger class_comments_not_banned
  before insert on public.class_comments
  for each row execute function public.enforce_not_banned_trigger();

drop trigger if exists task_comments_not_banned on public.task_comments;
create trigger task_comments_not_banned
  before insert on public.task_comments
  for each row execute function public.enforce_not_banned_trigger();

-- ---------------------------------------------------------------------------
-- 8. Anti-spam komentar (pagar aktivitas mencurigakan di sisi database)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  select (
    (select count(*) from public.class_comments c
      where c.user_id = auth.uid() and c.created_at > now() - interval '1 minute')
    +
    (select count(*) from public.task_comments c
      where c.user_id = auth.uid() and c.created_at > now() - interval '1 minute')
  ) into v_recent;

  if v_recent >= 20 then
    raise exception 'Aktivitas komentar terlalu cepat. Tunggu sebentar lalu coba lagi.'
      using errcode = '54000';
  end if;
  return new;
end;
$$;

drop trigger if exists class_comments_rate_limit on public.class_comments;
create trigger class_comments_rate_limit
  before insert on public.class_comments
  for each row execute function public.enforce_comment_rate_limit();

drop trigger if exists task_comments_rate_limit on public.task_comments;
create trigger task_comments_rate_limit
  before insert on public.task_comments
  for each row execute function public.enforce_comment_rate_limit();

-- ---------------------------------------------------------------------------
-- 9. Hak eksekusi fungsi baru
-- ---------------------------------------------------------------------------

revoke all on function public.kick_member(uuid, uuid, text)              from anon;
revoke all on function public.join_class(text, text)                    from anon;
revoke all on function public.create_rejoin_code(uuid, uuid)            from anon;
revoke all on function public.lift_ban(uuid, uuid)                      from anon;
revoke all on function public.class_ban_list(uuid)                      from anon;
revoke all on function public.my_kick_notices()                         from anon;
revoke all on function public.dev_ban_user(uuid, text, int)             from anon;
revoke all on function public.dev_unban_user(uuid)                      from anon;
revoke all on function public.dev_remove_member(uuid, uuid, text)       from anon;
revoke all on function public.dev_user_overview()                       from anon;

grant execute on function public.kick_member(uuid, uuid, text)          to authenticated;
grant execute on function public.join_class(text, text)                 to authenticated;
grant execute on function public.create_rejoin_code(uuid, uuid)         to authenticated;
grant execute on function public.lift_ban(uuid, uuid)                   to authenticated;
grant execute on function public.class_ban_list(uuid)                   to authenticated;
grant execute on function public.my_kick_notices()                      to authenticated;
grant execute on function public.is_class_banned(uuid, uuid)            to authenticated;
grant execute on function public.is_app_banned(uuid)                    to authenticated;
grant execute on function public.my_ban_status()                        to authenticated;
grant execute on function public.dev_ban_user(uuid, text, int)          to authenticated;
grant execute on function public.dev_unban_user(uuid)                   to authenticated;
grant execute on function public.dev_remove_member(uuid, uuid, text)    to authenticated;
grant execute on function public.dev_user_overview()                    to authenticated;
