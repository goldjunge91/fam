# Registered User Onboarding Fix Bugfix Design

## Overview

Der Defekt liegt an der Grenze zwischen Authentifizierung und App-Einstieg. Der aktuelle Code behandelt `profiles.onboarding_completed_at = null` als offenes Onboarding, obwohl die Spalte bei ihrer Einführung nicht für bestehende Profile zurückgefüllt wurde. Ein Nullwert beschreibt deshalb sowohl echte neue Accounts mit offener Ersteinrichtung als auch ältere Accounts ohne historischen Abschlusswert. Zusätzlich lässt der Root-Navigator die Onboarding-Route für jede authentifizierte Sitzung zu, und der eingebettete Account-Schritt ruft nach Anmeldung oder Anbieter-Authentifizierung direkt `onNext` auf. Ein Login kann dadurch die zentrale Profil-, Haushalts- und Offline-Startentscheidung umgehen.

Die minimale Korrektur ergänzt auf `profiles` einen positiven, unveränderlichen Registrierungsnachweis. `onboarding_required_at` ist eine gespeicherte, serverseitig berechnete Spalte: Für Profile ab dem belegten Produktiv-Rollout des persönlichen Onboardings entspricht sie dem unveränderlichen `profiles.created_at`, für ältere Profile ist sie `null`. Das persönliche Onboarding ist nur offen, wenn dieser Nachweis vorhanden, `onboarding_completed_at` weiterhin `null` und kein Sitzungsabschluss für dieselbe Account-ID gesetzt ist. Ein fehlender Abschlusswert, ein neues Gerät, ein fehlender geräteweiter Hinweis, ein Auth-Ereignis oder die sichtbare Sign-up-Oberfläche reichen allein nicht aus.

Die Berechnung erhält bereits begonnene offene Neuregistrierungen ohne einmaliges Daten-`UPDATE`: Profile aus der Zeit des nachweislich aktiven Onboarding-Vertrags erhalten den berechneten Nachweis auch rückwirkend, ältere Profile mit Null-Abschluss nicht. Der genaue Wert `ONBOARDING_FLOW_ROLLOUT_AT` ist der spätere belegte Zeitpunkt aus produktiver Schemaausrollung und verfügbarer Clientversion mit dem Abschlussvertrag. Er muss vor `db:diff` aus Deployment- und Release-Evidenz bestimmt werden. Dateiname oder Commitzeit allein werden nicht als Produktivnachweis geraten. Ist dieser Nachweis nicht verfügbar, bleibt die Schemaänderung bis zu einer expliziten Owner-Entscheidung blockiert.

Die bestehende App-Entry-Pipeline bleibt verantwortlich für Session- und Account-Bootstrap, Profil, lokalen Haushaltsspiegel, initialen Pull, Offline-Fallback und Fehlerzustände. Der Root-Navigator verwendet ihre Entscheidung zusätzlich als Schutz der Onboarding-Route. Alle erfolgreichen Auth-Pfade wechseln zunächst in diese Pipeline. Erst eine aufgelöste Entscheidung darf persönliche Schritte oder den regulären App-Einstieg freigeben.

Der geräteweite Hinweis bleibt nur für den anonymen Einstieg zuständig. Der In-Memory-Abschluss wird an die aktuelle Account-ID gebunden, und der flüchtige Zustand des Onboarding-Formulars wird beim bestehenden Account-Cleanup zurückgesetzt. Die Korrektur braucht keine neue Abhängigkeit, kein natives Modul und keine Änderung des lokalen SQLite-Schemas oder der Outbox. Das Profil ist bereits serverseitiger Accountzustand und wird über den verschlüsselten, accountbezogenen React-Query-Cache offline wiederverwendet.

