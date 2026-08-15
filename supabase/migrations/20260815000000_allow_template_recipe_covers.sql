-- Ausnahme vom deklarativen Migrationsfluss: Policies auf dem von Supabase
-- verwalteten `storage.objects` werden von pg-delta nicht erfasst. Die
-- deklarative Quelle bleibt supabase/schemas/12_recipe_storage.sql.

drop policy recipe_covers_select on storage.objects;

create policy recipe_covers_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recipe-covers'
    and case
      when (storage.foldername(name))[1] = 'templates' then true
      else (select private.is_household_member(((storage.foldername(name))[1])::uuid))
    end
  );
