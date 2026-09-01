# Spec: RevenueCat Monetarisierung mit Plus und AI

**Status:** Fachlich freigegeben für die Planungsphase

**Stand:** 2026-09-01

**Quellen:** RevenueCat-Dashboard-Stand aus dem Maintainer-Kontext, bestehende
RevenueCat-Integration in `src/lib/purchases.ts` und
`src/features/premium/`, Haushaltsmodell in
`supabase/schemas/03_households.sql`, Webhook unter
`supabase/functions/revenuecat-webhook/`.

## 1. Objective

Die Haushaltsapp soll RevenueCat mit zwei Zugriffsstufen und zwei Entitlements
verwenden:

- **Plus** für werbefreie, haushaltsbezogene Funktionen und die bisherigen
  Premium-Funktionen.
- **AI** für zusätzliche AI-Funktionen wie KI-Rezepte, Sprachsteuerung und
  intelligente Vorschläge.

Nutzer sollen auf iOS und Android die passenden Produkte sehen, kaufen,
wiederherstellen und verwalten können. Ein aktives Entitlement soll genau die
zugehörigen Funktionen freischalten. Plus und AI sind getrennte Entitlements
und Produkte. Beide Zugriffsarten gelten haushaltsweit, aber nur für den jeweils
zugeordneten aktiven Haushalt. Ein Account kann Plus, AI oder beide Entitlements
gleichzeitig besitzen.

Der bestehende technische Zustand mit dem Entitlement `Premium` wird direkt
durch `Plus` ersetzt. Es wird keine Kompatibilitäts- oder
Bestandskundenmigration für `Premium` benötigt.

### Erfolg aus Nutzersicht

1. In der App sind Plus und AI als getrennte Angebote verständlich.
2. Der Preis kommt aus dem Store-Produkt und wird lokalisiert angezeigt.
3. Ein Kauf oder eine Wiederherstellung aktualisiert den Zugriff ohne Neustart.
4. Plus und AI gelten für den vorgesehenen Haushalt. Der RevenueCat-Account
   bleibt der technische Eigentümer des Kaufs.
5. AI ist für den aktiven Zielhaushalt verfügbar und wird beim Wechsel des
   Zielhaushalts nur innerhalb der monatlichen Wechselregel übertragen.
6. Abgelaufene oder nicht vorhandene Entitlements lassen keine geschützte
   Funktion offen.
7. Der Kaufstatus bleibt bei App-Neustart und kurzzeitiger Offline-Nutzung
   nachvollziehbar, ohne den Server als Autorität zu umgehen.

## 2. Annahmen zur Review

Diese Annahmen sind bewusst sichtbar und müssen vor der Implementierung
bestätigt oder geändert werden:

1. Die acht angelegten Produkte bedeuten vier logische Produkte je Store:
   Plus monatlich, Plus jährlich, AI monatlich und AI jährlich, jeweils für
   iOS und Android.
2. Die genannten Preise sind die dokumentierten EUR-Listenpreise für
   Deutschland: Plus 4,99 EUR monatlich und 44,99 EUR jährlich; AI 8,99 EUR
   monatlich und 74,99 EUR jährlich.
3. Plus und AI sind haushaltsweit. AI kann nur dem aktuell aktiven Haushalt
   zugeordnet werden; eine Änderung des AI-Zielhaushalts ist höchstens einmal
   pro Kalendermonat erlaubt.
4. Ein Nutzer wird weiterhin mit seiner Supabase-User-ID über
   `Purchases.logIn(userId)` identifiziert. Der aktive Haushalt wird über das
   Subscriber-Attribut `household_id` an den Webhook übermittelt.
5. Die geplanten AI-Funktionen sind noch nicht implementiert und es gibt noch
   keine serverseitige AI-Edge-Function. Das Entitlement- und
   Haushaltszuordnungsmodell wird trotzdem vollständig vorbereitet.
6. Entitlement- und Produkt-IDs wurden am 2026-09-01 über den RevenueCat-MCP
   aus Projekt `projca17095c` gelesen. Offering-, Package- und Test-Store-IDs
   wurden anschließend vom Maintainer im RevenueCat-Dashboard konfiguriert und
   bestätigt.

## 3. RevenueCat-Katalog

