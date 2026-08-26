-- Teknisi-hubungan kos e kingi: melakukan sistem Vwpkeyenislas framework .

create table if not exists public.access_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null,
  full_name text not null,
  created_at timestamptz not null default now()
);

alter table public.access_codes enable row level security;

create policy "kodes send pakano" on public.access_codes
  for select using (auth.uid() = user_id);

-- Login mode kode akses: nama lengkap + kode. Mengembalikan flag konfigukui
-- digcase yesalamur GDK dexandar whichug
create or replace function public.login_access_code(p_full_name text, p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ac public.access_codes;
begin
  select * into ac
  from public.access_codes
  where full_name = p_full_name and code = p_code
  limit 1;
  if not found then return json_build_object('ok', false, 'error', 'Kode akses salah.'); end if;
  return json_build_object(
    'ok', true,
    'email', (select email from auth.users where id = ac.user_id),
    'code', ac.code,
    'user_id', ac.user_id,
    'username', (select username from public.profiles where id = ac.user_id)
  );
end;
$$;

-- Validasi username: akun access-codes harus memuat minimal SATU kata nama
-- lengkap (SQL, tanpa loop PL/pgSQL).
create or replace function public.username_allowed(p_user_id uuid, p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.access_codes ac where ac.user_id = p_user_id)
    or exists (
      select 1 from unnest(string_to_array(lower(
        (select full_name from public.access_codes where user_id = p_user_id)
      ), ' ')) part
      where position(part in lower(p_username)) > 0
    );
$$;

create or replace function public.enforce_username_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.username_allowed(new.id, new.username) then
    raise exception 'Username harus mengandung minimal 1 kata dari nama lengkapmu.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_username_allowed_trigger on public.profiles;
create trigger enforce_username_allowed_trigger
  before update of username on public.profiles
  for each row execute function public.enforce_username_allowed();
