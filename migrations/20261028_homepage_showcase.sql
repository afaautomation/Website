-- Homepage showcase box: staff upload a full-size banner (new products, events) from marketing.html.
-- Images live in a public bucket; the chosen image is published in site_content key 'kompetenzen_showcase'.
begin;
alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check
  check (key in ('kompetenzen_batch_dates', 'kompetenzen_placed_students', 'kompetenzen_showcase'));

insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do update set public = true;
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'site-media';

-- Public URLs serve the files without a select policy; only staff can list, add or remove them.
drop policy if exists "Staff read site media" on storage.objects;
create policy "Staff read site media" on storage.objects
  for select to authenticated using (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "Staff upload site media" on storage.objects;
create policy "Staff upload site media" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "Staff delete site media" on storage.objects;
create policy "Staff delete site media" on storage.objects
  for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());
commit;
