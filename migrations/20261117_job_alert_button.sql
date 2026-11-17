-- 1. Job alerts go to candidates whose profile matches a listing 50% or more (was 70%).
-- 2. "Notify matching candidates" button in the HR Console: send_job_alert(job) sends one listing
--    to every matching candidate now. Run with p_send = false first to get the counts.
-- Only candidates who turned on Email and/or WhatsApp notifications are messaged, never one who
-- already applied, and never twice for the same listing (automatic alert or earlier click).
-- Safe to re-run. Run in the Supabase SQL Editor.
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
      and m.result->>'status'='matched' and (m.result->>'score')::numeric>=50
      and not exists(select 1 from public.job_applications a where a.user_id=n.user_id and a.job_id=j.id)
      -- skip a listing HR already sent with the button
      and not exists(select 1 from public.notification_queue q where q.user_id=n.user_id and q.event_key=n.user_id||':jobalert:'||j.id)
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

create or replace function public.send_job_alert(p_job_id uuid, p_send boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare j public.hr_jobs; c record; item jsonb; matched int:=0; already int:=0; queued int:=0;
begin
  if not public.is_admin() then raise exception 'Staff access required.' using errcode='42501'; end if;
  select * into j from public.hr_jobs where id=p_job_id;
  if not found then raise exception 'Listing not found.' using errcode='P0002'; end if;
  if not public.hr_job_open(j.expires_on) then
    raise exception 'This listing has expired. Set a new expiry date first.' using errcode='22023';
  end if;
  if jsonb_typeof(j.application_requirements->'matching')<>'object' or j.application_requirements->'matching' is null then
    raise exception 'Turn on candidate matching for this listing first (Edit listing).' using errcode='22023';
  end if;
  item:=jsonb_build_object('id',j.id,'title',j.title,'company',j.company,'location',j.location,'experience',j.experience);

  for c in
    select pref.user_id, p.name,
      exists(select 1 from public.notification_queue q where q.user_id=pref.user_id
             and (q.event_key=pref.user_id||':jobalert:'||j.id
                  or (q.payload->>'event'='digest' and q.payload->'jobs' @> jsonb_build_array(jsonb_build_object('id',j.id::text))))) as notified
    from public.notification_preferences pref
    join public.candidate_profiles p using(user_id)
    cross join lateral (select public.evaluate_applicant_match(((j.application_requirements->'matching') || '{"minimumMonths":0,"preferredMonths":0}'::jsonb),
      jsonb_build_object('career',p.career_preferences,'qualification',p.qualification,'specialisation',p.specialisation,
        'semester',p.semester::text,'graduationYear',p.grad_year::text)) result) m
    where (pref.email_enabled or pref.whatsapp_enabled)
      and not exists(select 1 from public.job_applications a where a.user_id=pref.user_id and a.job_id=j.id)
      and m.result->>'status'='matched' and (m.result->>'score')::numeric>=50
  loop
    matched:=matched+1;
    if c.notified then
      already:=already+1;
    elsif p_send then
      perform public.enqueue_notification(c.user_id, c.user_id||':jobalert:'||j.id,
        jsonb_build_object('event','digest','jobs',jsonb_build_array(item),'title','New opportunities matching your profile','name',c.name));
      queued:=queued+1;
    end if;
  end loop;
  return jsonb_build_object('matched',matched,'already_notified',already,'queued',queued);
end; $$;

revoke all on function public.send_job_alert(uuid,boolean) from public,anon;
grant execute on function public.send_job_alert(uuid,boolean) to authenticated, service_role;

commit;
notify pgrst, 'reload schema';
