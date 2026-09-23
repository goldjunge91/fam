-- Private Profilbilder: Besitzer und Mitglieder desselben Haushalts dürfen lesen.
-- Bucket `avatars` muss zusätzlich privat konfiguriert sein.
-- Quelle der Policies; Migration ausschließlich durch den Schema-Generator.
-- Anzeige über kurzlebige signierte URLs, nie über öffentliche Objekt-URLs.

create policy avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.household_members member
        where member.user_id::text = (storage.foldername(name))[1]
          and private.is_household_member(member.household_id)
      )
    )
  );

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (select auth.uid()) = ((storage.foldername(name))[1])::uuid
  );

create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid()) = ((storage.foldername(name))[1])::uuid
  )
  with check (
    bucket_id = 'avatars'
    and (select auth.uid()) = ((storage.foldername(name))[1])::uuid
  );

create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid()) = ((storage.foldername(name))[1])::uuid
  );