### 3.1 Entitlements

| Entitlement | RevenueCat-ID | Display Name | Semantik | Zugriffsebene |
| --- | --- | --- | --- | --- |
| `Plus` | `entldf2212f019` | `Fam Plus` | Werbefreie Haushaltsfunktionen und bestehende Premium-Funktionen | Zugeordneter Haushalt |
| `AI` | `entld433af8fd2` | `Fam AI` | Eigenständige AI-Funktionen | Zugeordneter Haushalt |

Ein Plus-Produkt schaltet ausschließlich `Plus` frei. Ein AI-Produkt schaltet
ausschließlich `AI` frei. Ein Account kann beide Produkte unabhängig
voneinander buchen und dadurch beide Entitlements gleichzeitig aktiv haben.

### 3.2 Produkte und Preise

Die Preise dienen der Dashboard-Dokumentation und der Testprüfung. Die App
hardcodiert weder Preise noch Währungen, sondern rendert die Werte des
jeweiligen `StoreProduct`.

| Store | Entitlement | Laufzeit | Preis | Store-Produkt-ID | RevenueCat-Produkt-ID | Aktuelle Dashboard-Zuordnung |
| --- | --- | --- | --- | --- | --- | --- |
| iOS | Plus | monatlich | 4,99 EUR | `fam_plus_monthly` | `proda87c37411f` | `Plus` |
| iOS | Plus | jährlich | 44,99 EUR | `fam_plus_yearly` | `prod6980b20f04` | `Plus` |
| Android | Plus | monatlich | 4,99 EUR | `fam_plus:monthly` | `prod1723eaf4cf` | `Plus` |
| Android | Plus | jährlich | 44,99 EUR | `fam_plus:annual` | `prod206d296a3a` | `Plus` |
| iOS | AI | monatlich | 8,99 EUR | `fam_ai_monthly` | `prod1cfcac7f4a` | `AI` |
| iOS | AI | jährlich | 74,99 EUR | `fam_ai_yearly` | `prodd4781f452e` | `AI` |
| Android | AI | monatlich | 8,99 EUR | `fam_ai:monthly` | `prod3c5664919a` | `AI` |
| Android | AI | jährlich | 74,99 EUR | `fam_ai:annual` | `prod3072767cec` | `AI` |

Der RevenueCat-MCP bestätigt acht aktive Produkte und die oben genannten
Zuordnungen. Die aktuelle Dashboard-Konfiguration entspricht dem unabhängigen
Entitlement-Modell: Plus-Produkte schalten `Plus`, AI-Produkte schalten `AI`.

### 3.3 Offerings

Plus und AI besitzen getrennte Offerings mit identischen Standard-Packages:

| Offering-Identifier | RevenueCat-ID | Package | Package-ID | Inhalt |
| --- | --- | --- | --- | --- |
| `plus` | `ofrng6e21551a24` | `$rc_monthly` | `pkge0058f021a1` | Plus monatlich je Plattform |
| `plus` | `ofrng6e21551a24` | `$rc_annual` | `pkge543c74c2a7` | Plus jährlich je Plattform |
| `ai` | `ofrng3f639281b6` | `$rc_monthly` | `pkgeec7f970cda` | AI monatlich je Plattform |
| `ai` | `ofrng3f639281b6` | `$rc_annual` | `pkge2b7f1877ad` | AI jährlich je Plattform |

Der Client adressiert Offerings über die stabilen Identifier `plus` und `ai`
und Packages über `$rc_monthly` und `$rc_annual`. Die internen `ofrng…`- und
`pkge…`-IDs dienen ausschließlich der Dashboard-Dokumentation und werden nicht
als Runtime-Schlüssel verwendet.

### 3.4 Test Store

| Entitlement | Laufzeit | Produkt-Identifier | RevenueCat-Produkt-ID |
| --- | --- | --- | --- |
| Plus | monatlich | `fam_plus_monthly` | `prod8d122d6184` |
| Plus | jährlich | `fam_plus_yearly` | `prodbe2c3ce5e7` |
| AI | monatlich | `fam_ai_monthly` | `prod5f3f6dfc16` |
| AI | jährlich | `fam_ai_yearly` | `prod807421134b` |

