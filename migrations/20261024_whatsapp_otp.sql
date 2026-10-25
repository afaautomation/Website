-- Run after 20261015_notifications.sql. Signup codes sent over WhatsApp replace Firebase SMS.
-- Only Edge Functions (service role) can issue or check codes; browsers have no access.
-- A code is stored as a keyed hash, expires after 10 minutes and allows 5 guesses.
-- Limits per number: one send per 30 seconds, 5 per hour. Per client IP: 10 per hour.
begin;
create table if not exists public.phone_otps (
  phone text primary key check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  last_sent_at timestamptz not null default now(),
  sends_in_window int not null default 1,
  window_started_at timestamptz not null default now()
);
create table if not exists public.phone_otp_ip_limits (
  ip text primary key,
  sends int not null default 0,
  window_started_at timestamptz not null default now()
);
alter table public.phone_otps enable row level security;
alter table public.phone_otp_ip_limits enable row level security;
revoke all on public.phone_otps, public.phone_otp_ip_limits from anon, authenticated;

-- Returns 'ok' (store the new code, then send it), 'cooldown' or 'limited'.
create or replace function public.issue_phone_otp(p_phone text, p_ip text, p_code_hash text) returns text
language plpgsql security definer set search_path=public as $$
declare r public.phone_otps; ip_sends int;
begin
  delete from phone_otp_ip_limits where window_started_at < now() - interval '1 day';
  delete from phone_otps where last_sent_at < now() - interval '1 day';
  select * into r from phone_otps where phone = p_phone for update;
  if found then
    if r.last_sent_at > now() - interval '30 seconds' then return 'cooldown'; end if;
    if r.window_started_at > now() - interval '1 hour' and r.sends_in_window >= 5 then return 'limited'; end if;
  end if;
  insert into phone_otp_ip_limits(ip, sends) values (coalesce(nullif(trim(p_ip), ''), 'unknown'), 1)
  on conflict (ip) do update set
    sends = case when phone_otp_ip_limits.window_started_at <= now() - interval '1 hour' then 1 else phone_otp_ip_limits.sends + 1 end,
    window_started_at = case when phone_otp_ip_limits.window_started_at <= now() - interval '1 hour' then now() else phone_otp_ip_limits.window_started_at end
  returning sends into ip_sends;
  if ip_sends > 10 then return 'limited'; end if;
  insert into phone_otps(phone, code_hash, expires_at) values (p_phone, p_code_hash, now() + interval '10 minutes')
  on conflict (phone) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, last_sent_at = now(),
    sends_in_window = case when phone_otps.window_started_at <= now() - interval '1 hour' then 1 else phone_otps.sends_in_window + 1 end,
    window_started_at = case when phone_otps.window_started_at <= now() - interval '1 hour' then now() else phone_otps.window_started_at end;
  return 'ok';
end; $$;

-- Every check uses one of the code's 5 guesses, including signup retries with a correct code.
create or replace function public.check_phone_otp(p_phone text, p_code_hash text) returns boolean
language plpgsql security definer set search_path=public as $$
declare stored text;
begin
  update phone_otps set attempts = attempts + 1
  where phone = p_phone and expires_at > now() and attempts < 5
  returning code_hash into stored;
  return found and stored = p_code_hash;
end; $$;

create or replace function public.consume_phone_otp(p_phone text) returns void
language sql security definer set search_path=public as $$
  delete from public.phone_otps where phone = p_phone;
$$;

revoke all on function public.issue_phone_otp(text, text, text), public.check_phone_otp(text, text), public.consume_phone_otp(text) from public, anon, authenticated;
grant execute on function public.issue_phone_otp(text, text, text), public.check_phone_otp(text, text), public.consume_phone_otp(text) to service_role;
commit;
