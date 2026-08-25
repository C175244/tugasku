-- Signup yang belum terverifikasi tidak boleh mengambil username. Sebelum
-- ini handle_new_user() langsung membuat profiles, sehingga username sudah
-- terpakai di bawa email konfirmasi dibatalkan. Sekarang profil dibuat hanya
-- bila email_confirmed_at sudah diisi (untuk OAuth/Ganti agama); email
-- signup memakai trigger konfirmasi yang mengarah ke pemilik.

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
  -- Untuk signup email (membutuhkan konfirmasi email), jangan langsung buat
  -- profil: tunggu email_confirmed_at agar username-nya tidak terkunci. Ini
  -- memungkinkan orang lain memakai username yang sama sampai konfirmasi.
  if new.email_confirmed_at is null and (new.raw_user_meta_data->>'username') is not null then
    return new;
  end if;

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

-- Versi trigger eksekusi saat hanya email konfirmasi berubah menjadi terisi.
create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    return public.handle_new_user(new);
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