Alle vier Test-Store-Produkte sind dem entsprechenden Entitlement und Package
zugeordnet. Die alten Test-Store-Produkte `fam_premium_monthly` und
`fam_premium_yearly` sind kein Fallback.

Ein separates Bundle-Produkt für „Plus und AI“ ist aktuell nicht vorgesehen.
Falls die Stores eine gleichzeitige Buchung der beiden Abos mit der aktuellen
Produkt- und Subscription-Gruppen-Konfiguration nicht zulassen, wird dafür eine
eigene Bundle-Entscheidung getroffen.

Die Auswahl erfolgt immer zuerst über das Ziel-Entitlement und dessen Offering.
Array-Reihenfolge, Produktname und internes Dashboard-ID-Format sind keine
zulässigen Runtime-Zuordnungen.

## 4. Produktverhalten und Zugriffsmodell

### 4.1 Plus

Plus ersetzt das heutige technische Premium-Konzept für bestehende
haushaltsbezogene Gates, insbesondere die bereits geschützten Funktionen aus
Rezepten, Kochmodus, Meal-Planner und Einkaufsbedarf.

Für Plus gilt:

- Der RevenueCat-Kauf gehört technisch zum kaufenden Account.
- Der serverseitige Webhook schreibt den Plus-Status des dafür verknüpften
  Haushalts.
- Die lokale Haushaltskopie erhält `plus_active`, `plus_expires_at` und
  `plus_updated_at`.
- Alle aktuellen Mitglieder des aktiven Haushalts erhalten denselben
  Plus-Zugriff.
- Die Berechtigung für den Serverzugriff kommt aus der serverseitigen
  Haushaltszeile, nicht aus einem vom Client gesetzten Flag.

Die vorhandenen Premium-Gates werden fachlich auf `Plus` umgestellt. Ein
generisches `isPremium` darf nach der Migration nicht mehr als Ersatz für die
Entitlement-Auswahl dienen.

### 4.2 AI

AI ist ebenfalls haushaltsweit, aber an den RevenueCat-Account des Käufers
gebunden:

- Der Käufer wird mit seinem Supabase-User über `Purchases.logIn(userId)`
  identifiziert.
- Der AI-Zugriff wird dem beim Kauf aktiven Haushalt zugeordnet.
- Ein Wechsel des AI-Zielhaushalts ist höchstens einmal pro Kalendermonat
  zulässig und muss serverseitig durchgesetzt werden.
- Beim Wechsel verliert der alte Haushalt den AI-Zugriff und der neue Haushalt
  erhält ihn. Andere Mitglieder des Zielhaushalts sehen denselben
  haushaltsweiten AI-Status.
- Der Client darf den Status anzeigen, aber die Zuordnung und das monatliche
  Limit nicht selbst autorisieren.
- Es gibt noch keine AI-Fachfunktion. Eine spätere AI-Edge-Function muss die
  haushaltsbezogene Zuordnung zusätzlich serverseitig prüfen.

### 4.2.1 AI-Fair-Use-Limit

Für den ersten AI-Release gilt als Produktvorschlag ein transparentes,
haushaltsweites Kontingent:

- **100 AI-Credits pro zugeordnetem Haushalt und Kalendermonat**.
- Einfache intelligente Vorschläge verbrauchen 1 Credit.
- KI-Rezepte verbrauchen 3 Credits.
- Eine Sprachinteraktion verbraucht 2 Credits.
- Alle Mitglieder des AI-Haushalts teilen dasselbe Kontingent.
- Nicht verbrauchte Credits verfallen am Monatsende und werden nicht
  übertragen.
- Bei 80 Prozent erscheint ein Hinweis mit dem verbleibenden Kontingent und
  dem Reset-Datum.
- Bei 100 Prozent werden neue AI-Generierungen blockiert. Plus-Funktionen
  bleiben vollständig nutzbar.
- Es entstehen niemals automatische Zusatzkosten durch Überschreitung.

Die Credit-Werte sind eine serverseitig konfigurierbare Produktkonstante und
keine im Client manipulierbare Zahl. Das Kontingent folgt der AI-Zuordnung:
Beim erlaubten Wechsel des AI-Zielhaushalts wird das verbleibende Kontingent
übertragen, aber nicht zurückgesetzt. Dadurch kann ein Haushaltswechsel nicht
zum Umgehen des Limits verwendet werden.

