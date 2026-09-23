DROP POLICY "avatars_select" ON "storage"."objects";

CREATE POLICY "avatars_select" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'avatars'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM public.household_members member
  WHERE (((member.user_id)::text = (storage.foldername(objects.name))[1]) AND private.is_household_member(member.household_id)))))));
