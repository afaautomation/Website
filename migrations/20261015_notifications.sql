-- Run after 20261015_career_matching.sql. Network delivery runs separately.
begin;
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  whatsapp_number text not null default '',
  job_digest text not null default 'off' check (job_digest in ('off','daily','weekly')),
  consent_at timestamptz not null default now(),
  digest_since timestamptz not null default now(),
  check (not whatsapp_enabled or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$')
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
drop policy if exists "Read own notification preferences" on public.notification_preferences;
create policy "Read own notification preferences" on public.notification_preferences for select to authenticated using (user_id=auth.uid());
create or replace function public.save_notification_preferences(p_email boolean,p_whatsapp boolean,p_number text,p_digest text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into public.notification_preferences(user_id,email_enabled,whatsapp_enabled,whatsapp_number,job_digest)
  values(auth.uid(),p_email,p_whatsapp,trim(p_number),p_digest)
  on conflict(user_id) do update set email_enabled=p_email,whatsapp_enabled=p_whatsapp,
    whatsapp_number=trim(p_number),job_digest=p_digest,consent_at=now();
end; $$;
revoke all on function public.save_notification_preferences(boolean,boolean,text,text) from public;
grant execute on function public.save_notification_preferences(boolean,boolean,text,text) to authenticated;

create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  channel text not null check(channel in ('email','whatsapp')),
  payload jsonb not null,
  delivery jsonb,
  state text not null default 'pending' check(state in ('pending','sending','accepted','cancelled','failed','review')),
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  first_attempt_at timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  unique(event_key,channel)
);
alter table public.notification_queue enable row level security;
revoke all on public.notification_queue from anon,authenticated;
grant all on public.notification_queue to service_role;
grant all on public.notification_preferences to service_role;
create index if not exists notification_pending on public.notification_queue(available_at) where state='pending';

create or replace function public.enqueue_notification(u uuid,k text,p jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  insert into public.notification_queue(user_id,event_key,channel,payload)
  select u,k,c,p from public.notification_preferences n
  cross join lateral (select 'email' c where n.email_enabled union all select 'whatsapp' where n.whatsapp_enabled) channels
  where n.user_id=u on conflict(event_key,channel) do nothing;
end; $$;

alter table public.job_applications add column if not exists hr_status text not null default 'received'
  check(hr_status in ('received','under_review','shortlisted','interview','selected','rejected'));
create or replace function public.application_notifications() returns trigger
language plpgsql security definer set search_path=public as $$
declare p jsonb;
begin
  p:=jsonb_build_object('job_id',new.job_id,'title',coalesce(new.job_role,'your application'));
  if tg_op='INSERT' then
    perform public.enqueue_notification(new.user_id,new.id||':received',p||'{"event":"received"}');
  end if;
  if tg_op='INSERT' or new.match_result->>'status' is distinct from old.match_result->>'status' then
    if new.match_result->>'status' in ('matched','not_matched') then
      perform public.enqueue_notification(new.user_id,new.id||':'||(new.match_result->>'status'),
        p||jsonb_build_object('event',new.match_result->>'status','reasons',new.match_result->'reasons'));
    end if;
  end if;
  if tg_op='UPDATE' and new.hr_status is distinct from old.hr_status then
    perform public.enqueue_notification(new.user_id,new.id||':hr:'||gen_random_uuid(),
      p||jsonb_build_object('event','hr_status','status',new.hr_status));
  end if;
  return new;
end; $$;
drop trigger if exists application_notifications on public.job_applications;
create trigger application_notifications after insert or update on public.job_applications for each row execute function public.application_notifications();

-- Only new jobs that pass the same eligibility evaluator and score >=70 enter a digest.
-- Missing optional evidence earns no bonus; missing essential evidence never qualifies.
create or replace function public.queue_job_digests() returns void
language plpgsql security definer set search_path=public as $$
declare n record; jobs jsonb; cutoff timestamptz:=now();
begin
  for n in select pref.*,to_jsonb(p) profile from public.notification_preferences pref
    join public.candidate_profiles p using(user_id)
    where pref.job_digest<>'off' and (pref.email_enabled or pref.whatsapp_enabled)
    and pref.digest_since <= cutoff-case when pref.job_digest='daily' then interval '1 day' else interval '7 days' end
    order by pref.digest_since limit 100 for update of pref skip locked
  loop
    select jsonb_agg(jsonb_build_object('id',id,'title',title)) into jobs from (
      select j.id,j.title from public.hr_jobs j
      cross join lateral (select public.evaluate_applicant_match(j.application_requirements->'matching',
        jsonb_build_object('career',n.profile->'career_preferences','qualification',n.profile->>'qualification','specialisation',n.profile->>'specialisation')) result) m
      where j.created_at>n.digest_since and j.created_at<=cutoff
      and m.result->>'status'='matched' and (m.result->>'score')::numeric>=70
      and not exists(select 1 from public.job_applications a where a.user_id=n.user_id and a.job_id=j.id)
      order by (m.result->>'score')::numeric desc,j.created_at desc limit 10
    ) suitable;
    if jobs is not null then
      perform public.enqueue_notification(n.user_id,n.user_id||':digest:'||cutoff,
        jsonb_build_object('event','digest','jobs',jobs,'title','New opportunities matching your profile'));
    end if;
    update public.notification_preferences set digest_since=cutoff where user_id=n.user_id;
  end loop;
end; $$;

create or replace function public.notification_alternatives(p_user uuid,p_exclude uuid) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title)),'[]') from (
    select j.id,j.title from public.hr_jobs j join public.candidate_profiles p on p.user_id=p_user
    cross join lateral (select public.evaluate_applicant_match(j.application_requirements->'matching',jsonb_build_object(
      'career',p.career_preferences,'qualification',p.qualification,'specialisation',p.specialisation)) result) m
    where j.id is distinct from p_exclude and m.result->>'status'='matched' and (m.result->>'score')::numeric>=70
    and not exists(select 1 from public.job_applications a where a.user_id=p_user and a.job_id=j.id)
    order by (m.result->>'score')::numeric desc,j.created_at desc limit 3
  ) suitable
$$;
revoke all on function public.notification_alternatives(uuid,uuid) from public,anon,authenticated;
grant execute on function public.notification_alternatives(uuid,uuid) to service_role;

create or replace function public.claim_notification() returns setof public.notification_queue
language plpgsql security definer set search_path=public as $$
begin
  -- A crashed sender may have reached its provider: never blindly send again.
  update public.notification_queue set state='review',last_error='Sender interrupted; reconcile with provider before retrying'
    where state='sending' and started_at<now()-interval '10 minutes';
  return query update public.notification_queue q set state='sending',attempts=attempts+1,started_at=now(),first_attempt_at=coalesce(first_attempt_at,now())
    where q.id=(select id from public.notification_queue where state='pending' and available_at<=now()
    order by created_at,id for update skip locked limit 1) returning q.*;
end; $$;
revoke all on function public.enqueue_notification(uuid,text,jsonb),public.application_notifications(),public.queue_job_digests(),public.claim_notification() from public,anon,authenticated;
grant execute on function public.queue_job_digests(),public.claim_notification() to service_role;
commit;
