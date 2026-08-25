-- Pengaturan akun: daftar sesi login (perangkat) milik pengguna sendiri
-- dan kemampuan keluar (logout) dari perangkat lain. Keduanya dibatasi
-- auth.uid(), jadi pengguna hanya bisa melihat/mengakhiri sesinya sendiri.

-- Daftar sesi milik pengguna yang sedang masuk. Flag `current` menandai
-- sesi dari perangkat yang sedang dipakai (dibaca dari klaim JWT).
create or replace function public.my_login_sessions()
returns table (
  session_id uuid,
  created_at timestamptz,
  user_agent text,
  ip inet,
  current boolean
)
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  current_sid uuid;
begin
  begin
    current_sid := (auth.jwt() ->> 'session_id')::uuid;
  exception when others then
    current_sid := null;
  end;
  return query
    select
      s.id,
      s.created_at,
      coalesce(s.user_agent::text, 'Perangkat tidak dikenal'),
      s.ip,
      (current_sid is not null and s.id = current_sid)
    from auth.sessions s
    where s.user_id = auth.uid()
    order by s.created_at desc;
end;
$$;

grant execute on function public.my_login_sessions() to authenticated;

-- Keluar dari sesi tertentu milik pengguna sendiri (perangkat lain).
create or replace function public.end_login_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  removed int;
begin
  delete from auth.sessions s
   where s.user_id = auth.uid()
     and s.id = p_session_id;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

grant execute on function public.end_login_session(uuid) to authenticated;
