-- Trainer cards on our-story.html ("Our Trainers"): staff are added, edited and
-- ordered from admin.html (Our Staff tab). Photos go in the public 'site-media' bucket (staff/ folder); the list is
-- published in site_content key 'kompetenzen_staff'.
begin;
alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content add constraint site_content_key_check
  check (key in ('kompetenzen_batch_dates', 'kompetenzen_placed_students', 'kompetenzen_showcase', 'kompetenzen_alumni', 'kompetenzen_staff'));
commit;
