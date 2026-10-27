SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.broadcast_brochure_zip_scan_finished()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_result text;
begin
  if tg_op = 'INSERT' then
    if new.last_error is not null then
      v_result := 'failed';
    elsif new.last_successful_at is not null then
      v_result := 'succeeded';
    end if;
  elsif new.last_error is not null and old.last_error is null then
    v_result := 'failed';
  elsif new.last_successful_at is not null
    and new.last_successful_at is distinct from old.last_successful_at then
    v_result := 'succeeded';
  end if;

  if v_result is null then
    return new;
  end if;

  perform realtime.send(
    payload => jsonb_build_object(
      'zip_code', new.zip_code,
      'result', v_result,
      'last_successful_at', new.last_successful_at
    ),
    event => 'scan-finished',
    topic => 'brochure-scan:' || new.zip_code,
    private => true
  );

  return new;
exception when others then
  raise warning 'Brochure scan completion broadcast failed for postal code %.', new.zip_code;
  return new;
end;
$function$;

CREATE TRIGGER broadcast_brochure_zip_scan_insert
  AFTER INSERT ON public.brochure_zip_scans
  FOR EACH ROW
  EXECUTE FUNCTION private.broadcast_brochure_zip_scan_finished();

CREATE TRIGGER broadcast_brochure_zip_scan_update
  AFTER UPDATE OF last_successful_at, last_error ON public.brochure_zip_scans
  FOR EACH ROW
  EXECUTE FUNCTION private.broadcast_brochure_zip_scan_finished();

CREATE POLICY "brochure_scan_broadcast_receive" ON "realtime"."messages"
  FOR SELECT
  TO "authenticated"
  USING (((EXTENSION = 'broadcast'::text) AND (( SELECT realtime.topic() AS topic) ~ '^brochure-scan:[0-9]{5}$'::text)));

REVOKE ALL ON FUNCTION "private"."broadcast_brochure_zip_scan_finished"() FROM PUBLIC;
