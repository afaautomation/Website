-- Employer portal, part 7: a company can pause a listing and resume it later.
-- Safe to re-run. Run after 20261129_employer_applicant_stages.sql and before publishing the updated employer.html.
--
-- A paused listing is hidden the same way as the listings of a suspended company (hr_jobs.held): the jobs
-- pages, job_details() and new applications all skip it, and candidates who already applied can still open it.
--   * hr_jobs.paused records the company's own choice, so approving the company again keeps it paused
--   * employer_pause_job(id, true | false) pauses or resumes a listing that has not closed
--   * closing a listing also ends its pause
--   * employer_my_jobs() says which listings are paused and which have closed
-- Paused listings still count towards the 50 open listings a company may have.
begin;

-- 1. The company's own pause ---------------------------------------------------------------------
alter table public.hr_jobs add column if not exists paused boolean not null default false;

-- 2. Approving or suspending a company shows or hides its listings, except the ones it paused --------
create or replace function public.employer_sync_held()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    update public.hr_jobs set held = (new.status <> 'approved') or paused where employer_id = new.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.employer_sync_held() from public, anon, authenticated;

-- 3. Pause or resume a listing ---------------------------------------------------------------------
create or replace function public.employer_pause_job(p_id uuid, p_paused boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.employer_companies := public.employer_approved_company();
  v_expires date; v_was boolean;
begin
  if p_paused is null then raise exception 'Choose pause or resume.' using errcode = 'P0001'; end if;
  select expires_on, paused into v_expires, v_was
  from public.hr_jobs where id = p_id and employer_id = c.id for update;
  if not found then raise exception 'Listing not found.' using errcode = 'P0001'; end if;
  if not public.hr_job_open(v_expires) then raise exception 'This listing has closed.' using errcode = 'P0001'; end if;
  if v_was = p_paused then return; end if;
  -- The company is approved (checked above), so the listing is hidden exactly when it is paused.
  update public.hr_jobs set paused = p_paused, held = p_paused where id = p_id;
  perform public.employer_log(c.id, case when p_paused then 'job_paused' else 'job_resumed' end, jsonb_build_object('job', p_id));
end;
$$;
revoke all on function public.employer_pause_job(uuid, boolean) from public, anon;
grant execute on function public.employer_pause_job(uuid, boolean) to authenticated;

-- 4. Closing a listing also ends its pause, so a later new date from our staff is not hidden by it -
create or replace function public.employer_close_job(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public.employer_user(); v_company uuid; v_approved boolean; v_n int;
begin
  select id, status = 'approved' into v_company, v_approved from public.employer_companies where owner_id = v;
  update public.hr_jobs set expires_on = (now() at time zone 'Asia/Kolkata')::date - 1,
         paused = false, held = not coalesce(v_approved, false)
    where id = p_id and employer_id = v_company and v_company is not null;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Listing not found.' using errcode = 'P0001'; end if;
  perform public.employer_log(v_company, 'job_closed', jsonb_build_object('job', p_id));
end;
$$;
revoke all on function public.employer_close_job(uuid) from public, anon;
grant execute on function public.employer_close_job(uuid) to authenticated;

-- 5. The company's listings now say which are paused and which have closed (as in 20261129 otherwise)
create or replace function public.employer_my_jobs()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := public.employer_user(); v_company uuid;
begin
  select id into v_company from public.employer_companies where owner_id = v;
  if v_company is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', j.id, 'title', j.title, 'category', j.category, 'job_type', j.job_type, 'location', j.location,
      'experience', j.experience, 'salary', j.salary, 'skills', j.skills, 'description', j.description,
      'responsibilities', j.responsibilities, 'requirements', j.requirements,
      'expires_on', j.expires_on, 'created_at', j.created_at, 'held', j.held,
      'paused', j.paused, 'closed', not public.hr_job_open(j.expires_on),
      'open', public.hr_job_open(j.expires_on) and not j.held,
      'questions', coalesce(j.application_requirements->'questions', '[]'::jsonb),
      'matching', j.application_requirements->'matching',
      'applicants', (select count(*) from public.job_applications a where a.job_id = j.id),
      'shortlisted', (select count(*) from public.job_applications a
                      where a.job_id = j.id and a.employer_status in ('shortlisted', 'contacted', 'interview', 'selected'))
    ) order by j.created_at desc)
    from public.hr_jobs j where j.employer_id = v_company), '[]'::jsonb);
end;
$$;
revoke all on function public.employer_my_jobs() from public, anon;
grant execute on function public.employer_my_jobs() to authenticated;

commit;
