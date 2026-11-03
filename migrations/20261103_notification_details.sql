-- Notification wording now greets the candidate by name and names the hiring company; digests
-- also list each job's company, location and experience, and skip expired listings.
-- Run after 20261015_notifications.sql and 20261103_listing_expiry.sql (uses public.hr_job_open).
begin;

create or replace function public.application_notifications() returns trigger
language plpgsql security definer set search_path=public as $$
declare p jsonb; v_company text; v_name text;
begin
  select j.company into v_company from public.hr_jobs j where j.id=new.job_id;
  v_name:=coalesce(nullif(trim(new.name),''),(select c.name from public.candidate_profiles c where c.user_id=new.user_id));
  p:=jsonb_build_object('job_id',new.job_id,'title',coalesce(new.job_role,'your application'),
    'company',coalesce(nullif(trim(v_company),''),nullif(trim(new.company),'')),'name',v_name);
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
    select jsonb_agg(jsonb_build_object('id',id,'title',title,'company',company,'location',location,'experience',experience)) into jobs from (
      select j.id,j.title,j.company,j.location,j.experience from public.hr_jobs j
      cross join lateral (select public.evaluate_applicant_match(j.application_requirements->'matching',
        jsonb_build_object('career',n.profile->'career_preferences','qualification',n.profile->>'qualification','specialisation',n.profile->>'specialisation')) result) m
      where j.created_at>n.digest_since and j.created_at<=cutoff and public.hr_job_open(j.expires_on)
      and m.result->>'status'='matched' and (m.result->>'score')::numeric>=70
      and not exists(select 1 from public.job_applications a where a.user_id=n.user_id and a.job_id=j.id)
      order by (m.result->>'score')::numeric desc,j.created_at desc limit 10
    ) suitable;
    if jobs is not null then
      perform public.enqueue_notification(n.user_id,n.user_id||':digest:'||cutoff,
        jsonb_build_object('event','digest','jobs',jobs,'title','New opportunities matching your profile','name',n.profile->>'name'));
    end if;
    update public.notification_preferences set digest_since=cutoff where user_id=n.user_id;
  end loop;
end; $$;

revoke all on function public.application_notifications(),public.queue_job_digests() from public,anon,authenticated;
grant execute on function public.queue_job_digests() to service_role;

commit;
