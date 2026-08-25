-- Username harus benar-benar berbeda: tidak boleh sama persis (tanpa
-- memedulikan huruf besar/kecil) dan tidak boleh terlalu mirip — beda
-- minimal 3 karakter dari username mana pun yang sudah ada.
-- Contoh: sudah ada "NasiGoreng8" maka "NasiGoreng8", "nasigoreng8",
-- "NasiGoreng89", "NasiGoreng98" ditolak; "NasiGoreng7832" diterima.

create extension if not exists fuzzystrmatch;

-- true bila username boleh dipakai (beda >= 3 karakter dari semua yang ada).
create or replace function public.username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return not exists (
    select 1 from public.profiles p
    where levenshtein(lower(p.username), lower(p_username)) < 3
  );
end;
$$;

-- Dipanggil sebelum daftar / ganti username agar pesan errornya jelas.
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.enforce_username_distance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.username = old.username then
    return new;
  end if;
  if exists (
    select 1 from public.profiles p
    where p.id <> new.id
      and levenshtein(lower(p.username), lower(new.username)) < 3
  ) then
    raise exception 'Username sudah dipakai atau terlalu mirip dengan username lain. Pilih username yang beda minimal 3 karakter.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_username_distance on public.profiles;
create trigger profiles_username_distance
  before insert or update of username on public.profiles
  for each row execute function public.enforce_username_distance();

-- Generator username otomatis (saat daftar) juga mengikuti aturan jarak:
-- kalau terlalu mirip, pakai acak 5 digit supaya selalu beda >= 3 karakter.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
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

  while exists (
    select 1 from public.profiles p
    where levenshtein(lower(p.username), lower(final_username)) < 3
  ) loop
    final_username := left(base_username, 16)
      || '_' || lpad(floor(random() * 100000)::int::text, 5, '0');
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
