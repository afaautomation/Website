-- Security: applying already requires sign-in, so only signed-in users may drop an application resume.
-- Before this, anyone on the internet (no account) could upload files (PDF/DOC, up to 5 MB each,
-- unlimited count) into the resumes bucket. The bucket stays private, size and type limited.
drop policy if exists "Anyone can drop an application resume" on storage.objects;
drop policy if exists "Signed-in users drop an application resume" on storage.objects;
create policy "Signed-in users drop an application resume" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'applications'
  );
