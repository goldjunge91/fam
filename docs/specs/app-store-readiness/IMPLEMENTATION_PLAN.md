# Implementation Plan: App-Store-Readiness

Status: Entwurf, Review erforderlich
Stand: 2026-09-02
Quelle: CAPABILITY_MAP.md und der vorherige App-Store-Compliance-Audit

## Ziel

Die iOS-App soll einen vollständig prüfbaren Pfad von der
Datenschutzinformation bis zur App-Store-Einreichung erhalten. Der Plan schließt
Compliance-Lücken des aktuellen Builds und beschreibt keine neuen
Produktfunktionen.

Der Scope gilt für eine allgemeine Haushalts-App für erwachsene Nutzer.

## Leitentscheidungen

- Apple-IAP bleibt der einzige Kaufweg für digitale Premium-Funktionen.
- Private Tracking-, Medikamenten-, Gewichts- und Vitaldaten bleiben strikt von
  Werbung und Haushaltsdaten getrennt.
- Datenschutz-Copy, Privacy Manifest und App-Privacy-Angaben werden aus einem
  geprüften Dateninventar abgeleitet.
- Account-Löschung wird als Ende der Identität behandelt: lokales Konto,
  Backend-Daten und verbundene Anbieter müssen einen definierten Endzustand
  erreichen.
- Jede Capability endet mit einem manuellen Review-Szenario auf einem finalen
  iOS-Build.
- Keine Datenbankmigration wird manuell erstellt. Bei Datenmodelländerungen ist
  ausschließlich das deklarative Supabase-Schema die Quelle.

## Abnahmekriterien für die Gesamtinitiative

Die Initiative ist erst abgenommen, wenn:

- Datenschutz- und Support-URLs öffentlich erreichbar, stabil und in App Store
  Connect eingetragen sind.
- Datenschutztext, App-Privacy-Angaben, Privacy Manifest und tatsächliches
  SDK-Verhalten konsistent sind.
- Konto und zugehörige personenbezogene Daten über einen auffindbaren In-App-
  Flow gelöscht werden können.
- Apple-Login-Tokens, RevenueCat-Identität und lokale Kontodaten nach Löschung
  keinen verwaisten Personenbezug hinterlassen.
- Paywall und Store-Produkte Preis, Laufzeit, automatische Verlängerung,
  Kündigung, Restore, Terms und Privacy verständlich erklären.
- Analytics, Crash Reporting, ATT, UMP und Ads nur im zulässigen Einwilligungs-
  und Zweckrahmen aktiv werden.
- Gesundheits-, Medikamenten-, Gewichts- und Vitaldaten weder für
  zielgerichtete Werbung noch für Marketingprofile verwendet werden.
- Nicht benötigte iOS-Berechtigungen entfernt oder fachlich begründet sind.
- Altersfreigabe, Screenshots, Review Notes, Demo-Zugang, Backend und IAP mit
  dem eingereichten Build funktionieren.

## Phasen und Aufgaben

### Phase -1: Qualitätsbar und Constraints

**Task:** fam-qai.3.14 — App-Store-Qualitätsbar und Constraints festlegen  
**Abhängigkeiten:** keine

**Ziel:** Vor der Umsetzung festlegen, welche technischen Qualitätsgates
blockieren, welche nur warnen und welche messbaren Grenzen für die Initiative
gelten. Die Entscheidung wird in CONSTRAINTS.md dokumentiert und aus
AGENTS.md/CLAUDE.md referenziert.

**Akzeptanz:**

- Die vier Constraint-Entscheidungen sind mit dem Maintainer geklärt.
- Floor, begründete Zahlen, Prüfkommandos, Ausführungsstufe und Ausnahmen mit
  Owner/Expiry sind dokumentiert.
- Keine Prüfung wird zum Erreichen des grünen Zustands abgesenkt.

**Prüfung:** Constraint-Review und Trial Run der vorhandenen Gates.

**Umfang:** S

### Phase 0: Entscheidungen und Compliance-Inventar

