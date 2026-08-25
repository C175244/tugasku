-- Signup yang belum terverifikasi tidak boleh mengambil username. Profil
-- dibuat lewat helper internal; handle_new_user dan handle_email_confirmed
-- memanggil helper itu (memanggil fungsi trigger langsung tidak bisa).

create or replace function public.profile_from_user(u auth.users)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := coalesce(
    nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'username', ''), '[^a-zA-Z0-9_.]', '', 'g'), ''),
    nullif(regexp_replace(split_part(coalesce(u.email, 'user'), '@', 1), '[^a-zA-Z0-9_.]', '', 'g'), ''),
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
    u.id,
    final_username,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    u.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Untuk signup email (membutuhkan konfirmasi email), jangan langsung buat
  -- profil: tunggu email_confirmed_at agar username-nya tidak terkunci.
  if new.email_confirmed_at is null and (new.raw_user_meta_data->>'username') is not null then
    return new;
  end if;
  perform public.profile_from_user(new);
  return new;
end;
$$;

create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.profile_from_user(new);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_email_confirmed();
