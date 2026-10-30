-- Python Full Stack with Generative AI enrolment enquiries from the popup on genai-course-details.html.
-- Mirrors dyf_seat_requests: visitors can only add an enquiry; only staff (is_admin) can read, update or delete them.
begin;
create table if not exists public.genai_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  python_level text not null,
  page_url text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists idx_genai_enquiries_created
  on public.genai_enquiries(created_at desc);

alter table public.genai_enquiries enable row level security;
revoke all on public.genai_enquiries from anon, authenticated;
grant insert on public.genai_enquiries to anon, authenticated;
grant select, update, delete on public.genai_enquiries to authenticated;

drop policy if exists "Public can send a GenAI enquiry" on public.genai_enquiries;
create policy "Public can send a GenAI enquiry" on public.genai_enquiries
  for insert to anon, authenticated with check (true);
drop policy if exists "Staff view GenAI enquiries" on public.genai_enquiries;
create policy "Staff view GenAI enquiries" on public.genai_enquiries
  for select to authenticated using (public.is_admin());
drop policy if exists "Staff update GenAI enquiries" on public.genai_enquiries;
create policy "Staff update GenAI enquiries" on public.genai_enquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Staff delete GenAI enquiries" on public.genai_enquiries;
create policy "Staff delete GenAI enquiries" on public.genai_enquiries
  for delete to authenticated using (public.is_admin());

create table if not exists public.genai_enquiry_rate (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists idx_genai_enquiry_rate_ip_at on public.genai_enquiry_rate(ip, at);
alter table public.genai_enquiry_rate enable row level security;
revoke all on public.genai_enquiry_rate from anon, authenticated;

-- Validates every enquiry and limits repeats and floods (same approach as guard_dyf_seat_request).
create or replace function public.guard_genai_enquiry()
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
  if new.python_level is null or new.python_level not in
     ('Comfortable with Python', 'Know some Python', 'New to coding') then
    raise exception 'Please choose your Python experience.';
  end if;
  if char_length(coalesce(new.page_url, '')) > 500 then
    new.page_url := left(new.page_url, 500);
  end if;

  if public.is_admin() then
    return new;
  end if;

  if exists (
    select 1 from public.genai_enquiries s
    where s.phone = new.phone and s.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'You have already enquired. Our team will contact you soon.';
  end if;

  delete from public.genai_enquiry_rate where at < now() - interval '1 hour';
  if (select count(*) from public.genai_enquiry_rate r
      where r.ip = v_ip and r.at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many requests from your network. Please try again in a few minutes.';
  end if;
  insert into public.genai_enquiry_rate(ip) values (v_ip);

  -- Wide safety net against a distributed flood.
  if (select count(*) from public.genai_enquiries s
      where s.created_at > now() - interval '1 minute') >= 300 then
    raise exception 'Too many requests are being sent right now. Please try again in a minute.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_genai_enquiry on public.genai_enquiries;
create trigger guard_genai_enquiry
  before insert on public.genai_enquiries
  for each row execute function public.guard_genai_enquiry();
commit;
