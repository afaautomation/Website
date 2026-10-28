-- Career consultation bookings from the popup on career-consultation.html.
-- Visitors can only add a request; only staff (is_admin) can read, update or delete them.
begin;
create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  situation text not null,
  page_url text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists idx_consultation_requests_created
  on public.consultation_requests(created_at desc);

alter table public.consultation_requests enable row level security;
revoke all on public.consultation_requests from anon, authenticated;
grant insert on public.consultation_requests to anon, authenticated;
grant select, update, delete on public.consultation_requests to authenticated;

drop policy if exists "Public can request a consultation" on public.consultation_requests;
create policy "Public can request a consultation" on public.consultation_requests
  for insert to anon, authenticated with check (true);
drop policy if exists "Staff view consultation requests" on public.consultation_requests;
create policy "Staff view consultation requests" on public.consultation_requests
  for select to authenticated using (public.is_admin());
drop policy if exists "Staff update consultation requests" on public.consultation_requests;
create policy "Staff update consultation requests" on public.consultation_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Staff delete consultation requests" on public.consultation_requests;
create policy "Staff delete consultation requests" on public.consultation_requests
  for delete to authenticated using (public.is_admin());

create table if not exists public.consultation_rate (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists idx_consultation_rate_ip_at on public.consultation_rate(ip, at);
alter table public.consultation_rate enable row level security;
revoke all on public.consultation_rate from anon, authenticated;

-- Validates every request and limits repeats and floods (same approach as guard_course_enrollment).
create or replace function public.guard_consultation_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(split_part(v_headers->>'x-forwarded-for', ',', 1), v_headers->>'cf-connecting-ip', 'unknown');
begin
  new.created_at := now();
  new.name := btrim(coalesce(new.name, ''));
  if not public.is_admin() then new.status := 'new'; end if;

  if new.name = '' or char_length(new.name) > 100 then
    raise exception 'Please enter your name.';
  end if;
  if coalesce(new.phone, '') !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'Please enter a valid 10-digit mobile number.';
  end if;
  if new.situation is null or new.situation not in
     ('Final Year Student', 'Fresh Graduate', 'Job Seeker', 'Working Professional') then
    raise exception 'Please choose what best describes you.';
  end if;
  if char_length(coalesce(new.page_url, '')) > 500 then
    new.page_url := left(new.page_url, 500);
  end if;

  if public.is_admin() then
    return new;
  end if;

  if exists (
    select 1 from public.consultation_requests c
    where c.phone = new.phone and c.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'You have already requested a consultation. Our team will contact you soon.';
  end if;

  delete from public.consultation_rate where at < now() - interval '1 hour';
  if (select count(*) from public.consultation_rate r
      where r.ip = v_ip and r.at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many requests from your network. Please try again in a few minutes.';
  end if;
  insert into public.consultation_rate(ip) values (v_ip);

  -- Wide safety net against a distributed flood.
  if (select count(*) from public.consultation_requests c
      where c.created_at > now() - interval '1 minute') >= 300 then
    raise exception 'Too many requests are being sent right now. Please try again in a minute.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_consultation_request on public.consultation_requests;
create trigger guard_consultation_request
  before insert on public.consultation_requests
  for each row execute function public.guard_consultation_request();
commit;