**Task:** fam-qai.3.1 — App-Store-Compliance-Inventar und offene Entscheidungen
festlegen  
**Abhängigkeiten:** fam-qai.3.14

Ziel: Rechts- und Produktentscheidungen schließen, bevor technische Verträge
geändert werden.

Arbeitspakete:

1. Datenschutzinventar aus App-Code, Supabase, RevenueCat, AdMob, Sentry,
   PostHog, Aptabase und Open Food Facts erstellen.
2. Für jede Datenkategorie Zweck, Empfänger, Aufbewahrung, Löschung,
   Verknüpfung und Trackingstatus festlegen.
3. Betreibername, Datenschutz-URL, Support-URL, Löschkontakt und
   Storefront-Kontaktdaten festlegen.
4. Entscheidung für nutzererstellte gemeinsame Inhalte dokumentieren:
   löschen, anonymisieren oder nachvollziehbar auf den Haushalt übertragen.

Akzeptanz:

- Jede deklarierte Datenkategorie ist einer konkreten Code- oder Dienststelle
  zugeordnet.
- Alle offenen rechtlichen Entscheidungen haben einen Owner und eine bestätigte
  Entscheidung.
- Keine Platzhalter-URL verbleibt im geplanten Einreichungspfad.

Prüfung: Review der Inventartabelle und der Lösch-/Aufbewahrungsentscheidungen
durch Maintainer und rechtlich verantwortliche Person.

Voraussichtliche Artefakte:

- docs/architecture/DATENSCHUTZ.md
- docs/architecture/PRIVACY_LABELS.md
- docs/app-store/APP_STORE_METADATA_DRAFT.md
- neuer Dateninventar-/Entscheidungsabschnitt im Spec-Bereich

Umfang: M

### Phase 1: privacy-disclosure

Abhängigkeiten: Phase 0

Ziel: Eine konsistente, öffentlich erreichbare und in der App auffindbare
Datenschutzkommunikation herstellen.

Akzeptanz:

- Datenschutz- und Support-Links sind in den Einstellungen ohne Login
  erreichbar.
- Die öffentliche Erklärung deckt Daten, Zwecke, Drittanbieter, Löschung,
  Aufbewahrung, Tracking/ATT und Gesundheitsdaten ab.
- App-Privacy-Fragebogen und Privacy Manifest sind gegen das Inventar geprüft.
- Alle URLs werden im Review-Build und als öffentliche HTTP(S)-Ziele geprüft.

Prüfung: Linkprüfung ohne Authentifizierung, manuelles Einstellungs-Szenario,
Abgleich der Datenschutzquellen und fokussierter iOS-Archive-Check.

Voraussichtliche Dateien:

- src/features/settings/privacy-screen.tsx
- src/features/settings/settings-screen.tsx
- docs/architecture/DATENSCHUTZ.md
- docs/architecture/PRIVACY_LABELS.md
- app.json
- ios/fam/PrivacyInfo.xcprivacy
- Store-Privacy- und URL-Konfiguration

Umfang: M

### Phase 2: account-deletion

Abhängigkeiten: Phase 1

Ziel: Apple-konforme Löschung der Identität und aller zugehörigen
personenbezogenen Daten über einen verständlichen In-App-Flow.

Akzeptanz:

- Nutzer finden die Löschung in den Einstellungen und können sie ohne
  Supportkontakt starten.
- Backend, lokale SQLite-/Outbox-Daten, Account-Storage und Auth-Identität
  erreichen einen definierten gelöschten Zustand.
- Sign in with Apple-Tokens werden widerrufen.
- RevenueCat-/Provider-Daten und Identitätsattribute werden nach Löschung
  nicht weiter als aktive Nutzeridentität geführt.
- Gemeinsame Inhalte folgen der Entscheidung aus Phase 0; der Endzustand ist in
  UI, Datenschutztext und Backend nachvollziehbar.
- Laufende Abos werden vor der Löschung erklärt und bleiben über Apple
  verwaltbar bzw. kündbar.