Zusätzlich gelten technische Abuse-Grenzen:

- maximal 10 AI-Anfragen pro Haushalt innerhalb von 10 Minuten,
- maximale Eingabe- und Ausgabelänge je AI-Aktion,
- serverseitige Kosten- und Fehlerüberwachung,
- bei auffälligem Missbrauch temporäre Sperre ohne Entzug des Plus-Zugriffs.

Die Nutzung wird haushaltsbezogen aggregiert. Ein späterer AI-Dienst muss
Credits atomar verbuchen, eine doppelte Verbuchung bei Retries verhindern und
den Verbrauch für die berechtigten Haushaltsmitglieder lesbar machen.

### 4.3 Zusammenspiel

Plus und AI sind unabhängig. Die gültigen Zustände sind:

| Plus | AI | Erwarteter Zugriff |
| --- | --- | --- |
| nein | nein | Keine kostenpflichtige Funktion |
| ja | nein | Plus-Funktionen, keine AI-Funktionen |
| nein | ja | AI-Funktionen, keine Plus-Funktionen |
| ja | ja | Plus- und AI-Funktionen |

Der Zustand `Plus = nein, AI = ja` ist zulässig und muss korrekt unterstützt
werden.

## 5. Zielarchitektur und Client

### RevenueCat und Client

- `PREMIUM_ENTITLEMENT_ID` wird durch typisierte Entitlement-IDs für `Plus`
  und `AI` ersetzt. Das alte `Premium` wird nicht als Fallback akzeptiert.
- Die Purchases-Helfer bieten eine gemeinsame Prüfung wie
  `hasEntitlement(customerInfo, entitlementId)` an.
- Die App rendert ihre eigene Paywall-Oberfläche. RevenueCat liefert dafür
  Offerings, Packages, lokalisierte Preise und den Kaufvorgang; RevenueCat
  Paywalls beziehungsweise `RevenueCatUI.presentPaywall*` werden nicht genutzt.
- Die Package-Auswahl lädt `plus` oder `ai` explizit und löst darin
  `$rc_monthly` und `$rc_annual` auf.
- Kauf, Restore, Customer Center, Identitäts-Synchronisierung und
  CustomerInfo-Listener bleiben erhalten.
- Die öffentliche Feature-API liefert getrennte Werte, zum Beispiel
  `hasPlus` und `hasAI`, statt nur `isPremium`.

Beispiel für den gewünschten Stil:

```ts
export type EntitlementId = 'Plus' | 'AI';

export function hasEntitlement(
  customerInfo: CustomerInfo | null,
  entitlementId: EntitlementId,
): boolean {
  return customerInfo?.entitlements.active[entitlementId] !== undefined;
}
```

Die konkrete Benennung des Providers darf die bestehende Feature-Struktur
berücksichtigen. Ein großer Ordnerumbau von `src/features/premium/` ist nicht
erforderlich, solange die fachliche API nicht mehr Premium und AI vermischt.

### Datenbank und lokaler Mirror

Der Haushaltsstatus wird für beide Zugriffsstufen ausdrücklich getrennt
modelliert:

| Zugriff | Felder auf `households` |
| --- | --- |
| Plus | `plus_active`, `plus_expires_at`, `plus_updated_at` |
| AI-Projektion | `ai_active`, `ai_expires_at`, `ai_updated_at`, `ai_subscriber_id` |

Die kanonische AI-Zuordnung liegt in einem abonnentenbezogenen Assignment-State
mit `subscriber_user_id`, `entitlement`, `household_id` und
`household_changed_at`. Die `ai_*`-Werte auf `households` sind die
haushaltsweite Projektion für alle Mitglieder. `household_changed_at` muss am
Subscriber gespeichert werden, damit der Monatswechsel nicht durch einen
Wechsel über mehrere Haushalte umgangen werden kann. Der Wechsel erfolgt
atomar über eine autorisierte RPC oder eine gleichwertige serverseitige
Operation, damit alter und neuer Haushalt nie gleichzeitig als Zielstatus
geführt werden.

Dafür gelten die Projektregeln:

