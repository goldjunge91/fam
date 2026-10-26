SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.bring_image_url_is_valid (
  p_url text
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'pg_catalog'
  AS $function$
  select case
    when p_url is null then false
    when p_url ~ '[[:space:][:cntrl:]]' then false
    when p_url ~ '%([^0-9A-Fa-f]|$)|%[0-9A-Fa-f]([^0-9A-Fa-f]|$)' then false
    when p_url ~* '%0[0-9a-f]|%1[0-9a-f]|%7f' then false
    when position(chr(92) in p_url) > 0 then false
    when split_part(p_url, '?', 1) ~* '%(2f|5c|25)' then false
    when split_part(p_url, '?', 1) ~* '(^|/)(\.|%2e){1,2}(/|$)' then false
    else p_url ~ '^https://((([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+bringapi\.app/content/)|view\.publitas\.com/resize/)[^/?#[:space:]]+(/[^/?#[:space:]]+)*(\?[^#[:space:]]*)?$'
  end;
$function$;
