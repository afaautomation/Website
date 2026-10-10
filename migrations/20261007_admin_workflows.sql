begin;
create table if not exists public.site_content (
  key text primary key check (key in ('kompetenzen_batch_dates', 'kompetenzen_placed_students')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
drop policy if exists "Read published content" on public.site_content;
create policy "Read published content" on public.site_content for select using (true);
drop policy if exists "Admins publish content" on public.site_content;
create policy "Admins publish content" on public.site_content for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_jobs()
returns setof public.hr_jobs language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query select * from public.hr_jobs order by created_at desc;
end;
$$;
revoke all on function public.admin_jobs() from public;
grant execute on function public.admin_jobs() to authenticated;

create or replace function public.replace_reels(p_reels text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_reels is null or exists (select 1 from unnest(p_reels) r where r is null or r !~ '^[A-Za-z0-9_-]{6,64}$')
    then raise exception 'Invalid reel ID'; end if;
  -- Serialize complete replacements; an insert failure rolls back the delete.
  lock table public.reels in exclusive mode;
  delete from public.reels;
  insert into public.reels(reel_id, sort_order)
    select r, (ordinality - 1)::int from unnest(p_reels) with ordinality as t(r, ordinality);
end;
$$;
revoke all on function public.replace_reels(text[]) from public;
grant execute on function public.replace_reels(text[]) to authenticated;
commit;
