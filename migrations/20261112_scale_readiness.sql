-- Scale readiness for ~10,000+ users/month. Safe to run more than once.

-- 1) Faster notification claiming when the queue is large (claim orders by created_at, id).
create index if not exists notification_pending_order
  on public.notification_queue(created_at, id) where state = 'pending';

-- 2) Job list ordering.
create index if not exists hr_jobs_created_desc on public.hr_jobs(created_at desc);

-- 3) Keep only the newest 20 saved versions per resume so snapshots cannot grow without limit.
create or replace function public.trim_resume_versions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.resume_versions
  where resume_id = new.resume_id
    and id in (select id from public.resume_versions
               where resume_id = new.resume_id
               order by version_num desc, created_at desc offset 20);
  return null;
end; $$;
revoke all on function public.trim_resume_versions() from public, anon, authenticated;
drop trigger if exists trim_resume_versions on public.resume_versions;
create trigger trim_resume_versions after insert on public.resume_versions
  for each row execute function public.trim_resume_versions();
