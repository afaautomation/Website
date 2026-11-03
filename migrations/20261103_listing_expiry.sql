-- Expiry dates for job and internship listings.
-- expires_on is the last day candidates can apply (India time). From the next day the
-- listing is hidden from the public pages and new applications are refused, but the
-- row and every application to it stay in the database and in the admin console.
begin;

alter table public.hr_jobs add column if not exists expires_on date;

create or replace function public.hr_job_open(p_expires_on date)
returns boolean language sql stable set search_path = public as $$
  select p_expires_on is null or p_expires_on >= (now() at time zone 'Asia/Kolkata')::date;
$$;
revoke all on function public.hr_job_open(date) from public;
grant execute on function public.hr_job_open(date) to anon, authenticated, service_role;

-- Visitors see only open listings; staff still see everything through "Admins can manage jobs" and admin_jobs().
drop policy if exists "Public can view jobs" on public.hr_jobs;
create policy "Public can view jobs" on public.hr_jobs
  for select to public using (public.hr_job_open(expires_on));

grant select (expires_on) on public.hr_jobs to anon, authenticated;

-- Same columns as before; an expired listing is returned only to staff and to candidates who applied.
create or replace function public.job_details(p_job_id uuid)
returns table (
  id uuid, title text, category text, company text, location text, job_type text,
  experience text, salary text, skills text, description text, responsibilities text,
  requirements text, about_company text, apply_url text, is_direct_link boolean,
  created_at timestamptz, application_requirements jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.title, j.category, j.company, j.location, j.job_type,
         j.experience, j.salary, j.skills, j.description, j.responsibilities,
         j.requirements, j.about_company,
         case when (
           public.is_admin()
           or exists (select 1 from public.job_applications a
                      where a.user_id = auth.uid() and a.job_id = j.id)
         ) then j.apply_url else null end as apply_url,
         j.is_direct_link, j.created_at, j.application_requirements
  from public.hr_jobs j
  where j.id = p_job_id
    and (public.hr_job_open(j.expires_on)
         or public.is_admin()
         or exists (select 1 from public.job_applications a
                    where a.user_id = auth.uid() and a.job_id = j.id));
$$;
revoke all on function public.job_details(uuid) from public;
grant execute on function public.job_details(uuid) to anon, authenticated, service_role;

-- New applications to an expired listing are refused, whichever path inserts them.
create or replace function public.guard_listing_open()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.hr_jobs j where j.id = new.job_id and not public.hr_job_open(j.expires_on))
     and not public.is_admin() then
    raise exception 'This opening has closed and is no longer accepting applications.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_listing_open() from public;

drop trigger if exists guard_listing_open on public.job_applications;
create trigger guard_listing_open
  before insert on public.job_applications
  for each row execute function public.guard_listing_open();

commit;