Technischer Abgleich erfolgte mit der [Expo-SDK-57-Router-Referenz](https://docs.expo.dev/versions/v57.0.0/sdk/router/), der [Supabase-Referenz für `signUp`](https://supabase.com/docs/reference/javascript/auth-signup), der [Supabase-Referenz für `signInWithOAuth`](https://supabase.com/docs/reference/javascript/auth-signinwithoauth) und der [Supabase-Referenz für Auth-Ereignisse](https://supabase.com/docs/reference/javascript/auth-onauthstatechange). Content was rephrased for compliance with licensing restrictions.

## Glossary

- **Bug_Condition (C)**: Der beobachtbare Onboarding-Zugang eines authentifizierten Accounts weicht vom positiven offenen Registrierungsnachweis dieses Accounts ab. Dies umfasst das falsche Anzeigen für bestehende Accounts und eine accountübergreifende Unterdrückung für einen neuen offenen Account.
- **Property (P)**: Nach der vollständigen Startbereitschaft stimmt die Onboarding-Freigabe genau mit dem serverseitigen Nachweis, dem Abschlusszeitpunkt und der aktuellen Account-ID überein.
- **Preservation**: Für alle Zustände ohne diese Abweichung bleiben neue offene Registrierungen, anonyme Einstiege, Fehler, Offline-Fallbacks, Haushaltsregeln und Datenzugriffe unverändert.
- **F**: Das aktuelle Verhalten aus `AccountStepForm`, `AppEntryReadinessProvider`, `resolveAppEntry` und `RootNavigator`.
- **F'**: Das korrigierte Verhalten, das Registrierungsnachweis, Abschlusszeitpunkt, Bereitschaft und aktuelle Account-ID gemeinsam auswertet.
- **Existing_Account**: Ein Account, der bereits vor dem betrachteten Authentifizierungsversuch bestand und für den kein positiver, offener Registrierungsnachweis vorliegt.
- **Proven_New_Registration**: Ein Profil mit nicht-nullbarem, serverseitig berechnetem `onboarding_required_at`. Der Wert folgt aus dem unveränderlichen Erstellungszeitpunkt und dem belegten Produktiv-Rollout des Onboarding-Vertrags.
- **Open_Registration_Onboarding (O)**: `onboarding_required_at != null`, `onboarding_completed_at = null` und der Sitzungsabschluss gehört nicht zur aktuellen Account-ID.
- **`onboarding_required_at`**: Neue gespeicherte Generated Column auf `public.profiles`. Für ein ab dem Rollout angelegtes Profil entspricht sie `created_at`, für ältere Profile ist sie `null`; Clients können sie nicht direkt schreiben.
- **`onboarding_completed_at`**: Bestehender serverseitiger Abschlusszeitpunkt. Ein Wert ungleich `null` schließt das Onboarding unabhängig vom Registrierungsnachweis.
- **`ONBOARDING_FLOW_ROLLOUT_AT`**: Belegter späterer Zeitpunkt aus produktiver Schemaausrollung und verfügbarer Clientversion mit dem persönlichen Onboarding-Abschlussvertrag. Er steht als feste Grenze im Ausdruck der Generated Column.
- **`hasSeenOnboarding`**: Geräteweiter Hinweis aus SecureStore beziehungsweise der Web-Plattformvariante. Er steuert nur, ob ein anonymer Start Willkommen oder Anmeldung zeigt.
- **Session_Completion_User**: Die Account-ID, für die das Onboarding in der aktuellen App-Sitzung erfolgreich abgeschlossen wurde. Sie ersetzt den derzeit globalen Boolean `completedInCurrentSession`.
- **`accountReady`**: Signal des `SessionProvider`, dass Accountzuordnung, Cleanup eines vorherigen Accounts, verschlüsselter Speicher und Query-Persistenz vollständig vorbereitet sind.
- **App_Entry_Decision**: Ergebnis von `resolveAppEntry`: `warten`, `fehler`, `weiter` oder `umleiten` nach `/onboarding`, `/sign-in` beziehungsweise `/household/create`.
- **Missing_Profile**: Eine vorhandene, bereite Session ohne geladenen Profildatensatz. Dieser Zustand ist kein bestehender Account-Fallback, sondern ein sicherer Profilfehler.
- **Account_Cleanup**: Bestehender Ablauf in `clearLocalAccountData`, der Sync stoppt, Query-Cache, SQLite und verschlüsselten Speicher löscht und Modulcaches zurücksetzt, bevor ein anderer Account freigegeben wird.

## Bug Details

### Bug Condition

Sei `X` die Menge aller Authentifizierungs- und Start-Traces. Für einen Trace `x` gelten:

`O(x) := x.profile.onboarding_required_at != null AND x.profile.onboarding_completed_at = null AND x.sessionCompletionUserId != x.sessionUserId`

`Expected(x)` ist die bestehende Startpriorität mit der präzisierten Onboarding-Regel:

1. Ohne Sitzung entscheidet nur der geräteweite Hinweis zwischen Willkommen und Anmeldung.
2. Mit Sitzung und unvollständiger Bereitschaft gilt `warten`.
3. Profilfehler, Missing_Profile und ein Haushaltsfehler ohne lokalen Haushalt ergeben `fehler`.
4. Wenn `O(x)` gilt, ist `/onboarding` das Ziel.
5. Ohne offenen Nachweis und ohne Haushalt ist `/household/create` das Ziel.
6. Andernfalls ist die reguläre App das Ziel.

`C := { x ∈ X | x.authenticationSucceeded AND observable(F(x)) != Expected(x) }`

Damit umfasst `C` den direkten Sprung vom eingebetteten Login in den Profil-Schritt, die spätere Umleitung eines bestehenden Accounts nach `/onboarding` und die accountübergreifende Unterdrückung eines tatsächlich offenen Onboardings.

**Formal Specification:**

```text
FUNCTION isBugCondition(input)
  INPUT: input of type AuthenticatedAppEntryTrace
  OUTPUT: boolean

  openRegistrationOnboarding :=
    input.profile.onboardingRequiredAt IS NOT null
    AND input.profile.onboardingCompletedAt IS null
    AND input.sessionCompletionUserId != input.sessionUserId

  expectedState :=
    IF input.startStatePending THEN
      "loading"
    ELSE IF input.profileError OR input.profileMissing THEN
      "retry-error"
    ELSE IF input.householdsError AND input.localHouseholdCount = 0 THEN
      "retry-error"
    ELSE IF openRegistrationOnboarding THEN
      "/onboarding"
    ELSE IF input.localHouseholdCount = 0 THEN
      "/household/create"
    ELSE
      "/"
    END IF

  actualState := observableStateOfOriginalFlow(input)

  RETURN input.authenticationSucceeded = true
         AND actualState != expectedState
END FUNCTION
```

### Examples

- **Bestehender E-Mail-Account auf neuer Installation**: `hasSeenOnboarding = false`, `onboarding_required_at = null`, `onboarding_completed_at = null`, Login erfolgreich und lokaler Haushalt vorhanden. Erwartet ist Warten auf den Bootstrap und danach die App. Aktuell kann der Account-Schritt `onNext` auslösen oder der App-Entry nach `/onboarding` umleiten.
- **Bestehender Anbieter-Account**: Der Nutzer startet Apple oder Google im Account-Schritt. Die Provider-Sitzung trifft ein, aber das Profil besitzt keinen positiven Registrierungsnachweis. Erwartet ist der reguläre App-Einstieg. Aktuell interpretiert `oauthAttempted + session` jede Provider-Sitzung als Fortsetzung des Onboardings.
- **Bestehender Account ohne Haushalt**: Profil geladen, kein Registrierungsnachweis, `householdCount = 0`, keine Fehler. Erwartet ist `/household/create`. Aktuell hat der aus dem Null-Abschluss abgeleitete Prompt Vorrang.
- **Fehlender geräteweiter Hinweis**: Ein vorhandener Account meldet sich auf einem anderen Gerät an. Erwartet ist dieselbe accountbezogene Entscheidung wie auf einem bekannten Gerät. Der Gerätehinweis darf die angemeldete Entscheidung nicht beeinflussen.
- **Offene Registrierung vor dem Bugfix-Rollout**: Der Account wurde nach dem belegten früheren Onboarding-Rollout erstellt und hat weiterhin keinen Abschluss. Die Generated Column berechnet `onboarding_required_at = created_at`. Erwartet ist die Fortsetzung des Onboardings nach Login oder Neustart.
- **Zulässiger neuer Vergleichsfall**: Ein nach der Schemaänderung angelegtes Profil hat durch die Generated Column einen Nachweiszeitpunkt und keinen Abschluss. Das persönliche Onboarding bleibt erreichbar.
- **Offline-Grenze**: Ein bestehender Account hat ein verschlüsselt zwischengespeichertes Profil ohne Nachweis und einen lokalen Haushalt. Der initiale Remote-Pull schlägt fehl. Erwartet ist der vorhandene Offline-Start. Ohne lokalen Haushalt bleibt der bestehende Retry-Fehlerzustand maßgeblich.
- **Accountwechsel**: Account A hat das Onboarding in derselben App-Sitzung abgeschlossen, Account B besitzt einen positiven offenen Nachweis. Erwartet ist Onboarding für B. Ein globaler In-Memory-Boolean darf B nicht als abgeschlossen behandeln.
- **Fehlendes Profil**: Die Session ist bereit, die Profilabfrage ist beendet, liefert aber weder Profil noch klassifizierten Fehler. Erwartet ist ein sicherer Retry-Zustand, niemals App, Haushalt-anlegen oder Onboarding.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Ein tatsächlich neu angelegter Account erhält über seinen serverseitigen, unveränderlichen Profil-Erstellungszeitpunkt einen nicht-nullbaren `onboarding_required_at`-Wert und gelangt bei offenem Abschluss nach sofortiger Sitzung oder E-Mail-Bestätigung in die persönlichen Schritte.
- Ein bereits vor dem Bugfix neu registrierter und noch offener Account bleibt über die belegte Rollout-Berechnung als offen markiert.
- Eine erneuerte oder wiederhergestellte Sitzung desselben neuen, noch offenen Accounts liest den serverseitigen Nachweis erneut. Der Zustand hängt nicht von einer noch gemounteten Auth-Komponente ab.
- Der erfolgreiche Abschluss speichert weiterhin Profilwerte, Gewicht, Module und Haushaltsentscheidung. Erst nach diesen erfolgreichen Schritten setzt er den Abschlusszeitpunkt, den accountbezogenen Sitzungsabschluss und den geräteweiten Hinweis.
- Ohne Sitzung und ohne geräteweiten Hinweis bleibt Willkommen mit Account-Einstieg das Startziel.
- Ohne Sitzung und mit geräteweitem Hinweis bleibt `/sign-in` das Startziel.
- Fehlgeschlagene oder abgebrochene Anmeldung, Registrierung, Bestätigung und Anbieter-Authentifizierung erzeugen keine Session-Freigabe und keinen persönlichen Folgeschritt.
- Ein Login mutiert keine bestehenden Profilwerte, Moduleinstellungen, Haushaltsmitgliedschaften, SQLite-Daten oder verschlüsselten Accountdaten.
- Solange `accountReady`, Profilabfrage, Haushaltsabfrage oder initialer Haushaltspull noch nicht abgeschlossen sind, bleibt der vorhandene Ladezustand aktiv.
- Profilfehler und Missing_Profile sowie Haushaltsfehler ohne lokale Haushaltszeile bleiben im sicheren Retry-Zustand. Ein Haushalts-Pullfehler mit lokaler Haushaltszeile erlaubt weiterhin den vorgesehenen Offline-Start.
- Ein bestehender Account ohne Haushalt gelangt weiterhin nach `/household/create`.
- Bei Abmeldung oder Accountwechsel bleibt der neue Account gesperrt, bis der Cleanup des vorherigen Accounts abgeschlossen ist. Query-Cache, verschlüsselter Speicher, lokaler Datenbestand, Sitzungsabschluss und flüchtige Onboarding-Eingaben dürfen nicht accountübergreifend wirken.
- Der Entwicklungs-Override `EXPO_PUBLIC_FORCE_ONBOARDING` bleibt nutzbar und endet nach erfolgreichem Abschluss für die aktuelle Account-ID innerhalb derselben App-Sitzung.
- Recovery-Routen bleiben während des Session-Bootstraps erreichbar. Die Korrektur verändert keine Passwort-Recovery- oder Deep-Link-Regel.

**Scope:**

Alle Eingaben, für die `isBugCondition` `false` liefert, behalten ihr beobachtbares Verhalten. Dazu gehören:

- echte Neuregistrierungen mit offenem oder abgeschlossenem Onboarding
- bereits begonnene offene Neuregistrierungen aus der belegten Übergangsmenge
- anonyme Starts auf neuen und bekannten Geräten
- Auth-Fehler, Provider-Abbruch und ausstehende E-Mail-Bestätigung
- Lade-, Retry- und Offline-Zustände der bestehenden Startpipeline
- bestehende Accounts mit und ohne Haushalt
- Abmeldung, direkter Accountwechsel, Session-Erneuerung und App-Neustart
- erzwungenes Onboarding in Entwicklungsbuilds

Die berechnete Übergangsregel darf die Anforderungen 3.1 und 3.2 nicht durch einen pauschalen Default überschreiben. Sie verwendet deshalb den belegten späteren Produktiv-Rollout als zweite positive Bedingung neben dem offenen Abschluss. Ein Profil mit Null-Abschluss, aber einem Erstellungszeitpunkt vor dieser Grenze, wird nicht als offen geraten. Weil die Spalte aus `created_at` berechnet wird, ist kein einmaliges Daten-`UPDATE` in einer von `db:diff` erzeugten Migration nötig.

## Hypothesized Root Cause

Die Hauptursache ist durch Schema, Migration und Produktionscode direkt gestützt. Die genaue Reihenfolge eines sichtbaren Redirects hängt vom Router und vom Zeitpunkt des Auth-Ereignisses ab und wird deshalb in der Implementierungsphase mit fokussierten Tests bestätigt.

1. **Ein Nullwert trägt zwei Bedeutungen**: `supabase/migrations/20260806191905_add_profile_onboarding_completed_at.sql` fügte `onboarding_completed_at` nullable und ohne Rückfüllung hinzu. `private.handle_new_user()` legt neue Profile ebenfalls ohne Abschlusszeitpunkt an. Ältere bestehende Accounts und echte offene Registrierungen sind anhand dieses Felds allein nicht unterscheidbar.

2. **Die Readiness-Schicht macht aus dem Nullwert eine Freigabeentscheidung**: `AppEntryReadinessProvider` setzt `isUncompleted` allein über `onboarding_completed_at == null` und leitet daraus `shouldPromptOnboarding` ab. Der manuelle Cast verdeckt, dass die generierten Profiltypen zwar den Abschlusswert beschreiben, aber keinen positiven Registrierungsnachweis enthalten.

3. **Die Onboarding-Route ist für jede Sitzung freigegeben**: `RootNavigator` verwendet für `onboarding` den Guard `!!session || isNewUser`. Sobald irgendeine Anmeldung eine Session liefert, kann diese Route aktiv bleiben oder beim Entfernen des Auth-Routenzweigs zum Ziel werden, bevor die App-Entry-Entscheidung den Account klassifiziert hat.

4. **Der eingebettete Account-Schritt setzt Auth-Erfolg und Onboarding-Freigabe gleich**: E-Mail-Registrierung und E-Mail-Anmeldung erhalten beide `onSuccess={onNext}`. Für Apple und Google genügt `oauthAttempted && session`, um `onNext()` aufzurufen. Auch der allgemeine Session-Zweig zeigt jederzeit einen `Weiter`-Button mit `onNext`. Keiner dieser Pfade wartet auf einen positiven Profilnachweis.

5. **`oauthAttempted` bleibt nach Abbruch gesetzt**: Ein Provider-Abbruch setzt den lokalen Boolean nicht zurück. Eine später auf anderem Weg eintreffende Session wird weiterhin diesem Versuch zugerechnet. Der Boolean ist weder ein Erfolgsnachweis noch für die Routingentscheidung nötig.

6. **Der Sitzungsabschluss ist global statt accountbezogen**: `completedInCurrentSession` ist in Native und Web ein einzelner Boolean. Nach Abschluss durch Account A kann `isOnboardingSessionCompleted()` das offene Onboarding von Account B unterdrücken.

7. **Der flüchtige Onboarding-Store nimmt nicht am Account-Cleanup teil**: Der Zustand enthält persönliche Profil-, Haushalts-, Modul- und Berechtigungseingaben und hat eine `reset`-Funktion, wird im Produktpfad aber nicht über `resetLocalAccountModuleCaches` zurückgesetzt.

8. **Ein fehlendes Profil ist im defensiven Zustand nicht fail-closed**: Der reale `.single()`-Request erzeugt für eine fehlende Zeile normalerweise `PGRST116`, den `useSignOutOnOrphanedProfile` behandelt. Die Readiness-Schicht und ihr Testmodell erlauben jedoch zusätzlich `profile = undefined` ohne Fehler und lassen dann App-Inhalt zu. Die neue Klassifikation muss auch diesen Zustand sicher behandeln.

9. **Lokale Ersatzsignale lösen das Grundproblem nicht**: Der geräteweite Hinweis ist absichtlich nicht accountgebunden. Ein lokaler Registrierungsmodus ginge bei Neuinstallation oder Gerätewechsel verloren. UI-Modus und Auth-Ereignis beweisen nicht, dass Supabase genau jetzt einen neuen Account angelegt hat. Der im Auth-Trigger erzeugte Profil-Erstellungszeitpunkt ist die kleinste dauerhafte Belegstelle; eine serverseitig berechnete Projektion macht ihn für die Startentscheidung eindeutig.

## Correctness Properties

Property 1: Bug Condition - Onboardingfreigabe entspricht dem Accountnachweis

_For any_ erfolgreichen Authentifizierungs- und Start-Trace, für den `isBugCondition` `true` liefert, SHALL `F'` zunächst den vollständigen Account-, Profil- und Haushaltszustand abwarten und anschließend genau `Expected(input)` liefern. Ein Account ohne offenen positiven Registrierungsnachweis SHALL keine persönlichen Onboarding-Schritte sehen. Ein Account mit offenem positiven Registrierungsnachweis SHALL sein Onboarding fortsetzen, auch wenn eine andere Account-ID es in derselben App-Sitzung bereits abgeschlossen hat.

**Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.11**

```text
FUNCTION expectedBehavior(result)
  INPUT: result of type AuthenticatedAppEntryTraceResult
  OUTPUT: boolean

  openRegistrationOnboarding :=
    result.profile.onboardingRequiredAt IS NOT null
    AND result.profile.onboardingCompletedAt IS null
    AND result.sessionCompletionUserId != result.sessionUserId

  expectedState :=
    IF result.startStatePending THEN
      "loading"
    ELSE IF result.profileError OR result.profileMissing THEN
      "retry-error"
    ELSE IF result.householdsError AND result.localHouseholdCount = 0 THEN
      "retry-error"
    ELSE IF openRegistrationOnboarding THEN
      "/onboarding"
    ELSE IF result.localHouseholdCount = 0 THEN
      "/household/create"
    ELSE
      "/"
    END IF

  RETURN result.observableState = expectedState
         AND result.existingAccountDataMutations = 0
         AND result.renderedAccountId = result.sessionUserId
END FUNCTION
```

Property 2: Preservation - Nicht betroffene Auth- und Startzustände

_For any_ Eingabe, für die `isBugCondition` `false` liefert, SHALL `F'` denselben beobachtbaren Auth-, Fehler-, Offline- und App-Startzustand wie `F` erzeugen. Dies bewahrt Abschlussreihenfolge, anonyme Einstiege, sichere Fehlerzustände, Haushalt-anlegen, lokale Offline-Fallbacks, Recovery-Routen und bestehende Accountdaten.

**Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `supabase/schemas/02_profiles.sql`, `supabase/schemas/99_privileges.sql`

**Functions and structures**: `public.profiles`, neuer Guard für Profil-Herkunft und Abschlussrichtung, Profilprivilegien

**Specific Changes**:

1. **Positiven Registrierungsnachweis berechnen**: `onboarding_required_at timestamptz generated always as (case when created_at >= ONBOARDING_FLOW_ROLLOUT_AT then created_at else null end) stored` zu `public.profiles` hinzufügen. Der konkrete ISO-Zeitpunkt ersetzt im SQL den symbolischen Namen. Die Spalte ist für bestehende und neue Zeilen deterministisch und braucht kein Daten-`UPDATE`.
2. **Erstellungszeitpunkt schützen**: Ein `BEFORE UPDATE`-Guard nach dem vorhandenen security-invoker-Muster verhindert für authentifizierte Clientzugriffe jede Änderung von `created_at`. Dadurch kann ein bestehender Account den berechneten Nachweis nicht nachträglich erzeugen oder entfernen.
3. **Abschluss monoton halten**: Derselbe Guard verhindert, dass ein bereits gesetzter `onboarding_completed_at` wieder auf `null` gesetzt wird. Das erstmalige Setzen und ein späteres Erneuern eines nicht-nullbaren Zeitpunkts bleiben für den bestehenden Completion- und Entwicklungsfluss möglich.
4. **Direkte Client-Inserts schließen**: `profiles_insert_own` entfernen und in `99_privileges.sql` `INSERT` auf `public.profiles` für `anon` und `authenticated` entziehen. Der bestehende Auth-Trigger bleibt der einzige reguläre Profil-Erzeuger; der Repository-Produktcode enthält keinen direkten Profil-Insert. `service_role` behält den für kontrollierte Serveroperationen nötigen Zugriff.
5. **Offene Bestandsregistrierungen erhalten**: `ONBOARDING_FLOW_ROLLOUT_AT` ist der spätere belegte Zeitpunkt aus produktiver Schemaausrollung und verfügbarer Clientversion mit dem Abschlussvertrag. Profile ab dieser Grenze mit Null-Abschluss bleiben durch die berechnete Spalte offen; ältere Nullwerte werden nicht umgedeutet.
6. **Gestaffelte Clients unterstützen**: Ältere Clients können nach dem Schema-Rollout weiterhin nur `onboarding_completed_at` setzen. Es gibt keinen Constraint und keinen Pflichtschreibzugriff auf die Generated Column.
7. **Schemaworkflow einhalten**: Migration ausschließlich mit `bun run db:diff` erzeugen, mit `bun run db:reset` gegen die lokale Instanz prüfen und `src/lib/database.types.ts` ausschließlich mit `bun run db:types` erneuern. Weil die Übergangslogik im deklarativen Ausdruck liegt, muss die generierte Migration nicht manuell um ein Datenstatement ergänzt werden.
8. **RLS und Guard gemeinsam prüfen**: Eigene Select- und Update-Policies bleiben bestehen. pgTAP belegt zusätzlich, dass Clients weder Profile direkt anlegen noch `created_at`, `onboarding_required_at` oder einen abgeschlossenen Nullzustand manipulieren können.

**File**: `src/features/onboarding/api.ts`

**Function**: `markOnboardingCompleted`

**Specific Changes**:

1. Weiterhin ausschließlich `onboarding_completed_at` auf einen ISO-Zeitpunkt setzen. `onboarding_required_at` bleibt als unveränderlicher Herkunftsnachweis erhalten.
2. Die bestehende Reihenfolge in `completeOnboarding` bewahren: Erst Profil, Gewicht, Module, Haushalt und Pull erfolgreich abschließen, danach den Abschluss schreiben.
3. Fehler weiterhin zurückgeben. Ein fehlgeschlagener Abschluss darf weder lokalen Erfolg noch App-Freigabe erzeugen.

**Files**: `src/features/onboarding/domain/app-entry.ts`, `src/features/onboarding/app-entry-readiness.tsx`

**Functions**: neue reine Ableitung `hasOpenRegistrationOnboarding`, `resolveAppEntry`, `AppEntryReadinessProvider`

**Specific Changes**:

1. Eine kleine reine Funktion normalisiert einen in älteren verschlüsselten Cache-Zeilen fehlenden Nachweis zuerst auf `null` und definiert danach den einzigen Prompt-Vertrag:

```text
requiredAt := profile?.onboarding_required_at ?? null

hasOpenRegistrationOnboarding(profile, sessionCompletionUserId, userId) =
  requiredAt IS NOT null
  AND profile.onboarding_completed_at IS null
  AND sessionCompletionUserId != userId
```

2. Der Profilparameter nutzt `Partial<Pick<...>>` aus dem generierten `Database`-Row-Typ, damit `undefined` aus einem alten Cache ausdrücklich und ohne `any` modelliert ist. Es wird kein doppeltes vollständiges Profilmodell eingeführt.
3. `AppEntryReadinessProvider` übergibt nur das Ergebnis dieser Funktion als `shouldPromptOnboarding` an `resolveAppEntry`.
4. Ein fehlendes neues Feld aus einem älteren verschlüsselten Cache gilt nach der Normalisierung nicht als positiver Nachweis. Ein nach beendetem Laden fehlendes Profil wird dagegen als `profileMissing` in den sicheren Profilfehlerpfad gegeben.
5. Die Reihenfolge in `resolveAppEntry` bleibt: anonymer Einstieg, Warten, Profilfehler oder Missing_Profile, nicht lokal abfangbarer Haushaltsfehler, offenes nachgewiesenes Onboarding, Haushalt-anlegen, reguläre App.
6. `hasSeenOnboarding` bleibt ausschließlich im Zweig ohne Sitzung relevant.

**Files**: `src/features/onboarding/onboarding-completion.ts`, `src/features/onboarding/onboarding-completion.web.ts`

**Functions**: `markOnboardingSessionCompleted`, `isOnboardingSessionCompleted`, `persistOnboardingCompleted`, neue geräteweite Persistenzfunktion

**Specific Changes**:

1. Den globalen Boolean durch eine Account-ID ersetzen. `markOnboardingSessionCompleted(userId)` verlangt eine nicht leere ID; `isOnboardingSessionCompleted(userId)` liefert nur für exakt dieselbe ID `true`.
2. Das Schreiben des geräteweiten Hinweises als eigene Funktion, zum Beispiel `persistSeenOnboarding()`, benennen. Diese Funktion setzt keinen Accountabschluss.
3. `persistOnboardingCompleted(userId)` markiert zuerst nur diese Account-ID als in der Sitzung abgeschlossen und schreibt danach den geräteweiten Hinweis. Wie bisher bleibt der In-Memory-Erfolg bestehen, falls SecureStore beziehungsweise Browser-Storage nicht geschrieben werden kann.
4. Native und Web behalten dieselbe exportierte Schnittstelle. Es entsteht kein neuer Storage-Key und keine geräteweite Accountzuordnung.

**Files**: `src/features/onboarding/onboarding-store.ts`, `src/app/(app)/_layout.tsx`, `src/features/settings/settings-screen.tsx`, `src/features/navigation/root-navigator.tsx`

**Functions**: `completeOnboarding`, `AppLayoutContent`, `handleSignOut`, `RootNavigator`

**Specific Changes**:

1. `completeOnboarding` übergibt `session.user.id` an `persistOnboardingCompleted`.
2. Der App-Layout-Nachtrag für bestehende Accounts ohne Gerätehinweis und der Settings-Abmeldepfad schreiben nur `persistSeenOnboarding()`. Sie dürfen keinen Account als in dieser Sitzung abgeschlossen markieren.
3. `RootNavigator` liest die bereits vorhandene `AppEntryDecision`. Für eine authentifizierte Sitzung ist `onboarding` nur verfügbar, wenn die Entscheidung ausdrücklich nach `/onboarding` zeigt oder der Entwicklungs-Override aktiv ist.
4. Während die authentifizierte App-Entry-Entscheidung `warten` oder `fehler` lautet, bleibt der `(app)`-Zweig zuständig. Er zeigt weiterhin den bestehenden Lade- beziehungsweise Retry-Zustand. Onboarding ist kein Fallback.
5. Ohne Sitzung bleiben die bisherigen Guards unverändert: kein Gerätehinweis erlaubt Willkommen, vorhandener Gerätehinweis erlaubt Auth, Recovery-Routen bleiben erreichbar.
6. Der Entwicklungs-Override prüft den Sitzungsabschluss für die aktuelle Account-ID.

**Files**: `src/features/onboarding/components/account-step.tsx`, `src/features/auth/screens/sign-up-screen.tsx`

**Functions**: `AccountStepForm`, `SignUpScreen`

**Specific Changes**:

1. Kein Auth-Erfolg ruft ungeprüft `onNext` auf. Erfolgreiche E-Mail-Anmeldung, E-Mail-Registrierung mit sofortiger Sitzung und erfolgreiche E-Mail-Bestätigung fordern zunächst den regulären Root-Einstieg an. Ein einmaliger Retry beim Eintreffen der Session folgt dem bereits in `SignInScreen` verwendeten Muster.
2. `oauthAttempted` und der zugehörige `session`-Effekt werden entfernt. Provider-Erfolg wird durch die Session und den Root-Guard verarbeitet; Provider-Abbruch ohne Session bleibt im aktuellen Zustand.
3. Der allgemeine Session-Zweig zeigt den vorhandenen `Weiter`-Button nur, wenn die aufgelöste App-Entry-Entscheidung ausdrücklich `/onboarding` erlaubt oder der Entwicklungs-Override aktiv ist. Während `warten`, `fehler`, `weiter` und `/household/create` kann er keine persönlichen Schritte freigeben.
4. Ein neuer Account kehrt nach der serverseitigen Klassifikation in den Onboarding-Account-Schritt zurück und kann mit dem vorhandenen `Weiter`-Button zu Profil wechseln. Der zusätzliche explizite Schritt ist einer unbewiesenen automatischen Freigabe vorzuziehen.
5. `SignUpScreen` führt auch seinen sofortigen Signup- und Bestätigungsabschluss zunächst nach `/`; der zentrale Guard bringt nur einen positiv markierten offenen Account nach `/onboarding`.
6. Den sichtbaren `sign_in`- oder `sign_up`-Modus und den Anbieter nicht als Registrierungsnachweis verwenden.

**Files**: `src/features/onboarding/onboarding-store.ts`, `src/lib/storage/local-account-cache-registry.ts` über die bestehende Schnittstelle

**Function**: Registrierung des Store-Resets

**Specific Changes**:

1. Den vorhandenen `useOnboardingStore.getState().reset()` als Modulcache-Reset registrieren.
2. Bei erfolgreicher Abmeldung oder direktem Accountwechsel löscht `clearLocalAccountData` damit Profil-, Haushalts-, Modul- und Berechtigungseingaben des vorherigen Accounts, bevor der nächste Account bereit wird.
3. Der Store bleibt flüchtig und erhält keine neue Persistenzschicht oder Account-ID.

**Test- und generierte Dateien**:

- `supabase/tests/02_profiles.test.sql`
- `src/lib/database.types.ts`, nur Generatorausgabe
- `src/features/onboarding/domain/app-entry.test.ts`
- `src/features/navigation/app-layout-startup.test.tsx`
- `src/features/navigation/root-navigator.test.tsx`
- `src/features/onboarding/components/account-step.test.tsx`
- `src/features/auth/screens/sign-up-screen.test.tsx`
- `src/features/onboarding/onboarding-completion.test.ts`
- `src/features/onboarding/onboarding-completion.web.test.ts`
- `src/features/onboarding/onboarding-store-completion.test.tsx`
- `src/features/onboarding/onboarding-store.test.ts`
- bei Bedarf bestehende Mocks in `src/features/app-shell/app-layout-provider-gate.test.tsx` und `src/features/settings/settings-screen.test.tsx`

**State Transitions**:

| Ausgangszustand | Belegter Zustand nach Bootstrap | Entscheidung von F' |
| --- | --- | --- |
| Keine Sitzung, Gerätehinweis fehlt | keine Accountabfrage | `/onboarding`, beginnend mit Willkommen und Account |
| Keine Sitzung, Gerätehinweis vorhanden | keine Accountabfrage | `/sign-in` |
| Auth erfolgreich, Account oder Profil lädt | Klassifikation offen | `warten`, kein persönlicher Schritt |
| Profil nach abgeschlossenem Laden fehlt | Missing_Profile | sicherer Retry-Zustand |
| Bestehender Account, kein Nachweis, Abschluss null, lokaler Haushalt vorhanden | bereit | reguläre App |
| Bestehender Account, kein Nachweis, Abschluss null, kein Haushalt | bereit | `/household/create` |
| Neuer oder rückgefüllter offener Account, Nachweis vorhanden, Abschluss null | bereit | `/onboarding` |
| Nachgewiesener Account, Abschluss gesetzt | bereit | reguläre Startregeln |
| Profilfehler | Profil nicht sicher nutzbar | vorhandener Retry-Zustand |
| Haushalts-Pullfehler, keine lokale Zeile | Leerzustand nicht sicher belegbar | vorhandener Retry-Zustand |
| Haushalts-Pullfehler, lokale Zeile vorhanden | Offline-Bestand belegt | nachgewiesenes offenes Onboarding oder reguläre App |
| Provider-Abbruch | keine neue Session | aktuelle Auth-Oberfläche bleibt |
| Account A wechselt zu B | A-Cleanup läuft | `warten`; B bleibt gesperrt |
| Account B nach A-Cleanup | B-Profil und B-Cache geladen | ausschließlich B-Nachweis entscheidet |

**Implementation Order**:

1. `ONBOARDING_FLOW_ROLLOUT_AT` aus Produktiv-Deployment-Evidenz belegen. Ohne Beleg nicht migrieren.
2. Deklaratives Profilschema, Berechnung, Update-Guard, Insert-Privilegien und pgTAP-Vertrag ändern.
3. Migration erzeugen, lokale Datenbank zurücksetzen und Typen generieren.
4. Reine Onboarding-Ableitung, Missing_Profile und accountbezogene Sitzungsmarkierung implementieren.
5. App-Entry, Root-Guard und Auth-Erfolgsübergänge auf die zentrale Entscheidung umstellen.
6. Store-Reset registrieren.
7. Fokussierte Tests, Rückbau-Nachweis, Typecheck und Biome ausführen.
8. Datenbank vor dem Client ausrollen. Keine neue Client-Version wird vor dem Schema veröffentlicht.

## Testing Strategy

### Validation Approach

Die Verifikation trennt Gegenbeleg, Fix Checking und Preservation Checking. Zuerst werden die aktuellen falschen Übergänge auf dem unveränderten Code sichtbar gemacht. Danach wird die kleinste Korrektur implementiert und mit gezielten Tests geprüft. Für jeden gefundenen Fehler gilt der Projektablauf: Reparatur aktiv und Test grün, Reparatur vorübergehend manuell zurücknehmen oder auskommentieren und denselben Test rot beobachten, Reparatur wieder einsetzen und denselben Test erneut grün ausführen. `git reset` wird dafür nicht verwendet.

Die zentrale Ableitung hat eine kleine endliche Domäne. Sie wird ohne neue Testbibliothek durch zwei fokussierte, generierte Tabellen geprüft: eine Tabelle für den offenen Registrierungsnachweis und eine Tabelle für die Priorität der App-Entry-Entscheidung. Auth-Arten werden separat in Komponentenbeispielen geprüft, weil sie keine Eingabe von `resolveAppEntry` sind.

RNTL-v14-Aufrufe werden asynchron verwendet: `render`, `rerender`, `renderHook`, `act`, `fireEvent` und `userEvent` werden jeweils `await`et. UI-Prüfungen verwenden bevorzugt Rollen, zugängliche Namen und sichtbare Ziele.

### Exploratory Bug Condition Checking

**Goal**: Vor der Implementierung belegen, dass der aktuelle Code einen bestehenden Account ohne positiven Nachweis in persönliche Schritte leitet und einen offenen Account durch fremden Sitzungsabschluss unterdrücken kann.

**Test Plan**:

- Die bestehende App-Layout-Fixture mit `onboarding_completed_at = null`, einem vorhandenen Haushalt und einem bestehenden Account ausführen. Der aktuelle Test erwartet `/onboarding` und bildet den ersten Gegenbeleg.
- Im `AccountStepForm` vom Signup-Modus zu Anmeldung wechseln, einen erfolgreichen E-Mail-Login simulieren und beobachten, dass `onNext` aufgerufen wird.
- Eine Apple- oder Google-Session nach `oauthAttempted` veröffentlichen und beobachten, dass ebenfalls `onNext` aufgerufen wird.
- Im Root-Navigator eine bestehende authentifizierte Sitzung mit regulärer App-Entscheidung setzen und belegen, dass die Onboarding-Route trotzdem registriert ist.
- Account A als in dieser Sitzung abgeschlossen markieren und anschließend Account B mit offenem Profil prüfen. Der aktuelle globale Boolean unterdrückt B ebenfalls.
- Eine fertige Session mit `profile = undefined` und ohne Query-Fehler modellieren. Der aktuelle Test lässt App-Inhalt zu; dies widerlegt einen sicheren Missing_Profile-Vertrag.

**Test Cases**:

1. **Bestehender E-Mail-Account mit Null-Abschluss**: Login im eingebetteten Account-Schritt, lokaler Haushalt vorhanden. F gibt einen persönlichen Schritt frei.
2. **Bestehender Anbieter-Account**: Provider-Sitzung trifft ein. F gibt ohne Klassifikation einen persönlichen Schritt frei.
3. **App-Entry-Nullwert**: Bestehendes Profil mit Null-Abschluss. F leitet nach `/onboarding`.
4. **Bestehender Account ohne Haushalt**: Null-Abschluss und `householdCount = 0`. F wählt Onboarding statt `/household/create`.
5. **Accountwechsel A zu B**: A setzt den globalen Sitzungsabschluss, B hat offenes Onboarding. F behandelt B fälschlich als abgeschlossen.
6. **Missing_Profile**: Profilabfrage ist beendet, aber das Testmodell liefert kein Profil und keinen Fehler. F gibt App-Inhalt frei.
7. **Offline-Vergleich**: Bestehendes Profil und lokaler Haushalt sind verfügbar, Remote-Pull scheitert. Der aktuelle Offline-Start ohne Prompt wird als Erhaltungsbeleg aufgezeichnet.

**Expected Counterexamples**:

- `onNext` wird nach E-Mail-Login oder Provider-Session aufgerufen, obwohl keine Klassifikation vorliegt.
- `resolveAppEntry` erhält `shouldPromptOnboarding = true` allein wegen `onboarding_completed_at = null`.
- `RootNavigator` hält `onboarding` für jede nicht-nullbare Session zugänglich.
- `isOnboardingSessionCompleted()` liefert nach Abschluss durch A auch für B `true`.
- Missing_Profile kann ohne Fehler- oder Ladezustand in regulären Inhalt gelangen.

Wenn einer dieser Gegenbelege auf dem unveränderten Stand nicht reproduzierbar ist, wird die zugehörige Ursachenhypothese verworfen, bevor der Implementierungsumfang erweitert wird.

### Fix Checking

**Goal**: Für alle Eingaben der Bug_Condition prüfen, dass F' nach vollständiger Bereitschaft exakt die aus dem eigenen Accountnachweis abgeleitete Startentscheidung liefert.

**Pseudocode:**

```text
FOR ALL input WHERE isBugCondition(input) DO
  trace := executeAuthenticatedAppEntryWithControlledState(input)
  ASSERT expectedBehavior(trace)
END FOR
```

Die Prüfung erfasst nicht nur die Endroute. Sie beobachtet auch, dass während Account-, Profil- oder Haushaltsladen kein persönlicher Schritt gerendert wird und dass der Login keine vorhandenen Accountdaten mutiert.

### Preservation Checking

**Goal**: Für alle Eingaben außerhalb der Bug_Condition prüfen, dass F' das bisherige beobachtbare Verhalten beibehält.

**Pseudocode:**

```text
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT observableBehavior(F(input)) = observableBehavior(F'(input))
END FOR
```

**Testing Approach**:

Die reine Belegfunktion wird vollständig über ihre drei normalisierten Achsen geprüft. Ein zusätzlicher Altdaten-Test übergibt `undefined` und belegt dessen Normalisierung auf `null`. Die App-Entry-Priorität wird mit einer kleinen fallbasierten Tabelle geprüft, in der jeder Eintrag genau eine Regel gegenüber sonst unauffälligen Werten hervorhebt. Komponenten- und Integrationstests prüfen anschließend die beobachtbaren Auth- und Accountübergänge.

**Generated Proof Matrix**:

- Vor der Matrix: `undefined` für `onboardingRequiredAt` wird in einem eigenen Test auf `null` normalisiert.
- `normalizedOnboardingRequiredAt ∈ {null, timestamp}`
- `onboardingCompletedAt ∈ {null, timestamp}`
- `sessionCompletionOwner ∈ {none, same-user, other-user}`
- Erwartung: Nur `requiredAt = timestamp`, `completedAt = null` und `owner != same-user` ergibt offen.

**Decision Precedence Table**:

- anonym und Gerätehinweis fehlt
- anonym und Gerätehinweis vorhanden
- vorhandene Sitzung mit offener Ladeachse
- Profilfehler
- Missing_Profile
- Haushaltsfehler ohne lokalen Haushalt
- Haushaltsfehler mit lokalem Haushalt
- offener positiver Registrierungsnachweis
- bestehender Account ohne Haushalt
- bestehender Account mit Haushalt

**Preservation Test Cases**:

1. **Neue Registrierung**: Nachweis plus Null-Abschluss führt nach Bereitschaft zu `/onboarding`.
2. **Historisch offene Registrierung**: Rückgefüllter Nachweis plus Null-Abschluss führt nach Neustart erneut zu `/onboarding`.
3. **Abschluss**: Alle bestehenden Schreibschritte laufen; erst danach werden Abschlusszeitpunkt, eigene Sitzungs-ID und Gerätehinweis gesetzt.
4. **Anonymer Start**: Gerätehinweis false führt zu Willkommen, true zu Anmeldung.
5. **Fehler und Abbruch**: Keine Session bedeutet keine App- oder persönliche Erfolgsfreigabe.
6. **Offline**: Lokaler Haushalt plus fehlgeschlagener Pull bleibt nutzbar; fehlender lokaler Haushalt bleibt im Retry-Zustand.
7. **Haushalt fehlt**: Bestehender Account geht nach `/household/create`.
8. **Accountwechsel**: A-Daten, A-Query-Cache, A-Sitzungsabschluss und A-Onboarding-Formdaten beeinflussen B nicht.
9. **Entwicklungs-Override**: Erzwungenes Onboarding bleibt erreichbar und endet nur für dieselbe Account-ID nach erfolgreichem Abschluss.
10. **Recovery**: Recovery-Routen bleiben während Session-Bootstrap und Fehlerzuständen erreichbar.

### Unit Tests

- `src/features/onboarding/domain/app-entry.test.ts`: Die Belegmatrix akzeptiert nur Nachweiszeitpunkt plus Null-Abschluss plus nicht passenden Sitzungsowner. Ein älterer Null-Abschluss ohne Nachweis ist niemals offen.
- Dieselbe Datei: Die fallbasierte Prioritätstabelle wählt weiterhin `warten`, `fehler`, `/onboarding`, `/household/create` oder `weiter` in der festgelegten Reihenfolge.
- `src/features/navigation/app-layout-startup.test.tsx`: Bestehender Account mit Null-Abschluss und ohne Nachweis startet mit lokalem Haushalt; ohne Haushalt geht er zu `/household/create`; positiver offener Nachweis geht zu `/onboarding`; Missing_Profile zeigt Retry; Lade- und Offline-Fälle bleiben erhalten.
- `src/features/navigation/root-navigator.test.tsx`: Eine bestehende Session mit `weiter` registriert die Onboarding-Route nicht; eine offene nachgewiesene Registrierung und der Entwicklungs-Override tun es; Auth- und Recovery-Guards bleiben erhalten.
- `src/features/onboarding/components/account-step.test.tsx`: Kein Auth-Callback ruft ungeprüft `onNext` auf. Der Button erscheint erst nach ausdrücklicher Onboarding-Entscheidung. Provider-Abbruch ohne Session navigiert nicht; ein späterer anderer Login wird nicht über einen alten `oauthAttempted`-Wert fortgesetzt.
- `src/features/auth/screens/sign-up-screen.test.tsx`: Sofortiger Signup- und Bestätigungsabschluss führen zunächst nach `/`, nicht ungeprüft nach `/onboarding`.
- `src/features/onboarding/onboarding-completion.test.ts` und `.web.test.ts`: Abschluss gilt nur für die übergebene Account-ID; A ist nicht B. Gerätehinweis bleibt global und Schreibfehler nehmen den Sitzungsabschluss nicht zurück.
- `src/features/onboarding/onboarding-store-completion.test.tsx`: Abschluss setzt weiterhin den Serverzeitpunkt, invalidiert das eigene Profil und markiert nur `session.user.id` lokal.
- `src/features/onboarding/onboarding-store.test.ts`: Der registrierte Account-Cleanup setzt persönliche Formularwerte und Schritt zurück.
- Bestehende SessionProvider-Tests bleiben unverändert grün und belegen weiterhin, dass der alte Account vor Freigabe des neuen Accounts bereinigt wird.

### Property-Based Tests

- Einen separaten Altdatenfall mit `onboardingRequiredAt = undefined` prüfen und belegen, dass er vor der Matrix zu `null` normalisiert wird.
- Alle zwölf Kombinationen der normalisierten Belegmatrix deterministisch erzeugen. Genau zwei Kombinationen sind offen: Nachweis vorhanden, Abschluss null und Sitzungsowner entweder nicht gesetzt oder eine andere ID. Alle anderen Kombinationen sind geschlossen.
- Die fallbasierte Entscheidungstabelle mit variierenden irrelevanten Gerätehinweisen prüfen. Bei vorhandener Sitzung darf `hasSeenOnboarding` kein Ergebnis verändern.
- Für jede einzelne offene Ladeachse bei vorhandener Sitzung prüfen, dass `warten` gilt und weder App noch Onboarding-Inhalt freigegeben wird.
- Für Haushaltsfehler prüfen: Eine lokale Haushaltszeile erhält den Offline-Start, null lokale Zeilen ergeben `fehler`.
- Für alle Paare unterschiedlicher Account-IDs A und B prüfen: `isOnboardingSessionCompleted(A)` kann nur A schließen. B wird ausschließlich aus B-Profil und B-Sitzungsmarker entschieden.
- Auth-Art wird nicht in die reine Matrix aufgenommen. E-Mail, Apple, Google und Session-Wiederherstellung werden als getrennte Komponenten- oder Integrationstests ausgeführt.
- Keine zusätzliche Property-Test-Bibliothek installieren. Generierte `it.each`-Tabellen reichen für diese endlichen Domänen.

### Integration Tests

- `supabase/tests/02_profiles.test.sql`: Ein neuer `auth.users`-Datensatz erzeugt genau ein eigenes Profil mit nicht-nullbarem, aus `created_at` berechnetem `onboarding_required_at`; bestehende private RLS-Isolation bleibt erhalten; ein authentifizierter Client kann weder ein Profil direkt einfügen noch `created_at` oder einen gesetzten Abschluss zurücksetzen.
- Generierte Migration prüfen: Sie ergänzt die gespeicherte Generated Column mit dem belegten `ONBOARDING_FLOW_ROLLOUT_AT`, schützt `created_at` und die Abschlussrichtung und entzieht regulären Clients den direkten Profil-Insert. Sie enthält kein manuell ergänztes Daten-`UPDATE`.
- `src/features/auth/auth.integration.test.ts`: Ein real über die lokale Supabase-Instanz erzeugter neuer Nutzer liest einen Nachweiszeitpunkt; nach Abschluss und neuem Client liest derselbe Nutzer den geschlossenen Zustand. Eine erneute Passwort-Anmeldung erzeugt keinen neuen Nachweis.
- Zusammengesetzter App-Starttest: SessionProvider veröffentlicht den Account erst nach verschlüsselter Query-Hydrierung. Ein bestehendes Cache-Profil ohne Nachweis plus lokaler Haushalt startet bei Pullfehler offline; ein Profil von Account A darf nach Wechsel zu B nicht gelesen werden.
- Routingtest über den Root-Navigator: Login aus dem Onboarding-Account-Schritt führt zunächst in den App-Entry-Ladezustand. Ein bestehender Account endet in App oder Haushalt-anlegen, ein nachgewiesener offener Account kehrt in Onboarding zurück.
- Nach der Implementierung auf bestehenden iOS- und Android-Dev-Clients je einen E-Mail-Login eines bestehenden Accounts prüfen. Auf iOS zusätzlich einen konfigurierten Anbieter-Login prüfen. Es dürfen keine persönlichen Profil-, Haushalts-, Modul- oder Berechtigungsschritte erscheinen.
- Eine neue E-Mail-Registrierung mit Bestätigung durchführen, die App vor Abschluss neu öffnen und prüfen, dass das Onboarding wieder erscheint. Danach abschließen und einen weiteren Neustart prüfen; nun gelten die regulären Startregeln.
- Einen Account aus der belegten historischen Übergangsmenge prüfen. Trotz erneutem Login oder Neustart bleibt sein offenes Onboarding erhalten.
- Einen Accountwechsel A zu B im selben Prozess prüfen. B darf weder A-Formwerte noch A-Abschluss übernehmen. Der nächste Accountinhalt wird erst nach abgeschlossenem Cleanup sichtbar.
- Für die Design-Phase werden weder Dev-Server, Build noch Datenbankreset gestartet. Die spätere Implementierung verwendet vorhandene Dev-Clients; diese Änderung fügt kein natives Modul hinzu und erzwingt keinen Rebuild.

**Focused Verification Commands after Implementation:**

```text
bun run db:diff
bun run db:reset
bun run db:types
bun run test:db supabase/tests/02_profiles.test.sql
bun run test src/features/onboarding/domain/app-entry.test.ts
bun run test src/features/navigation/app-layout-startup.test.tsx src/features/navigation/root-navigator.test.tsx
bun run test src/features/onboarding/components/account-step.test.tsx src/features/auth/screens/sign-up-screen.test.tsx
bun run test src/features/onboarding/onboarding-completion.test.ts src/features/onboarding/onboarding-completion.web.test.ts
bun run test src/features/onboarding/onboarding-store.test.ts src/features/onboarding/onboarding-store-completion.test.tsx
bun run test src/features/auth/session-provider.test.tsx src/features/auth/account-isolation.test.ts
bun run typecheck
bun run check
```

Vor dem finalen Check-Lauf wird der Produktstand mit genau diesem Prüfauftrag erneut bewertet: "I'm going over the product once more before the final check run, looking for anything a strict evaluator would catch."

**Formal Completion:**

- `ONBOARDING_FLOW_ROLLOUT_AT` ist durch Produktiv-Deployment-Evidenz belegt. Ohne diesen Beleg bleibt die Implementierung blockiert.
- Die explorativen Tests belegen die alte Bug_Condition auf dem unfixed Stand.
- Property 1 und Property 2 sind durch Belegmatrix, Entscheidungstabelle und fokussierte Auth-Beispiele abgedeckt.
- Der pgTAP-Test, die fokussierten Jest-/RNTL-Tests, Typecheck und Biome sind grün.
- Der vorgeschriebene Grün-Rot-Grün-Rückbau wurde für den Login-Gegenbeleg, den Profilnachweis und die accountbezogene Sitzungsmarkierung dokumentiert.
- Die generierte Datenbankmigration berechnet den Nachweis aus dem geschützten Erstellungszeitpunkt und dem belegten Rollout, enthält kein von Hand ergänztes Datenstatement und wurde nicht manuell verändert.
- E-Mail-Login, Anbieter-Login, neue Registrierung, historisch offene Registrierung, Neustart, Missing_Profile, Offline-Fallback und Accountwechsel sind auf den betroffenen Laufzeitflächen geprüft.
- Diese Design-Phase ändert ausschließlich die Spec-Datei. Produktcode, Tests, Schema und Datenbanktypen werden erst nach Freigabe in der Implementierungsphase geändert.