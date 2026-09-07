begin;

\ir helpers.sql

select no_plan();

select has_table(
  'public',
  'off_enrichment_cache',
  'der persistente OFF-Cache ist vorhanden'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.off_enrichment_cache'::regclass),
  'der OFF-Cache hat RLS'
);
select ok(
  not has_table_privilege('anon', 'public.off_enrichment_cache', 'select'),
  'anonyme Nutzer koennen den OFF-Cache nicht lesen'
);
select ok(
  not has_table_privilege('authenticated', 'public.off_enrichment_cache', 'select'),
  'angemeldete Nutzer koennen den OFF-Cache nicht lesen'
);
select ok(
  has_table_privilege('service_role', 'public.off_enrichment_cache', 'select,insert,update,delete'),
  'service_role hat den vollstaendigen OFF-Cache-Zugriff'
);

select ok(
  not has_function_privilege(
    'anon', 'public.claim_off_enrichment_cache(text,integer)', 'execute'
  ),
  'anon kann keinen OFF-Cache claimen'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.claim_off_enrichment_cache(text,integer)', 'execute'
  ),
  'authenticated kann keinen OFF-Cache claimen'
);
select ok(
  has_function_privilege(
    'service_role', 'public.claim_off_enrichment_cache(text,integer)', 'execute'
  ),
  'service_role kann den OFF-Cache claimen'
);
select ok(
  has_function_privilege(
    'service_role', 'public.store_off_enrichment_cache(text,uuid,text,text[],timestamptz,integer)', 'execute'
  ),
  'service_role kann OFF-Ergebnisse speichern'
);
select ok(
  has_function_privilege(
    'service_role', 'public.release_off_enrichment_cache(text,uuid)', 'execute'
  ),
  'service_role kann OFF-Leases freigeben'
);

select tests.as_postgres();
set local role service_role;

select *
from public.claim_off_enrichment_cache('4008400401027', 30)
\gset first_
select is(:'first_state'::text, 'claimed'::text, 'eine unbekannte EAN bekommt einen Lease');
select ok(:'first_lease_token' is not null, 'der erste Lease hat ein Token');

select *
from public.claim_off_enrichment_cache('4008400401027', 30)
\gset concurrent_
select is(:'concurrent_state'::text, 'in_flight'::text, 'ein aktiver Lease blockiert parallele OFF-Abfragen');
select ok(:concurrent_retry_after::integer >= 1, 'ein aktiver Lease liefert eine Retry-Zeit');

select is(
  public.store_off_enrichment_cache(
    '4008400401027',
    :'first_lease_token'::uuid,
    'success',
    array['en:porks', 'en:meats']::text[],
    '2026-08-01T00:00:00Z'::timestamptz,
    3600
  ),
  true,
  'ein erfolgreicher OFF-Lookup wird unter dem Lease gespeichert'
);

select *
from public.claim_off_enrichment_cache('4008400401027', 30)
\gset hit_
select is(:'hit_state'::text, 'hit'::text, 'ein frischer Treffer kommt aus dem persistenten Cache');
select is(:'hit_lookup_status'::text, 'success'::text, 'der positive Cache-Status bleibt erhalten');
select is(:'hit_category_tags'::text, '{en:porks,en:meats}'::text, 'die OFF-Tags bleiben erhalten');

select is(
  public.store_off_enrichment_cache(
    '4008400401027',
    :'first_lease_token'::uuid,
    'success',
    array['en:stale']::text[],
    '2026-08-03T00:00:00Z'::timestamptz,
    3600
  ),
  false,
  'ein alter Lease kann einen frischen Cache-Treffer nicht ueberschreiben'
);

update public.off_enrichment_cache
set expires_at = clock_timestamp() - interval '1 second'
where ean = '4008400401027';

select *
from public.claim_off_enrichment_cache('4008400401027', 30)
\gset expired_
select is(:'expired_state'::text, 'claimed'::text, 'ein abgelaufener Treffer wird neu geladen');
select is(
  public.store_off_enrichment_cache(
    '4008400401027',
    :'first_lease_token'::uuid,
    'success',
    array['en:stale']::text[],
    '2026-08-03T00:00:00Z'::timestamptz,
    3600
  ),
  false,
  'ein abgelaufener alter Lease kann den neu vergebenen Lease nicht ueberschreiben'
);
select is(
  public.release_off_enrichment_cache('4008400401027', :'expired_lease_token'::uuid),
  true,
  'ein transient fehlgeschlagener Lookup kann seinen Lease freigeben'
);
select is(
  (select count(*)::integer from public.off_enrichment_cache where ean = '4008400401027'),
  0,
  'Release verwirft den unfertigen Cache-Eintrag vollständig'
);

select *
from public.claim_off_enrichment_cache('4012345678901', 30)
\gset negative_
select is(:'negative_state'::text, 'claimed'::text, 'eine unbekannte EAN kann negativ geladen werden');
select is(
  public.store_off_enrichment_cache(
    '4012345678901',
    :'negative_lease_token'::uuid,
    'not_found',
    array['en:should-be-cleared']::text[],
    null,
    3600
  ),
  true,
  'ein echter OFF-Nichtfund wird gespeichert'
);
select *
from public.claim_off_enrichment_cache('4012345678901', 30)
\gset negative_hit_
select is(:'negative_hit_state'::text, 'hit'::text, 'ein negativer OFF-Lookup wird gecacht');
select is(:'negative_hit_lookup_status'::text, 'not_found'::text, 'der Nichtfund-Status bleibt erhalten');
select is(:'negative_hit_category_tags'::text, '{}'::text, 'Nichtfunde speichern keine Tags');

select throws_ok(
  $$select public.claim_off_enrichment_cache('12345', 30)$$,
  '22023',
  'off_cache_invalid_ean',
  'ungueltige EANs werden vor dem Claim abgewiesen'
);
select throws_ok(
  $$select public.claim_off_enrichment_cache('4012345678901', 10)$$,
  '22023',
  'off_cache_invalid_lease',
  'ein Lease kuerzer als der Upstream-Timeout wird abgewiesen'
);
select throws_ok(
  $$select public.store_off_enrichment_cache(
      '4012345678901', gen_random_uuid(), 'not_found', '{}', null, 10
    )$$,
  '22023',
  'off_cache_invalid_ttl',
  'zu kurze Cache-TTLs werden abgewiesen'
);

reset role;
select * from finish();
rollback;