Prüfung: fokussierte Tests für Edge Function, Auth-Provider, lokale Bereinigung
und Haushaltsrollen; Testkonto-Löschung im Review-Szenario; Nachweis, dass ein
erneuter Login kein gelöschtes Konto reaktiviert.

Voraussichtliche Dateien:

- src/features/settings/delete-account-screen.tsx
- src/features/auth/provider-auth.ts
- src/features/auth/sign-out.ts
- src/features/premium/premium-provider.tsx
- supabase/functions/delete-account/index.ts
- relevante deklarative Supabase-Schemas und fokussierte Tests

Umfang: L; vor Implementierung in Auth-, Billing- und Datenlösch-Slices
aufteilen.

### Checkpoint A: Datenschutz und Identität

- Phase 0 bis 2 sind durch Maintainer-Review freigegeben.
- Öffentliche URLs und Löschflow funktionieren auf einem Testgerät.
- Datenschutzinventar, UI-Copy und Backend-Endzustände sind konsistent.
- Erst danach beginnen Billing-, Consent- und Berechtigungsänderungen.

### Phase 3: subscription-compliance

Abhängigkeiten: Phase 1; Phase 0 für Produkt- und Betreiberangaben

Ziel: Premium-Kauf und laufende Verwaltung transparent und Apple-konform
darstellen.

Akzeptanz:

- Jeder digitale Premium-Zugriff nutzt Apple IAP über die bestehende
  RevenueCat-Integration.
- Die Paywall zeigt vor dem Kauf Produktname, Preis, Abrechnungsintervall,
  automatische Verlängerung, Kündigungsweg, Terms, Privacy und Restore.
- Aktive Nutzer erreichen die Aboverwaltung; Restore ist auch ohne aktives
  Entitlement testbar.
- App-Copy, RevenueCat-Angebote, Produkt-IDs und Store-Metadaten stimmen
  überein; Test- und Produktionskonfigurationen sind getrennt.

Prüfung: StoreKit-Sandbox-/TestFlight-Szenarien für Erstkauf, Abbruch, Restore,
Ablauf, aktives Abo und Aboverwaltung; manueller Paywall-Review vor dem Kauf.

Voraussichtliche Dateien:

- src/features/premium/paywall-sheet.tsx
- src/features/premium/premium-screen.tsx
- src/features/premium/use-paywall.ts
- src/lib/purchases.ts
- RevenueCat-Produktkonfiguration
- App-Store-Produktmetadaten

Umfang: M

### Phase 4: consent-and-ads

Abhängigkeiten: Phase 1

Ziel: Telemetrie, ATT, UMP und Anzeigen nach Zweck und Einwilligung begrenzen.

Akzeptanz:

- Nicht notwendige Analytics- und Crash-Datenerfassung startet nicht vor der
  dafür erforderlichen Einwilligung.
- ATT und Google UMP werden nachvollziehbar sequenziert; Einstellungen können
  später erneut geändert werden.
- Gesundheits-, Medikamenten-, Gewichts- und Vitaldaten gelangen nicht in
  Werbeprofile, Targeting oder Marketingevents.
- Anzeigen besitzen einen auffindbaren Meldeweg für unangemessene Inhalte und
  interstitielle Anzeigen sind offensichtlich dismissible.

Prüfung: First-launch-Matrix mit Ablehnen, Zustimmen und späterer Änderung;
Netzwerk-/Event-Instrumentierung in Debug-Builds; Test der Ad-Report-Übergabe;
Prüfung der SDK-Initialisierungsreihenfolge.

Voraussichtliche Dateien:

- src/features/app-shell/initialize-app-runtime.ts
- src/lib/posthog.tsx
- src/lib/sentry.ts
- src/lib/analytics/aptabase/aptabase.ts
- src/features/ads/ads-consent.ts
- src/features/ads/
- app.json
- ios/fam/Info.plist

