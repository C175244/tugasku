-- Kolom catatan di jadwal (dari admin/owner/developer) — ditampilkan di
-- Beranda sebagai catatan jadwal harian. Juga menambah kolom `note` bila
-- belum ada di schedules.
alter table public.schedules
  add column if not exists note text;

-- Ubah catatan jadwal. Akses: owner/admin/developer kelas tersebut.
create or replace function public.set_schedule_note(
  p_schedule_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.schedules;
begin
  select * into s from public.schedules where id = p_schedule_id;
  if not found then raise exception 'Jadwal tidak ditemukan.'; end if;
  if not can_manage_class(s.class_id) then
    raise exception 'Hanya admin, owner, atau developer yang bisa menambah catatan jadwal.';
  end if;
  update public.schedules set note = nullif(btrim(coalesce(p_note, '')), '') where id = p_schedule_id;
end;
$$;

grant execute on function public.set_schedule_note(uuid, text) to authenticated;