- Der direkte Ersatz von `premium_*` durch `plus_*` ist keine
  Bestandskundenmigration. Es gibt keine Legacy-Kompatibilität für
  `Premium`.
- Änderung zuerst in `supabase/schemas/*.sql`.
- Falls sich das deklarative Schema ändert, Migration ausschließlich über
  `bun run db:diff -- -f <feature_name>`.
- Keine manuell geschriebenen oder editierten Migrationen.
- Lokales SQLite-Schema, Mirror-Schreibpfad, Pull/Push-Typen und
  `database.types.ts` synchron aktualisieren.
- Der AI-Status wird haushaltsweit gespiegelt, nicht in einem persönlichen
  Tracking-Datensatz abgelegt.

Die AI-Haushaltszuordnung ist kein normales Client-Update. Der
abonnentenbezogene Assignment-State erhält eine eigene RLS-geschützte
serverseitige Schreiblogik. Die RPC oder Edge-Function muss prüfen:

- der Aufrufer ist Mitglied des Zielhaushalts,
- der RevenueCat-Account besitzt ein aktives AI-Entitlement,
- seit `household_changed_at` ist mindestens ein neuer Kalendermonat
  begonnen,
- der Wechsel deaktiviert den alten AI-Haushalt und aktiviert den neuen
  atomar.

Die konkrete RPC-Form und die dazugehörigen RLS-Policies werden in der
technischen Planung festgelegt.

### Webhook

Der bestehende Webhook wird auf die beiden Entitlements umgestellt:

- Plus-Produkte aktivieren und expirieren den verknüpften Plus-Haushalt.
- AI-Produkte aktivieren und expirieren ausschließlich den AI-Status.
- AI-Aktivierung erfolgt nur für den bei der Zuordnung hinterlegten aktiven
  Haushalt.
- Eine AI-Expiration darf einen weiterhin aktiven Plus-Status nicht entziehen.
- Ereignisse ohne `Plus` oder `AI` werden ignoriert.
- Entitlements werden ausschließlich über eine Allowlist verarbeitet.
- Wiederholte Zustellung desselben Events bleibt idempotent.
- Ältere Ereignisse dürfen einen neueren Status nicht zurücksetzen.
- `authenticated` kann die Entitlement-Felder nicht selbst ändern; der
  Webhook schreibt mit `service_role`.
- Ein weiterer Kauf für ein bereits aktives Entitlement wird in der App nicht
  angeboten. Ein aktives Plus-Entitlement blockiert den AI-Kauf nicht und ein
  aktives AI-Entitlement blockiert den Plus-Kauf nicht.
- Der Webhook muss mehrere Accounts und veraltete Events so behandeln, dass
  eine einzelne Expiration keinen weiterhin gültigen Haushaltszugriff löscht.

Für denselben Haushalt und dasselbe Entitlement gibt es im Produktmodell
höchstens eine aktive Zuordnung. Ein bestehender Plus-Status blockiert einen
zweiten Plus-Kauf; ein bestehender AI-Status blockiert einen zweiten AI-Kauf.
Beide Status können gleichzeitig aktiv sein. Ein Upgrade- oder Bundle-Flow
bleibt eine spätere Produkt- und Store-Entscheidung.

## 6. Nutzerflüsse

### Plus kaufen

1. Nutzer öffnet den Plus-Bereich oder löst eine Plus-gesperrte Aktion aus.
2. Die App lädt das Plus-Offering und zeigt Monats- und Jahrespaket mit den
   lokalisierten Store-Preisen.
3. Die App startet den RevenueCat-Kauf.
4. `CustomerInfo` wird aktualisiert und der Webhook synchronisiert den
   Haushalt.
5. Nach erfolgreichem Kauf wird die ursprünglich gesperrte Aktion erneut
   bewertet.

### AI kaufen und Haushalt zuordnen

Der Ablauf verwendet ausschließlich das AI-Offering:

1. Der Nutzer kauft AI aus dem aktuell aktiven Haushalt heraus.
2. Das Produkt aktiviert in RevenueCat ausschließlich `AI`.
3. Der aktive Haushalt erhält den AI-Status.
4. Ein Wechsel des AI-Zielhaushalts ist erst im nächsten Kalendermonat über
   die dafür vorgesehene serverautorisierte Aktion möglich.

