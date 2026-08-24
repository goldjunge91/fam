begin;
set local role postgres;
set local search_path = extensions, public;

select extensions.plan(51);

select extensions.has_table('public', 'evaluation_reviewers', 'evaluation_reviewers existiert');
select extensions.has_table('public', 'evaluation_labels', 'evaluation_labels existiert');
select extensions.has_table('public', 'evaluation_silver_labels', 'evaluation_silver_labels existiert');
select extensions.has_table('public', 'evaluation_runs', 'evaluation_runs existiert');
select extensions.has_table('public', 'evaluation_run_predictions', 'evaluation_run_predictions existiert');
select extensions.has_table('public', 'evaluation_crowd_signals', 'evaluation_crowd_signals existiert');
select extensions.has_table('public', 'evaluation_import_runs', 'evaluation_import_runs existiert');
select extensions.has_table('public', 'evaluation_crowd_signal_reviews', 'evaluation_crowd_signal_reviews existiert');
select extensions.ok(
  to_regprocedure('private.set_evaluation_label_updated_at()') is not null,
  'updated_at-Triggerfunktion existiert im privaten Schema'
);
select extensions.ok(
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'public.evaluation_labels'::regclass
      and tgname = 'set_evaluation_label_updated_at'
      and not tgisinternal
  ),
  'evaluation_labels pflegt updated_at per Trigger'
);
select extensions.ok(
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'public.evaluation_silver_labels'::regclass
      and tgname = 'set_evaluation_silver_label_updated_at'
      and not tgisinternal
  ),
  'evaluation_silver_labels pflegt updated_at per Trigger'
);
select extensions.ok(
  not (select prosecdef from pg_proc where oid = 'private.set_evaluation_label_updated_at()'::regprocedure),
  'updated_at-Triggerfunktion ist SECURITY INVOKER'
);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_reviewers'::regclass),
  'evaluation_reviewers hat RLS'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_labels'::regclass),
  'evaluation_labels hat RLS'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_silver_labels'::regclass),
  'evaluation_silver_labels hat RLS'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_runs'::regclass),
  'evaluation_runs hat RLS'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_run_predictions'::regclass),
  'evaluation_run_predictions hat RLS'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_crowd_signals'::regclass),
  'evaluation_crowd_signals hat RLS'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_import_runs'::regclass),
  'evaluation_import_runs hat RLS'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_crowd_signal_reviews'::regclass),
  'evaluation_crowd_signal_reviews hat RLS'
);

select extensions.ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'evaluation_reviewers' and policyname = 'evaluation_server_only'),
  'evaluation_reviewers hat eine explizite Server-only-Policy'
);
select extensions.ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'evaluation_labels' and policyname = 'evaluation_server_only'),
  'evaluation_labels hat eine explizite Server-only-Policy'
);
select extensions.ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'evaluation_silver_labels' and policyname = 'evaluation_server_only'),
  'evaluation_silver_labels hat eine explizite Server-only-Policy'
);
select extensions.ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'evaluation_runs' and policyname = 'evaluation_server_only'),
  'evaluation_runs hat eine explizite Server-only-Policy'
);
select extensions.ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'evaluation_run_predictions' and policyname = 'evaluation_server_only'),
  'evaluation_run_predictions hat eine explizite Server-only-Policy'
);
select extensions.ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'evaluation_crowd_signals' and policyname = 'evaluation_server_only'),
  'evaluation_crowd_signals hat eine explizite Server-only-Policy'
);
select extensions.ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'evaluation_import_runs' and policyname = 'evaluation_server_only'),
  'evaluation_import_runs hat eine explizite Server-only-Policy'
);
select extensions.ok(
  exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'evaluation_crowd_signal_reviews' and policyname = 'evaluation_server_only'),
  'evaluation_crowd_signal_reviews hat eine explizite Server-only-Policy'
);

