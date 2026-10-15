-- Migration: 20261011_staff_domain_admin.sql
-- Description: Automatically assign 'admin' role to staff accounts ending with @kompetenzen.in

begin;

-- 1. Update the new user trigger function to assign admin role if email ends with @kompetenzen.in
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := 'user';
begin
  if new.email ilike '%@kompetenzen.in' then
    v_role := 'admin';
  end if;

  insert into public.profiles (id, name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'phone',
    v_role
  )
  on conflict (id) do update set
    role = case when new.email ilike '%@kompetenzen.in' then 'admin' else profiles.role end;
  return new;
end;
$$;

-- 2. Promote any existing profiles associated with @kompetenzen.in
update public.profiles set role = 'admin'
where id in (
  select id from auth.users where email ilike '%@kompetenzen.in'
);

commit;