### Wiederherstellen und Verwalten

- `Käufe wiederherstellen` ruft RevenueCat Restore auf und aktualisiert beide
  Entitlements.
- `Abo verwalten` öffnet den RevenueCat Customer Center.
- Bereits aktive Entitlements zeigen keinen irreführenden Kauf-CTA. Bei
  aktivem Plus bleibt der AI-CTA möglich, bei aktivem AI bleibt der Plus-CTA
  möglich. Wenn beide aktiv sind, werden keine weiteren Käufe dieser Tiers
  angeboten.
- Ein Kaufabbruch ist kein Fehlerzustand und führt zu keiner Freischaltung.
- Fehlende Store-Konfiguration wird verständlich angezeigt und darf nicht als
  aktives Entitlement behandelt werden.

## 7. Offline- und Identitätsverhalten

- RevenueCat darf den zuletzt bekannten `CustomerInfo`-Stand aus seinem Cache
  verwenden.
- Plus-Gates berücksichtigen den lokal synchronisierten
  `households.plus_active`-Stand.
- AI-Gates berücksichtigen den lokal synchronisierten
  `households.ai_active`-Stand und die serverseitige Zuordnung des
  RevenueCat-Accounts.
- Ein Wechsel des AI-Zielhaushalts benötigt eine Online-Verbindung. Offline
  bleibt der zuletzt synchronisierte Zustand sichtbar, aber ein neuer Wechsel
  wird nicht freigeschaltet.
- Ohne bekannten aktiven Status bleibt die Funktion gesperrt.
- Beim Account-Wechsel wird die RevenueCat-Identität gewechselt und der
  private Status des vorherigen Accounts nicht weiterverwendet.
- Der Dev-Override bleibt ein lokales Testwerkzeug und ist keine
  Produktionsautorisierung.

## 8. Analytics und Fehlerverhalten

Die bestehende Telemetrie wird um das Ziel-Entitlement ergänzt, damit Plus und
AI getrennt ausgewertet werden können:

- Paywall geöffnet: `entitlement: 'Plus' | 'AI'`
- Kauf erfolgreich, abgebrochen oder fehlgeschlagen
- Restore erfolgreich oder fehlgeschlagen
- Entitlement-Status nach `CustomerInfo`-Update

Keine Store-Belege, Zahlungsdaten oder privaten AI-Inhalte werden in
Analytics-Events geschrieben.

Fehlerregeln:

- RevenueCat-Fehler werden für Nutzer verständlich dargestellt.
- Signaturfehler bei Entitlement-Daten führen nicht zu einer neuen
  Freischaltung.
- Webhook-Fehler erzeugen einen sichtbaren Retry-Zustand in der
  RevenueCat-Zustellhistorie und überschreiben keinen gültigen Status mit
  einem geratenen Wert.

## 9. Project Structure

Die bestehende Feature-first-Struktur bleibt erhalten:

```text
src/lib/purchases.ts                         # RevenueCat-Initialisierung und primitives API
src/lib/purchases.test.ts                    # Entitlement- und Kauf-Helfer
src/features/premium/                        # Paywall- und Zugriffsoberfläche
src/features/premium/paywall.ts              # Navigation zur eigenen Paywall und Customer Center
src/features/premium/paywall-plans.ts        # Plus-/AI-Package-Auswahl und Preisformatierung
src/features/premium/premium-provider.tsx    # getrennte Plus-/AI-Statuswerte und Zielhaushalt
src/features/premium/*.test.tsx              # zielbezogene UI-Tests
supabase/schemas/03_households.sql            # plus_* statt premium_*
supabase/functions/revenuecat-webhook/        # Plus-Allowlist und AI-Isolation
supabase/tests/                               # RLS-/Webhook-nahe Datenbanktests bei Schemaänderung
docs/revenuecat/                              # Betriebs- und Store-Testdokumentation
```

Die sichtbare Route wird von `/settings/premium` auf
`/settings/plus-and-ai` umbenannt. Der technische Feature-Ordner darf
`src/features/premium/` zunächst behalten, sofern dadurch kein
sichtbarer Premium-Begriff verbleibt.