Umfang: L; vor Implementierung in Consent-, Telemetrie- und Ad-Reporting-Slices
aufteilen.

### Phase 5: permissions-and-health-disclosure

Abhängigkeiten: Phase 1 und Phase 4

Ziel: Berechtigungen auf den tatsächlichen Funktionsbedarf reduzieren und
gesundheitsbezogene Funktionen sicher kommunizieren.

Akzeptanz:

- Kamera, Fotos, Standort und Benachrichtigungen werden nur beim konkreten
  Bedarf und mit präziser Zweckbeschreibung angefragt.
- Mikrofon, Motion und Always-Location sind entfernt, sofern kein geprüfter
  Produktpfad sie benötigt.
- Tracking-, GLP-1-, Medikamenten- und Vitalfunktionen erklären klar, dass sie
  keine Diagnose oder individuelle medizinische Entscheidung ersetzen.
- Marketingtexte und Screenshots versprechen keine medizinische Genauigkeit,
  Behandlung oder Überwachung, die der Build nicht zuverlässig leistet.

Prüfung: Berechtigungs-Matrix auf frischer Installation; Ablehnen-/Später-
Szenarien; manueller Review der Gesundheits-Copy und Screenshots; Privacy-
Manifest-/Info.plist-Abgleich.

Voraussichtliche Dateien:

- app.json
- ios/fam/Info.plist
- src/features/onboarding/components/permissions-step.tsx
- src/features/glp1/
- src/features/calorie-tracking/
- relevante Store-Copy und Review Notes

Umfang: M

### Checkpoint B: Kauf, Einwilligung und sensible Daten

- Paywall, Restore und Aboverwaltung bestehen die Sandbox-Szenarien.
- First-launch-Consent und spätere Consent-Änderung sind reproduzierbar.
- Keine geprüfte Telemetrie enthält sensible Gesundheitswerte.
- Berechtigungsdialoge erklären jeweils einen konkreten Zweck.

### Phase 6: review-submission

Abhängigkeiten: alle vorherigen Phasen

Ziel: Einreichungsartefakte und Review-Zugang aus einem finalen Build
reproduzierbar vorbereiten.

Akzeptanz:

- Altersfreigabe-Fragebogen ist vollständig und konsistent mit Funktionen,
  Werbung und Gesundheitsinhalten beantwortet.
- App-Name, Untertitel, Beschreibung, Keywords, URLs, Preise und Screenshots
  entsprechen dem finalen Build.
- Screenshots stammen aus einer finalen TestFlight-Version und enthalten nur
  fiktive Testdaten.
- Review Notes enthalten Testzugang, IAP-/Restore-Schritte,
  Berechtigungsflüsse, Account-Löschung, Offline-Verhalten und bekannte
  Einschränkungen.
- Backend, Auth, Edge Functions, RevenueCat und öffentliche URLs sind während
  der Review erreichbar.

Prüfung: finale TestFlight-Smoke-Session auf unterstütztem iPhone; Installieren,
Erststart, Account, Haushalt, Premium, Löschung, Offline-Wiederanlauf und
Linkprüfung; anschließender App-Store-Connect-Check.

Voraussichtliche Artefakte:

- docs/app-store/APP_STORE_METADATA_DRAFT.md
- App-Store-Connect-Metadaten
- finale Screenshots
- Review Notes und Demo-Zugang
- eas.json
- finaler iOS-Archive-/TestFlight-Build

Umfang: M

## Verifikation und Qualitätsgates

Nach jeder technischen Phase:

- fokussierte Tests für die geänderte Domäne mit bun run test <file>;
- bun run typecheck;
- bun run check;
- manueller iOS-Flow, wenn native Berechtigungen, IAP oder App-Start betroffen
  sind;
- git diff --check.

Vor der Einreichung:

- bun run check;
- bun run typecheck;
- fokussierte Jest- und DB-Tests, sofern Backend-/Schema-Code betroffen ist;
- finaler EAS-/TestFlight-Build;
- manuelle Review-Matrix für Datenschutz, Löschung, Kauf, Consent,
  Berechtigungen und Offline-Zustände.

