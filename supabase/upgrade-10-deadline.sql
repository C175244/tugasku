-- Perpanjangan & pengubahan deadline tugas:
-- - `deadline` = deadline AKTIF saat ini.
-- - `original_deadline` = deadline pertama saat dibuat.
-- - `extension_deadline` = jika ada, deadline berikutnya yang mengambil alih
--    begitu `deadline` habis (hanya saat perpanjangan, bukan pengubahan).
-- - `deadline_changed_at` = penanda waktu perubahan (untuk label "deadline
--    diubah" / "diperpanjang").
-- - `extension_note` = alasan perubahan/perpanjangan dari admin/owner/dev.
alter table public.tasks
  add column if not exists original_deadline timestamptz,
  add column if not exists extension_deadline timestamptz,
  add column if not exists deadline_changed_at timestamptz,
  add column if not exists extension_note text;

-- Fungsi helper: pengguna boleh mengelola kelas ini (owner/admin/developer).
create or replace function public.can_manage_class(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_developer()
    or exists (
      select 1 from public.class_members m
      where m.class_id = p_class_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    );
$$;

grant execute on function public.can_manage_class(uuid) to authenticated;

-- Ubah deadline: mengganti deadline saat ini (untuk kasus "tanggal merah").
-- original_deadline dicatat sekali.
create or replace function public.extend_task_deadline(
  p_task_id uuid,
  p_new_deadline timestamptz,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Tugas tidak ditemukan.'; end if;
  if not can_manage_class(t.class_id) then
    raise exception 'Hanya admin, owner, atau developer yang bisa mengubah deadline.';
  end if;
  if p_new_deadline <= now() then
    raise exception 'Deadline baru harus di masa depan.';
  end if;
  update public.tasks set
    original_deadline = coalesce(original_deadline, deadline_at),
    deadline_at = p_new_deadline,
    extension_deadline = null,
    deadline_changed_at = now(),
    extension_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_task_id;
end;
$$;

-- Perpanjang deadline: deadline aktif saat ini tetap berlaku; bila habis,
-- otomatis berlanjut ke p_extension_deadline.
create or replace function public.postpone_task_deadline(
  p_task_id uuid,
  p_extension_deadline timestamptz,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Tugas tidak ditemukan.'; end if;
  if not can_manage_class(t.class_id) then
    raise exception 'Hanya admin, owner, atau developer yang bisa memperpanjang deadline.';
  end if;
  if p_extension_deadline <= t.deadline_at then
    raise exception 'Perpanjangan harus setelah deadline saat ini.';
  end if;
  update public.tasks set
    extension_deadline = p_extension_deadline,
    deadline_changed_at = now(),
    extension_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_task_id;
end;
$$;

grant execute on function public.extend_task_deadline(uuid, timestamptz, text) to authenticated;
grant execute on function public.postpone_task_deadline(uuid, timestamptz, text) to authenticated;

-- Hapus media/tugas lampiran yang sudah lewat deadline. Hanya admin, owner,
-- atau developer. Menghapus tugas beserta lampirannya.
create or replace function public.delete_expired_task_media(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'Tugas tidak ditemukan.'; end if;
  if not can_manage_class(t.class_id) then
    raise exception 'Hanya admin, owner, atau developer yang bisa menghapus.';
  end if;
  if t.deadline_at > now() then
    raise exception 'Tugas belum lewat deadline.';
  end if;
  delete from public.tasks where id = p_task_id;
end;
$$;

grant execute on function public.delete_expired_task_media(uuid) to authenticated;
