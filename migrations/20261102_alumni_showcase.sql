-- Alumni showcase on placements.html: staff add alumni (photo, name, job title, experience) from marketing.html.
-- Photos go in the public 'site-media' bucket (alumni/ folder); the list is published in site_content key 'kompetenzen_alumni'.
begin;
alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check
  check (key in ('kompetenzen_batch_dates', 'kompetenzen_placed_students', 'kompetenzen_showcase', 'kompetenzen_alumni'));
commit;