bun test wird nicht verwendet. Supabase wird für diese Planung nicht gestartet
oder gestoppt.

## Abhängigkeiten und Parallelisierung

Nach Phase 1 können Account-Löschung, Subscription-Compliance und
Consent-and-Ads grundsätzlich parallel spezifiziert werden. Die Umsetzung von
Account-Löschung und Consent sollte wegen gemeinsamer Identitäts- und
Initialisierungslogik koordiniert erfolgen. Die finale Review-Submission bleibt
sequenziell am Ende.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| Shared-Content-Löschregel bleibt unentschieden | Account-Löschung und Datenschutztext sind nicht abnahmefähig | Entscheidung in Phase 0 erzwingen; Verhalten und UI gemeinsam spezifizieren |
| SDKs senden Daten vor Consent | Apple-/Datenschutzverstoß trotz korrekter UI | Initialisierungsreihenfolge instrumentieren und mit frischer Installation prüfen |
| Store- und RevenueCat-Produkte weichen ab | Review- oder Kaufablehnung | Produktmatrix als versioniertes Artefakt vor Sandbox-Test abgleichen |
| Native Berechtigungen sind breiter als der Produktpfad | unnötige Privacy-Fragen und Ablehnungsrisiko | Berechtigungs-Matrix aus realen Einstiegspunkten ableiten |
| Öffentliche URLs sind nicht dauerhaft erreichbar | App-Store-Metadaten nicht abnahmefähig | URLs vor Build und erneut aus Review-Kontext ohne Login prüfen |
| Beads-Projekt-ID bleibt inkonsistent | Aufgabenstatus ist nicht zuverlässig nachverfolgbar | Tracker vor Implementierungsstart reparieren; keine Statusannahmen aus Markdown ableiten |

## Offene Entscheidungen vor Implementierung

1. Welche Regel gilt für nutzererstellte gemeinsame Rezepte, Bestände und
   Einkaufslisten bei Account-Löschung?
2. Welche öffentliche Datenschutz- und Support-Domain wird verwendet?
3. Wird nicht notwendige Analytics standardmäßig bis zur Einwilligung
   deaktiviert? Empfohlene Annahme: ja.
4. Welche rechtlich verantwortliche Person gibt Gesundheits-Copy und
   Datenschutztext frei?

## Task-Tracking

Die Umsetzungstasks sind als einzelne Beads-Issues unter fam-qai.3 angelegt.
Acceptance Criteria, TDD-Hinweise, betroffene Dateien und Verifikation stehen
im jeweiligen Issue. Die Reihenfolge ist:

1. fam-qai.3.14 — Qualitätsbar und Constraints
2. fam-qai.3.1 — Compliance-Inventar und offene Entscheidungen
3. fam-qai.3.2 — öffentliche Datenschutz- und Support-Links
4. fam-qai.3.3 — App Privacy und Privacy Manifest
5. fam-qai.3.4 — Account-Deletion-Vertrag und Datenlöschmatrix
6. fam-qai.3.5 — Apple-Login-Token und Drittanbieter-Identität
7. fam-qai.3.6 — lokale und serverseitige Account-Löschung
8. fam-qai.3.7 — Subscription-Paywall und Apple-IAP-Hinweise
9. fam-qai.3.8 — Analytics- und Crash-Consent-Gate
10. fam-qai.3.9 — ATT, UMP und Anzeigen-Meldeweg
11. fam-qai.3.10 — native Berechtigungen und Gesundheits-Copy
12. fam-qai.3.12 — Checkpoint Datenschutz und Identität
13. fam-qai.3.13 — Checkpoint Kauf, Einwilligung und sensible Daten
14. fam-qai.3.11 — finale Apple-Review-Matrix und Submission-Artefakte

tasks/plan.md bleibt dem bestehenden fam-Agent-Skills-Vorhaben vorbehalten.

## Referenzen

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)
