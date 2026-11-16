-- Security hardening found in the 2026-11-16 audit. Safe to re-run.
-- Run in the Supabase SQL Editor together with 20261116_resume_upload_signed_in_only.sql.
begin;

-- 1. Resume Builder: a resume is readable by its owner only.
-- The old policy let anyone, without an account, list every resume marked is_public
-- (names, emails, phone numbers, work history). Nothing on the site offers sharing,
-- and a signed-in user could set the flag on their own row and send the link to
-- someone else, whose editor would then load content written by a stranger.
drop policy if exists "Public can view public resumes" on public.resumes;

-- 2. Size limits on what one account can store. Browsers can write these tables
-- directly (row-level security only checks ownership), so without limits a single
-- account could fill the database. NOT VALID: existing rows are not re-checked.
alter table public.resumes drop constraint if exists resumes_size_check;
alter table public.resumes add constraint resumes_size_check check (
  char_length(title) <= 200
  and char_length(coalesce(slug, '')) <= 200
  and octet_length(content::text) <= 1000000
  and octet_length(design::text) <= 20000
  and octet_length(section_order::text) <= 5000
  and octet_length(coalesce(ats_feedback, '[]'::jsonb)::text) <= 200000
) not valid;

alter table public.resume_versions drop constraint if exists resume_versions_size_check;
alter table public.resume_versions add constraint resume_versions_size_check check (
  octet_length(snapshot::text) <= 1200000 and char_length(coalesce(label, '')) <= 200
) not valid;

alter table public.import_jobs drop constraint if exists import_jobs_size_check;
alter table public.import_jobs add constraint import_jobs_size_check check (
  char_length(source_type) <= 200 and char_length(status) <= 40
  and octet_length(coalesce(extracted, '{}'::jsonb)::text) <= 1000000
  and char_length(coalesce(error, '')) <= 2000
) not valid;

-- At most 100 resumes per account.
create or replace function public.limit_resumes_per_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.resumes r where r.user_id = new.user_id) >= 100 then
    raise exception 'You can keep up to 100 resumes. Delete one to add another.' using errcode = '23514';
  end if;
  return new;
end; $$;
revoke all on function public.limit_resumes_per_user() from public, anon, authenticated;
drop trigger if exists limit_resumes_per_user on public.resumes;
create trigger limit_resumes_per_user before insert on public.resumes
  for each row execute function public.limit_resumes_per_user();

-- History keeps the newest 50 versions of a resume; older ones are removed as new
-- ones arrive (never refused, so saving a resume cannot start failing).
create or replace function public.prune_resume_versions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.resume_versions v
  where v.resume_id = new.resume_id
    and v.id in (select o.id from public.resume_versions o where o.resume_id = new.resume_id
                 order by o.version_num desc, o.created_at desc offset 50);
  return null;
end; $$;
revoke all on function public.prune_resume_versions() from public, anon, authenticated;
drop trigger if exists prune_resume_versions on public.resume_versions;
create trigger prune_resume_versions after insert on public.resume_versions
  for each row execute function public.prune_resume_versions();

-- Import records: keep the newest 20 per account.
create or replace function public.prune_import_jobs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.import_jobs j
  where j.user_id = new.user_id
    and j.id in (select o.id from public.import_jobs o where o.user_id = new.user_id
                 order by o.created_at desc, o.id offset 20);
  return null;
end; $$;
revoke all on function public.prune_import_jobs() from public, anon, authenticated;
drop trigger if exists prune_import_jobs on public.import_jobs;
create trigger prune_import_jobs after insert on public.import_jobs
  for each row execute function public.prune_import_jobs();

-- 3. A candidate's saved resume link may only point at a file in the shared
-- applications/ folder or in the candidate's own folder. Staff open this link with
-- their own access, so an arbitrary path could make them open another person's file.
-- Checked only when the link changes, so older rows keep saving as before.
create or replace function public.guard_candidate_resume_url()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.resume_url is not null and new.resume_url <> ''
     and (tg_op = 'INSERT' or new.resume_url is distinct from old.resume_url)
     and (new.resume_url ~ '\.\.' or new.resume_url ~ '[\\\s]'
          or not (new.resume_url ~ '^applications/[^/]+$'
                  or left(new.resume_url, 37) = new.user_id::text || '/')) then
    raise exception 'Invalid resume file reference.' using errcode = '23514';
  end if;
  return new;
end; $$;
drop trigger if exists guard_candidate_resume_url on public.candidate_profiles;
create trigger guard_candidate_resume_url before insert or update on public.candidate_profiles
  for each row execute function public.guard_candidate_resume_url();

commit;