## 10. Commands

Für die spätere Implementierung gelten diese gezielten Checks:

```bash
bun run check
bun run typecheck
bun run test -- purchases
bun run test -- premium
```

Falls die Haushaltsfelder oder RLS/Privileges geändert werden:

```bash
bun run db:diff -- -f revenuecat-entitlements
bun run test:db
bun run db:advisors
bun run db:diff
bun run db:types
```

Es wird kein `bun test` und keine vollständige ungezielte Testsuite verwendet.

## 11. Testing Strategy

### Unit-Tests

- Entitlement-Prüfung für `Plus`, `AI`, fehlende Entitlements und leere
  `CustomerInfo`.
- Verifikationsfehler dürfen keine neue Freischaltung erzeugen.
- Package-Auswahl unterscheidet Plus monatlich/jährlich von AI
  monatlich/jährlich.
- Preise und Währungen kommen aus den RevenueCat-Produkten; Fallbacks sind
  nur für den leeren Ladezustand erlaubt.
- Ersparnisberechnung wird für Plus und AI unabhängig geprüft.

### React-Native-Tests

- Plus-Paywall zeigt nur Plus-Produkte und Plus-CTA.
- AI-Paywall zeigt nur AI-Produkte und AI-CTA.
- Aktiver Plus-Status sperrt keinen AI-Kauf und umgekehrt.
- Kaufabbruch, Restore, Fehler und fehlende Konfiguration haben den korrekten
  UI-Zustand.
- Bestehende Plus-Gates öffnen die Plus-Paywall.

### Webhook- und Datenbanktests

- `Plus`-Aktivierung und `Plus`-Expiration aktualisieren nur den Haushalt.
- AI-Aktivierung und AI-Expiration aktualisieren den zugeordneten Haushalt.
- Fremde Nutzer oder Haushalte können den Plus- oder AI-Status nicht über RLS
  ändern.
- Wiederholte und veraltete Events erzeugen keinen falschen Endzustand.
- Bei geänderter Datenbank laufen die zugehörigen pgTAP-Tests und der
  lokale-SQLite-Mirror-Test.

### Manuelle Store-Prüfung

- RevenueCat Test Store in einem Development Build auf iOS und Android.
- iOS Sandbox/TestFlight mit lokalisiertem Storefront.
- Android-Testkauf mit Monats- und Jahresprodukt.
- Kauf, Restore, Ablauf und Customer Center für beide Entitlements.
- Verifikation im RevenueCat-Dashboard und in der Webhook-Zustellhistorie.

Test Store API-Keys dürfen niemals in TestFlight- oder Production-Builds
verwendet werden.

## 12. Boundaries

### Immer tun

- Entitlement-IDs und Package-Zuordnung aus einer zentralen, typisierten
  Konfiguration verwenden.
- Store-Preise dynamisch und lokalisiert aus RevenueCat anzeigen.
- Plus und AI in jeder Gate- und Analytics-Entscheidung getrennt behandeln.
- Serverautorität für haushaltsbezogenen Zugriff und spätere AI-Serverzugriffe
  erhalten.
- RLS, Service-Role-Schreibschutz und Offline-Mirror-Parität bewahren.
- Dashboard- und Webhook-Zustände gegen den tatsächlichen Endzustand prüfen.

### Vorher fragen

- Ob Testzeiträume, Promo-Angebote oder länderspezifische Preisvarianten Teil
  des ersten Releases sind.
- Welche der offenen AI-Limit-, Werbung-, Paywall- und Kostenfragen aus
  Abschnitt 14 in diesem Release umgesetzt werden.

### Nie tun

- Keine Preise oder Währungen als Autorisierung oder dauerhafte UI-Wahrheit
  hardcodieren.
- Nicht anhand von Produkt-ID, Package-Reihenfolge oder Kaufhistorie statt
  Entitlement autorisieren.
- AI niemals außerhalb des zugeordneten Haushalts teilen.
- Keine Client-Flags als serverseitigen Zahlungsnachweis akzeptieren.
- Keine RevenueCat-Test-Store-Keys in Release-Builds ausliefern.
- Keine manuellen Supabase-Migrationen oder Einweg-SQL-Anwendungen erstellen.

