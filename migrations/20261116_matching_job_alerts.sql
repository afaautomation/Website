-- Job alerts: a new open job is sent only to users whose profile matches it (eligibility met, score >= 70),
-- and only to users who allowed Email and/or WhatsApp notifications. No weekly wait and no separate
-- "digest" opt-in. Jobs posted within 5 minutes of each other are grouped into one message per user.
begin;

create or replace function public.queue_job_digests() returns void
language plpgsql security definer set search_path=public as $$
declare n record; jobs jsonb; cutoff timestamptz:=now()-interval '5 minutes';
begin
  for n in select pref.*,to_jsonb(p) profile from public.notification_preferences pref
    join public.candidate_profiles p using(user_id)
    where (pref.email_enabled or pref.whatsapp_enabled)
    -- only users for whom at least one job is newer than their last check are looked at
    and exists(select 1 from public.hr_jobs nj where nj.created_at>pref.digest_since and nj.created_at<=cutoff and public.hr_job_open(nj.expires_on))
    order by pref.digest_since limit 500 for update of pref skip locked
  loop
    select jsonb_agg(jsonb_build_object('id',id,'title',title,'company',company,'location',location,'experience',experience)) into jobs from (
      select j.id,j.title,j.company,j.location,j.experience from public.hr_jobs j
      -- Every filter the profile can answer is checked: skills, soft skills, course, specialisation, career interest/field,
      -- semester and completion year. Required experience months are job-specific answers given when applying,
      -- so they are set to 0 here (the scorer requires both; 0 skips the check) and are checked at application time.
      cross join lateral (select public.evaluate_applicant_match(((j.application_requirements->'matching') || '{"minimumMonths":0,"preferredMonths":0}'::jsonb),
        jsonb_build_object('career',n.profile->'career_preferences','qualification',n.profile->>'qualification','specialisation',n.profile->>'specialisation',
          'semester',n.profile->>'semester','graduationYear',n.profile->>'grad_year')) result) m
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

revoke all on function public.queue_job_digests() from public,anon,authenticated;
grant execute on function public.queue_job_digests() to service_role;

commit;
