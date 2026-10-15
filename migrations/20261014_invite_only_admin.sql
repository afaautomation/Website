-- Run after the existing website schema. This does not send invitations.
-- Existing staff_emails entries are preserved: review them before running.
begin;

create table if not exists public.staff_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);
alter table public.staff_emails enable row level security;
revoke all on public.staff_emails from public, anon, authenticated;
grant all on public.staff_emails to service_role;

create or replace function public.normalize_staff_email()
returns trigger language plpgsql set search_path = public as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;
drop trigger if exists staff_emails_normalize on public.staff_emails;
create trigger staff_emails_normalize before insert or update on public.staff_emails
for each row execute function public.normalize_staff_email();

-- Authorization is checked against a protected list and a verified identity.
-- A domain, user metadata or a manually modified profiles.role is insufficient.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u
    join public.staff_emails s on s.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- No signup automatically grants staff access, regardless of email domain.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, phone, role)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'phone', 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- The old mirrored role is no longer an authorization source.
drop trigger if exists staff_emails_sync_role on public.staff_emails;
drop function if exists public.sync_staff_role();
alter table public.profiles enable row level security;
revoke insert, update, delete on public.profiles from public, anon, authenticated;
revoke update (role), insert (role) on public.profiles from public, anon, authenticated;
grant update (name, phone, avatar_url) on public.profiles to authenticated;

-- Defense in depth if broader table privileges are accidentally granted later.
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.role is distinct from 'user' then
      raise exception 'Role changes require the owner' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Role changes require the owner' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before insert or update on public.profiles
for each row execute function public.protect_profile_role();
commit;
