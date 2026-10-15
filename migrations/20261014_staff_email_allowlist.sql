-- Migration: 20261014_staff_email_allowlist.sql
-- Description: Staff console access comes from an email allowlist (public.staff_emails)
-- instead of the @kompetenzen.in domain. Add a row to grant access, delete it to revoke.

begin;

-- 1. Allowlist table (edited from the Supabase Table Editor; not readable by site users)
create table if not exists public.staff_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.staff_emails enable row level security;
revoke all on public.staff_emails from anon, authenticated;

create or replace function public.normalize_staff_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists staff_emails_normalize on public.staff_emails;
create trigger staff_emails_normalize
  before insert or update on public.staff_emails
  for each row execute procedure public.normalize_staff_email();

-- 2. Keep current admins so nobody is locked out; delete rows you don't want
insert into public.staff_emails (email, note)
select lower(u.email), 'existing admin'
from auth.users u
join public.profiles p on p.id = u.id
where p.role = 'admin' and u.email is not null
on conflict (email) do nothing;

insert into public.staff_emails (email, note)
values ('afaautomations@gmail.com', 'owner')
on conflict (email) do nothing;

-- 3. Staff check reads the allowlist directly, so changes apply immediately
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.staff_emails s on s.email = lower(u.email)
    where u.id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- 4. New signups get the admin role only when their email is on the allowlist
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := 'user';
begin
  if exists (select 1 from public.staff_emails s where s.email = lower(new.email)) then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'phone',
    v_role
  )
  on conflict (id) do update set role = v_role;
  return new;
end;
$$;

-- 5. Keep profiles.role in step when the allowlist changes
create or replace function public.sync_staff_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.profiles set role = 'user'
    where role = 'admin'
      and id in (select id from auth.users where lower(email) = old.email);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.profiles set role = 'admin'
    where id in (select id from auth.users where lower(email) = new.email);
  end if;
  return null;
end;
$$;

drop trigger if exists staff_emails_sync_role on public.staff_emails;
create trigger staff_emails_sync_role
  after insert or update or delete on public.staff_emails
  for each row execute procedure public.sync_staff_role();

-- 6. Align existing profiles with the allowlist
update public.profiles p set role = 'admin'
where p.role <> 'admin'
  and exists (
    select 1 from auth.users u join public.staff_emails s on s.email = lower(u.email)
    where u.id = p.id
  );

update public.profiles p set role = 'user'
where p.role = 'admin'
  and not exists (
    select 1 from auth.users u join public.staff_emails s on s.email = lower(u.email)
    where u.id = p.id
  );

commit;
