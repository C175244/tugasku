-- ============================================================================
-- UPGRADE 02: hapus kelas dan hapus akun permanen.
-- Aman dijalankan berulang (idempotent) dan TIDAK menghapus data yang sudah ada.
-- Jalankan di Supabase Dashboard > SQL Editor > Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Hapus kelas (owner kelas atau developer)
-- ---------------------------------------------------------------------------
-- Menghapus kelas akan otomatis menghapus (cascade): anggota, jadwal, tugas,
-- progres tugas, komentar kelas, komentar tugas, dan metadata lampiran.
-- Trigger pada task_files memasukkan file fisik ke storage_cleanup_queue
-- sehingga file di Storage juga terhapus oleh cron.

create or replace function public.delete_class(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_class_owner(p_class_id) then
    raise exception 'Hanya owner kelas atau developer yang bisa menghapus kelas';
  end if;

  delete from public.classes where id = p_class_id;
end;
$$;

revoke all on function public.delete_class(uuid) from anon;
grant execute on function public.delete_class(uuid) to authenticated;

-- Owner kelas boleh dihapus lewat policy juga (jalur RPC tetap yang dipakai
-- aplikasi, policy ini cadangan agar developer bisa menghapus kelas apa pun).
drop policy if exists classes_delete_owner on public.classes;
create policy classes_delete_owner on public.classes
  for delete to authenticated using (owner_id = auth.uid() or public.is_developer());

-- ---------------------------------------------------------------------------
-- 2. Hapus akun sendiri (permanen)
-- ---------------------------------------------------------------------------
-- Menghapus baris di auth.users akan cascade ke profiles, class_members,
-- task_progress, komentar, dan metadata lampiran milik pengguna tersebut.
-- Kelas yang dia miliki (owner_id) juga terhapus beserta seluruh isinya.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Harus login untuk menghapus akun';
  end if;

  -- Kelas milik sendiri dihapus lebih dulu supaya trigger pembersihan file
  -- fisik di Storage ikut jalan.
  delete from public.classes where owner_id = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Hapus akun orang lain (khusus developer)
-- ---------------------------------------------------------------------------

create or replace function public.dev_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_developer() then
    raise exception 'Hanya developer yang bisa menghapus akun pengguna lain';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Gunakan hapus akun sendiri untuk akun ini';
  end if;

  delete from public.classes where owner_id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.dev_delete_user(uuid) from anon;
grant execute on function public.dev_delete_user(uuid) to authenticated;
