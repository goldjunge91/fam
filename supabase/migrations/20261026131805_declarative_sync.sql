SET local check_function_bodies = off;

CREATE EXTENSION IF NOT EXISTS "pg_net" SCHEMA "extensions";

CREATE OR REPLACE FUNCTION private.dispatch_brochure_zip_scan()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_function_url text;
  v_webhook_secret text;
begin
  if new.last_error is not null then
    return new;
  end if;

  if new.last_successful_at is not null and new.requested_at <= new.last_successful_at then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.requested_at is not distinct from old.requested_at then
    return new;
  end if;

  select decrypted_secret
  into v_function_url
  from vault.decrypted_secrets
  where name = 'brochure_dispatch_function_url'
  limit 1;

  select decrypted_secret
  into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'brochure_dispatch_webhook_secret'
  limit 1;

  if coalesce(v_function_url, '') = '' or coalesce(v_webhook_secret, '') = '' then
    raise warning 'Brochure dispatch is not configured; the scheduled queue fallback remains active.';
    return new;
  end if;

  perform net.http_post(
    url := v_function_url,
    body := jsonb_build_object(
      'type', tg_op,
      'schema', 'public',
      'table', 'brochure_zip_scans',
      'record', jsonb_build_object(
        'zip_code', new.zip_code,
        'requested_at', new.requested_at,
        'last_successful_at', new.last_successful_at,
        'last_error', new.last_error
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-brochure-dispatch-secret', v_webhook_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$function$;

CREATE TRIGGER dispatch_pending_brochure_zip_scan
  AFTER INSERT OR UPDATE ON public.brochure_zip_scans
  FOR EACH ROW
  EXECUTE FUNCTION private.dispatch_brochure_zip_scan();

COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';

COMMENT ON FUNCTION "private"."dispatch_brochure_zip_scan"() IS 'Sendet neu angefragte PLZ asynchron an den serverseitigen Runner-Dispatch.';

REVOKE ALL ON FUNCTION "private"."dispatch_brochure_zip_scan"() FROM PUBLIC;