## 13. Success Criteria

- [x] Zwei Entitlements heißen im produktiven RevenueCat-Projekt exakt `Plus`
      und `AI`.
- [x] Die vier Plus-Produkte schalten nur `Plus` frei.
- [x] Die vier AI-Produkte schalten nur `AI` frei.
- [x] Acht Produkte sind vorhanden: je Zugriffsstufe, Laufzeit und Plattform
      korrekt angelegt und zugeordnet.
- [x] Plus und AI haben jeweils ein eindeutig auflösbares Monats- und
      Jahresangebot.
- [ ] Die App kann auf iOS und Android beide Offerings laden und die vier
      logischen Planvarianten korrekt darstellen.
- [ ] Plus- und AI-Gates sind unabhängig und durch fokussierte Tests belegt.
- [ ] Ein Account kann Plus allein, AI allein oder beide Entitlements
      gleichzeitig besitzen.
- [ ] Der Kauf- und Restore-Flow aktualisiert `CustomerInfo` und die UI ohne
      App-Neustart.
- [ ] Der Webhook verarbeitet Plus und AI korrekt, ignoriert fremde
      Entitlements und schützt vor Wiederholungs- bzw. Reihenfolgefehlern.
- [ ] Der AI-Status ist für alle Mitglieder des zugeordneten Haushalts
      verfügbar.
- [ ] Ein AI-Haushaltswechsel ist serverseitig auf einmal pro Kalendermonat
      begrenzt.
- [ ] Das AI-Fair-Use-Limit gilt haushaltsweit mit 100 Credits pro
      Kalendermonat, 80-Prozent-Warnung und Sperre bei 100 Prozent.
- [ ] Ein AI-Limit-Block sperrt nur neue AI-Generierungen, nicht den Plus-
      Zugriff.
- [ ] Der Haushaltsstatus ist serverautoritativ, RLS-geschützt und im lokalen
      Mirror synchron.
- [ ] Keine bestehende Premium-Funktion wird versehentlich durch AI oder durch
      ein fehlendes Offering freigeschaltet.
- [ ] Die gezielten Checks aus Abschnitt 10 sind grün.

## 14. Open Questions und Brainstorming

Die folgenden Punkte bleiben aus dem Brainstorming in Epic #23 offen:

1. Sind die vorgeschlagenen 100 AI-Credits pro Haushalt und Monat sowie die
   Gewichtung 1/3/2 korrekt?
2. Welche Werbung sieht der Free-Tier? Sie darf niemals in privaten
   Tracking-Bereichen erscheinen. ATT und Consent auf iOS müssen festgelegt
   werden.
3. Soll Plus der Standard-CTA sein, AI als "Best Value" erscheinen, gibt es
   eine Testphase und wie wird die Jahresersparnis dargestellt?
4. Lassen die aktuellen Store- und Subscription-Gruppen-Konfigurationen eine
   gleichzeitige Buchung von Plus und AI zu, oder brauchen wir später ein
   Bundle-Produkt?
5. Welche Analytics-Kennzahlen werden für Paywall, Conversion, Kündigung,
   Werbung, AI-Nutzung und AI-Kosten benötigt?

Bereits entschieden:

- Plus und AI gelten haushaltsweit, aber nur im jeweils zugeordneten aktiven
  Haushalt.
- Ein aktives Entitlement blockiert einen weiteren Kauf desselben
  Entitlements. Plus und AI können unabhängig voneinander oder gleichzeitig
  aktiv sein.
- Produkt- und Offering-IDs werden aus RevenueCat gezogen.
- Es gibt keine Kompatibilitätsmigration vom alten `Premium`.
- Die geplanten AI-Funktionen sind noch nicht implementiert.
- Die sichtbare Route wird `/settings/plus-and-ai`.

## 15. Review Gate

Diese Datei ist für die technische Planung freigegeben. Die bereits
festgelegten Punkte gelten als fachliche Vorgabe. Die offenen Fragen aus
Abschnitt 14 blockieren nur die jeweils betroffenen Release-Slices, zum
Beispiel AI-Fair-Use-UI, Werbung oder Upgrade-Darstellung. Die Umsetzung
erfolgt anschließend in kleinen, testbaren Scheiben.