select extensions.ok(
  (select qual = 'false' and with_check = 'false' from pg_policies where schemaname = 'public' and tablename = 'evaluation_reviewers' and policyname = 'evaluation_server_only'),
  'evaluation_reviewers verweigert Lesen und Schreiben'
);
select extensions.ok(
  (select qual = 'false' and with_check = 'false' from pg_policies where schemaname = 'public' and tablename = 'evaluation_labels' and policyname = 'evaluation_server_only'),
  'evaluation_labels verweigert Lesen und Schreiben'
);
select extensions.ok(
  (select qual = 'false' and with_check = 'false' from pg_policies where schemaname = 'public' and tablename = 'evaluation_silver_labels' and policyname = 'evaluation_server_only'),
  'evaluation_silver_labels verweigert Lesen und Schreiben'
);
select extensions.ok(
  (select qual = 'false' and with_check = 'false' from pg_policies where schemaname = 'public' and tablename = 'evaluation_runs' and policyname = 'evaluation_server_only'),
  'evaluation_runs verweigert Lesen und Schreiben'
);
select extensions.ok(
  (select qual = 'false' and with_check = 'false' from pg_policies where schemaname = 'public' and tablename = 'evaluation_run_predictions' and policyname = 'evaluation_server_only'),
  'evaluation_run_predictions verweigert Lesen und Schreiben'
);
select extensions.ok(
  (select qual = 'false' and with_check = 'false' from pg_policies where schemaname = 'public' and tablename = 'evaluation_crowd_signals' and policyname = 'evaluation_server_only'),
  'evaluation_crowd_signals verweigert direkten Clientzugriff'
);
select extensions.ok(
  (select qual = 'false' and with_check = 'false' from pg_policies where schemaname = 'public' and tablename = 'evaluation_import_runs' and policyname = 'evaluation_server_only'),
  'evaluation_import_runs verweigert direkten Clientzugriff'
);
select extensions.ok(
  (select qual = 'false' and with_check = 'false' from pg_policies where schemaname = 'public' and tablename = 'evaluation_crowd_signal_reviews' and policyname = 'evaluation_server_only'),
  'evaluation_crowd_signal_reviews verweigert direkten Clientzugriff'
);

select extensions.ok(
  has_table_privilege('service_role', 'public.evaluation_reviewers', 'select,insert,update,delete'),
  'service_role verwaltet Reviewer'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.evaluation_labels', 'select,insert,update,delete'),
  'service_role verwaltet Labels'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.evaluation_silver_labels', 'select,insert,update,delete'),
  'service_role verwaltet Silver-Labels'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.evaluation_runs', 'select,insert,update,delete'),
  'service_role verwaltet Runs'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.evaluation_run_predictions', 'select,insert,update,delete'),
  'service_role verwaltet Run-Vorhersagen'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.evaluation_crowd_signals', 'select,insert'),
  'service_role darf Rohsignale lesen und anfügen'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.evaluation_import_runs', 'select,insert,update'),
  'service_role darf Importläufe lesen, starten und fortschreiben'
);
select extensions.ok(
  not has_table_privilege('service_role', 'public.evaluation_import_runs', 'delete'),
  'Import-Auditläufe sind für service_role nicht löschbar'
);
select extensions.ok(
  not (
    has_table_privilege('anon', 'public.evaluation_import_runs', 'select')
    or has_table_privilege('anon', 'public.evaluation_import_runs', 'insert')
    or has_table_privilege('anon', 'public.evaluation_import_runs', 'update')
    or has_table_privilege('anon', 'public.evaluation_import_runs', 'delete')
    or has_table_privilege('anon', 'public.evaluation_import_runs', 'truncate')
    or has_table_privilege('anon', 'public.evaluation_import_runs', 'references')
    or has_table_privilege('anon', 'public.evaluation_import_runs', 'trigger')
    or has_table_privilege('anon', 'public.evaluation_import_runs', 'maintain')
  ),
  'anon hat keine Rechte auf Import-Auditläufe'
);
select extensions.ok(
  not (
    has_table_privilege('authenticated', 'public.evaluation_import_runs', 'select')
    or has_table_privilege('authenticated', 'public.evaluation_import_runs', 'insert')
    or has_table_privilege('authenticated', 'public.evaluation_import_runs', 'update')
    or has_table_privilege('authenticated', 'public.evaluation_import_runs', 'delete')
    or has_table_privilege('authenticated', 'public.evaluation_import_runs', 'truncate')
    or has_table_privilege('authenticated', 'public.evaluation_import_runs', 'references')
    or has_table_privilege('authenticated', 'public.evaluation_import_runs', 'trigger')
    or has_table_privilege('authenticated', 'public.evaluation_import_runs', 'maintain')
  ),
  'authenticated hat keine Rechte auf Import-Auditläufe'
);
select extensions.ok(
  has_table_privilege('service_role', 'public.evaluation_crowd_signal_reviews', 'select,insert'),
  'service_role darf Reviews lesen und anfügen'
);
select extensions.ok(
  not has_table_privilege('service_role', 'public.evaluation_crowd_signals', 'update'),
  'Rohsignale sind für service_role nicht änderbar'
);
select extensions.ok(
  not has_table_privilege('service_role', 'public.evaluation_crowd_signals', 'delete'),
  'Rohsignale sind für service_role nicht löschbar'
);
select extensions.ok(
  not has_table_privilege('service_role', 'public.evaluation_crowd_signal_reviews', 'update'),
  'Review-Historie ist für service_role nicht änderbar'
);
select extensions.ok(
  not has_table_privilege('service_role', 'public.evaluation_crowd_signal_reviews', 'delete'),
  'Review-Historie ist für service_role nicht löschbar'
);

select * from extensions.finish();
rollback;
