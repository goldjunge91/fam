# Capability Map: App-Store-Readiness

**Status:** Review erforderlich (Phase 0)  
**Version:** 0.1  
**Stand:** 2026-09-01  
**Quelle:** statischer Compliance-Audit des aktuellen iOS-Stands und offizielle Apple-App-Review-Anforderungen

## Ziel

Diese Initiative beschreibt die Anforderungen, die vor einer ersten iOS-
Einreichung erfüllt und nachweisbar geprüft sein müssen. Sie ersetzt keine
Rechtsberatung und nimmt keine Änderungen an App, Backend oder Store-Daten vor.

Der aktuelle Audit-Befund ist **No-Go für die erste Einreichung**, insbesondere
wegen Platzhalter-URLs und unvollständiger Nachweise für Datenschutz,
Account-Löschung, Abonnements, Werbung/Tracking und gesundheitsbezogene
Funktionen.

## Scope-Gate

Die Anforderungen bilden mehrere unabhängig testbare Capability-Cluster mit
unterschiedlichen Datenflüssen und Abnahmekriterien. Deshalb werden sie vor
den einzelnen Modul-Specs explizit geschnitten. Diese Map legt IDs, Grenzen,
Abhängigkeiten und Reihenfolge fest, implementiert aber noch nichts.

## Capability-Map

| Modul-ID | Verantwortung | Zentrale Anforderungen aus dem Audit | Abhängigkeiten |
|---|---|---|---|
| `privacy-disclosure` | Öffentliche und app-interne Datenschutzinformationen | Eine erreichbare Datenschutz-URL und Support-/Kontakt-URL müssen in App Store Connect und in der App vorhanden sein. Die Erklärung muss Datenkategorien, Zwecke, Drittanbieter, Aufbewahrung, Löschung, Tracking/ATT und gesundheitsbezogene Daten korrekt abdecken. App-Privacy-Angaben und Privacy Manifest müssen aus derselben geprüften Dateninventur abgeleitet werden. | keine |
| `account-deletion` | Vollständige Kontolöschung und Drittanbieter-Bereinigung | Die Löschung muss in der App leicht auffindbar sein und Konto sowie zugehörige personenbezogene Daten entfernen. Shared-Content-Regeln müssen mit der Apple-Anforderung und der Haushaltslogik geklärt werden. Sign in with Apple-Tokens müssen widerrufen werden; RevenueCat-/Provider-Daten und lokale Daten dürfen nicht als verwaiste Identität zurückbleiben. Laufende Abos müssen vor der Löschung erklärt und verwaltbar bleiben. | `privacy-disclosure` |
| `subscription-compliance` | In-App-Purchase- und Paywall-Nachweise | Premium-Funktionen müssen über Apple IAP laufen. Vor dem Kauf müssen Preis, Laufzeit, automatische Verlängerung, Kündigung/Verwaltung, Restore, Terms und Privacy sichtbar sein. Produkt- und Entitlement-Namen, Preise und Haushaltsumfang müssen in App, RevenueCat und Store-Metadaten übereinstimmen. | `privacy-disclosure` |
| `consent-and-ads` | Analytics-, ATT-, UMP- und Anzeigen-Compliance | Nicht notwendige Analytics-/Crash-/Produkttelemetrie darf nicht vor der erforderlichen Einwilligung personenbezogen anlaufen. ATT und Google UMP müssen nachvollziehbar sequenziert sein. Gesundheits-, Medikamenten- und Gewichtsdaten dürfen nicht für zielgerichtete Werbung verwendet werden. Anzeigen müssen altersgerecht sein und einen Meldeweg für unangemessene Anzeigen anbieten. | `privacy-disclosure` |
| `permissions-and-health-disclosure` | Minimale Berechtigungen und sichere Gesundheitskommunikation | Nur tatsächlich genutzte native Berechtigungen dürfen angefordert werden. Usage-Descriptions müssen den konkreten Zweck und den richtigen Zeitpunkt erklären; ungenutzte Mikrofon-, Motion- und Always-Location-Deklarationen sind zu entfernen oder zu begründen. Tracking-, GLP-1-, Medikamenten- und Vitalfunktionen benötigen klare Nicht-Medizinprodukt-/Nicht-Diagnose-Hinweise und sichere Copy vor gesundheitsbezogenen Entscheidungen. | `privacy-disclosure`, `consent-and-ads` |
| `review-submission` | Einreichungsartefakte und reproduzierbarer Review-Nachweis | Altersfreigabe, finale Screenshots, funktionierendes Backend, Demo-/Testzugang, Review Notes, Berechtigungsflüsse, IAP, Löschung und Offline-/Fehlerzustände müssen mit einem finalen Build geprüft werden. Platzhalter, nicht erreichbare URLs und zukünftige Versprechen sind ausgeschlossen. | alle vorherigen Module |

