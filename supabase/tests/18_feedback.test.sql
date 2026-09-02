-- feedback_tickets + feedback_messages (#347).

begin;
\ir helpers.sql

select plan(11);

select tests.create_user('11111111-1111-1111-1111-111111111111', 'alice-feedback@example.com');
select tests.create_user('22222222-2222-2222-2222-222222222222', 'bob-feedback@example.com');

-- ------------------------------------------------------------- Ticket anlegen
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

insert into public.feedback_tickets (user_id, type, subject)
values ('11111111-1111-1111-1111-111111111111', 'bug', 'App stuerzt beim Scannen ab')
returning id as tid \gset

select is(
  (select count(*)::int from public.feedback_tickets),
  1,
  'Alice kann ein eigenes Ticket anlegen'
);

select is(
  (select status from public.feedback_tickets where id = :'tid'),
  'open',
  'ein neues Ticket startet mit Status open'
);

insert into public.feedback_messages (ticket_id, author_type, author_id, body)
values (:'tid', 'user', '11111111-1111-1111-1111-111111111111', 'App stuerzt beim Scannen eines Barcodes ab.');

select is(
  (select count(*)::int from public.feedback_messages where ticket_id = :'tid'),
  1,
  'Alice kann die initiale Nachricht als Thread-Zeile anlegen'
);

-- ------------------------------------------------------- fremdes Ticket unsichtbar
select tests.authenticate_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.feedback_tickets),
  0,
  'Bob sieht Alices Ticket nicht'
);

select is(
  (select count(*)::int from public.feedback_messages where ticket_id = :'tid'),
  0,
  'Bob sieht Alices Nachrichten nicht'
);

select throws_ok(
  format(
    $$ insert into public.feedback_messages (ticket_id, author_type, author_id, body)
       values (%L::uuid, 'user', '22222222-2222-2222-2222-222222222222', 'fremder Versuch') $$,
    :'tid'
  ),
  'new row violates row-level security policy for table "feedback_messages"',
  'Bob kann keine Nachricht an Alices Ticket anhaengen'
);

-- --------------------------------------------------------- Client darf nicht schliessen
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*)::int from public.feedback_tickets where id = :'tid' and status <> 'open'),
  0,
  'der Status ist unveraendert, solange niemand ihn per service_role setzt'
);

select throws_ok(
  format($$ update public.feedback_tickets set status = 'closed' where id = %L::uuid $$, :'tid'),
  'permission denied for table feedback_tickets',
  'ein Nutzer kann den Status seines eigenen Tickets nicht selbst aendern'
);

-- ------------------------------------------------------- service_role antwortet
select tests.as_postgres();

update public.feedback_tickets set status = 'in_progress' where id = :'tid';
insert into public.feedback_messages (ticket_id, author_type, author_id, body)
values (:'tid', 'staff', null, 'Danke fuer die Meldung, wir schauen uns das an.');

select is(
  (select status from public.feedback_tickets where id = :'tid'),
  'in_progress',
  'service_role kann den Status setzen'
);

select is(
  (select count(*)::int from public.feedback_messages where ticket_id = :'tid' and author_type = 'staff'),
  1,
  'service_role kann eine staff-Antwort anhaengen'
);

-- --------------------------------------------------- geschlossenes Ticket sperrt Antworten
update public.feedback_tickets set status = 'closed' where id = :'tid';

select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  format(
    $$ insert into public.feedback_messages (ticket_id, author_type, author_id, body)
       values (%L::uuid, 'user', '11111111-1111-1111-1111-111111111111', 'nochmal was') $$,
    :'tid'
  ),
  'new row violates row-level security policy for table "feedback_messages"',
  'ein Nutzer kann auf ein geschlossenes Ticket nicht mehr antworten'
);

select tests.as_postgres();
select * from finish();
rollback;
