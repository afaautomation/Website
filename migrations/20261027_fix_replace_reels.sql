-- Fixes "DELETE requires a WHERE clause" when publishing reels from the admin console.
-- Supabase's pg_safeupdate rejects unfiltered deletes from API requests, including inside functions.
begin;
create or replace function public.replace_reels(p_reels text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_reels is null or exists (select 1 from unnest(p_reels) r where r is null or r !~ '^[A-Za-z0-9_-]{6,64}$')
    then raise exception 'Invalid reel ID'; end if;
  -- Serialize complete replacements; an insert failure rolls back the delete.
  lock table public.reels in exclusive mode;
  -- The explicit filter satisfies pg_safeupdate; every row is still removed.
  delete from public.reels where true;
  insert into public.reels(reel_id, sort_order)
    select r, (ordinality - 1)::int from unnest(p_reels) with ordinality as t(r, ordinality);
end;
$$;
revoke all on function public.replace_reels(text[]) from public;
grant execute on function public.replace_reels(text[]) to authenticated;
commit;
