-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE SCHEMA private AUTHORIZATION postgres;

CREATE FUNCTION private.set_evaluation_label_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION private.set_evaluation_label_updated_at() FROM PUBLIC;

GRANT ALL ON FUNCTION private.set_evaluation_label_updated_at() TO service_role;

CREATE TRIGGER set_evaluation_label_updated_at
  BEFORE INSERT OR UPDATE ON public.evaluation_labels
  FOR EACH ROW
  EXECUTE FUNCTION private.set_evaluation_label_updated_at();