## Build-Reihenfolge

```text
privacy-disclosure
        |
        +--> account-deletion
        +--> subscription-compliance
        +--> consent-and-ads
                    |
                    +--> permissions-and-health-disclosure
                                      |
                                      +--> review-submission
```

`account-deletion`, `subscription-compliance` und `consent-and-ads` können nach
dem Datenschutz-Inventar parallel spezifiziert werden. Die Einreichungs-
Capability wird zuletzt spezifiziert, weil sie die Nachweise aller anderen
Module bündelt.

## Gemeinsame, nicht verhandelbare Grenzen

### Immer

- Jede Anforderung erhält eine prüfbare Abnahme und eine Zuordnung zu einem
  lokalen Artefakt oder manuellen Store-Schritt.
- Datenschutz-, Store- und UI-Copy beschreibt das tatsächliche Verhalten des
  Builds, nicht eine geplante spätere Funktion.
- Private Trackingdaten bleiben von Haushaltsdaten und Werbeprofilen getrennt.
- Account-Löschung, Restore, Kündigungsverwaltung und Einwilligungsänderung
  bleiben für Nutzer auffindbar und testbar.

### Vorher klären

- Ob von einem Nutzer erstellte gemeinsame Rezepte, Einkaufs- und
  Bestandsdaten gelöscht, anonymisiert oder auf den Haushalt übertragen
  werden. Apple erwartet grundsätzlich die Entfernung nutzerbezogener
  UGC-Daten; die Haushaltsdomäne bewahrt sie aktuell teilweise auf.
- Ob Analytics beim ersten Start vollständig opt-in sein soll. Die empfohlene
  Spezifikationsannahme ist: nicht notwendige Telemetrie bleibt bis zur
  Einwilligung deaktiviert.
- Betreibername, Datenschutz-URL, Support-URL, Löschkontakt und finale
  Storefront-/Review-Accounts.

### Niemals

- Keine Einreichung mit Platzhalter- oder Login-geschützten Datenschutz- oder
  Support-URLs.
- Keine Nutzung von Gesundheits-, Medikamenten- oder Gewichtsdaten für
  zielgerichtete oder verhaltensbasierte Werbung.
- Keine manuell verfassten Supabase-Migrationen für diese Initiative.
- Keine automatische Löschung gemeinsamer Daten ohne zuvor spezifizierte,
  reversible bzw. nachvollziehbare Haushaltsregel.
- Keine detaillierten Modul-Specs oder Implementierung, bevor diese Map und
  ihre offenen Produkt-/Rechtsentscheidungen geprüft wurden.

## Vorgesehene Modul-Specs nach Freigabe

Nach der Review dieses Dokuments werden je Capability eigene Specs mit Ziel,
Kommandos, Projektstruktur, Coding-Regeln, Teststrategie, Grenzen,
Abnahmekriterien und offenen Fragen angelegt:

1. `SPEC-privacy-disclosure.md`
2. `SPEC-account-deletion.md`
3. `SPEC-subscription-compliance.md`
4. `SPEC-consent-and-ads.md`
5. `SPEC-permissions-and-health-disclosure.md`
6. `SPEC-review-submission.md`

## Referenzen

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)
