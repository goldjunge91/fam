# Website und App Store: Prüfstand

Geprüft am **25. Oktober 2026** mit dem Skill `apple-app-store-release`, Harness Codex. Umfang: statische Website in `website/`, mit gezieltem Abgleich von App-Code. Kein vollständiger Release-Audit, kein App-Build, keine Änderung in App Store Connect, kein Deployment.

**Verdict: Not ready für eine Store-Einreichung.** Die Website-Struktur ist umgesetzt. Auf Marcos ausdrücklichen Wunsch sind vorerst Mustermann-Anbieterangaben enthalten. Die nachstehenden Nachweise dürfen nicht aus dem Layout oder dem Vorhandensein einer HTML-Datei abgeleitet werden.

## Webanforderungen und Evidenz

| Gate | Status | Evidenz und nächste notwendige Klärung |
| --- | --- | --- |
| Getrennte Informationsseiten | PASS | Start, FAQ, Support, Impressum, Datenschutz und Nutzungsbedingungen sind eigenständige Dokumente und auf jeder Seite erreichbar. |
| Konkrete Supportmöglichkeit | NEEDS EVIDENCE | `support.html` enthält die vorhandene E-Mail-Adresse, Hilfe zu Problemen, Käufen und Kontolöschung. Marco muss Zustellbarkeit und Bearbeitung des Postfachs bestätigen. Keine Antwortfrist wird versprochen. |
| Öffentliche URLs | NEEDS EVIDENCE | Produktionsdomain und HTTPS-Erreichbarkeit aller Zielseiten nach Deployment prüfen, inklusive Aufruf ohne Login. Kein Deployment erfolgt; `scrappy-app.de` ist ein übernommener, unbestätigter Wert. |
| Anbieterkennzeichnung | BLOCKED | Auf ausdrücklichen Wunsch Mustermann-Platzhalter statt echter Anschrift. Tatsächlicher Name, ladungsfähige Anschrift, USt-ID soweit vorhanden und anwendbare weitere Pflichtangaben müssen bestätigt werden. |
| Datenschutz: Daten und Empfänger | NEEDS EVIDENCE | Unzutreffende Anonymitätsbehauptung korrigiert. `src/features/app-shell/posthog-identity-sync.tsx` übermittelt Konto-ID und E-Mail; `src/lib/observability/providers/sentry.ts` aktiviert `sendDefaultPii`. Produktive SDK-Konfigurationen und App-Store-Datenschutzantworten vollständig abgleichen. |
| Datenschutz: Fristen und Verträge | BLOCKED | Tatsächliche Speicher-/Backupfristen, Löschung bei Drittdiensten, Rechtsgrundlagen nach Zweck, Empfänger-Rechtsträger, Hostingregionen, internationale Übermittlungen und Schutzgarantien sind nicht belegt. Nicht aus Abhängigkeiten oder Standardverträgen ableiten. Die bisher unbelegten Aussagen zu abgeschlossenen AVV und Frankfurt-Hosting wurden entfernt. Betreiber muss diese Angaben vervollständigen, insbesondere die nach Apple 5.1.1(i) geforderte gleichwertige Absicherung bei Dritten. |
| Datenschutzlink innerhalb der App | NEEDS EVIDENCE | Die App öffnet unter Einstellungen eine eigene lokale Datenschutzfassung (`src/features/settings/privacy-screen.tsx`, Übersetzung in `src/i18n/features/settings.de.json`). Abgleich und Zugang zur vollständigen öffentlichen Fassung im Release-Build sind noch zu verifizieren. App-Dateien wurden nicht verändert. |
| Einwilligung und Widerruf | NEEDS EVIDENCE | Werbeoptionen unter Einstellungen → Datenschutz sind im Code vorhanden. Die allgemeine Analytics-Einwilligung, Widerruf und tatsächliche Datenerhebung im Release-Build wurden nicht getestet. ATT ersetzt keine Prüfung der übrigen Verarbeitung. |
| Kontolöschung | NEEDS EVIDENCE | Website nennt Einstellungen → Konto löschen. Route und Funktionsaufruf sind im Code vorhanden; kein Löschversuch durchgeführt. Der tatsächliche Release-Flow, Backend-Löschung und Umgang mit Haushaltsdaten/Sign in with Apple sind separat nachzuweisen. E-Mail-Support ersetzt die erforderliche Löschung in der App nicht. |
| Abonnements und Käufe | PASS (Website-Hilfe) | Kündigung, Wiederherstellung und Erstattung werden getrennt erklärt; Kontolöschung kündigt ein Abo nicht. Preise, Laufzeiten und Funktionsumfang sind im konkreten Kaufangebot zu prüfen. Kein fiktiver Preis oder Kauf-Link ergänzt. |
| Lizenzvereinbarung | NEEDS EVIDENCE | `agb.html` wird als Nutzungsbedingungen bezeichnet. Die Seite ist keine verifizierte individuelle Apple-EULA. In App Store Connect prüfen, ob Apples Standard-EULA gilt oder eine vollständige eigene Vereinbarung vorgesehen ist. |
| Produktdarstellung | PASS (Website) | Keine erfundenen Store-Links, Bewertungen, Sparversprechen oder Verschwendungsstatistiken. Die schematische Produktansicht ist ausdrücklich als Illustration beschriftet. Kein offizielles App-Store-Badge ohne tatsächlichen Store-Eintrag. |
| Lebensmittelsicherheit | PASS (Textkorrektur) | FAQ und Bedingungen unterscheiden Mindesthaltbarkeit und Verbrauchsdatum; keine Empfehlung zum Verzehr nach Verbrauchsdatum. Kein pauschaler Ausschluss der Haftung für Gesundheitsschäden mehr. Rechtliche Endprüfung der Bedingungen bleibt offen. |

## Prüfung der Website

Lokale Prüfung am 25. Oktober 2026 mit Playwright und installiertem Google Chrome über `http://127.0.0.1:8765/`: **60 Layoutprüfungen ohne Fehler** (6 Seiten × 320, 390, 768, 1024 und 1440 Pixel × Hell/Dunkel). Keine horizontalen Seitenüberläufe, kaputten lokalen Links/Anker, fehlerhaften HTTP-Ressourcen oder Browser-JavaScriptfehler. FAQ-Öffnen und -Schließen mit Enter sowie der erste Tastaturfokus auf „Zum Inhalt“ in beiden Farbschemata erfolgreich. Native Aufklappelemente benötigen kein JavaScript.

Alle sechs HTML-Dokumente wurden zusätzlich mit parse5 ohne Parserfehler geprüft. Gezielt auf diese HTML-/CSS-Dateien angewendetes Biome mit aktiviertem HTML-Support: **7 Dateien, keine Fehler oder Warnungen**. `git diff --check` ist sauber. Desktop- und Mobilansicht wurden visuell kontrolliert; kleine Akzenttexte auf getönten Kontaktflächen erhielten stärkeren Kontrast. Auf Marcos anschließenden Wunsch wurde die vorherige Creme-/Orange-Palette wiederhergestellt, einschließlich warmem Dunkelmodus und passendem Favicon. Für kleine orange Texte und Buttons wird das dunklere Orange der vorherigen Palette verwendet: Orange auf Creme 4,78:1, Buttontext 5,23:1. Das ist kein vollständiger Screenreader-, Safari- oder WCAG-Nachweis. App-Typecheck und App-Tests wurden nicht ausgeführt, da ausschließlich statische Website-Dateien geändert wurden. Die Website verwendet keine clientseitigen Analyse-Skripte, Drittanbieterfonts oder Kontaktformulare. Das belegt keine Aussage über etwaige Cloudflare-Dashboard-Einstellungen, Web Analytics oder Serverlogs.

## Quellen

Alle folgenden Quellen wurden am **25. Oktober 2026** abgerufen. Apple ist für die Store-Vorgaben maßgeblich.

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), insbesondere 1.5 (Kontakt), 2.1 (Vollständigkeit), 3.1.2 (Abonnements), 5.1.1 (Datenschutz und Kontolöschung).
- [App Store Connect: Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information), Support URL und Marketing URL.
- [App Store Connect: Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/), öffentliche Privacy Policy URL und Angaben zur Datenverarbeitung.
- [Apple: Offering account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion).
- [Apple: Product page](https://developer.apple.com/app-store/product-page/), sachliche Produktdarstellung.
- [Apple: Submitting](https://developer.apple.com/app-store/submitting/), aktuelle Release-Vorgaben konsultiert. SDK-/Upload-Voraussetzungen sind nicht Teil dieses Website-Nachweises.
- [Apple Support: Abo kündigen](https://support.apple.com/de-de/118428).
- [Apple Support: Erstattung](https://support.apple.com/de-de/118223).
- [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html), Anbieterangaben.
- [Europäische Kommission: Einstellung der OS-Plattform](https://consumer-redress.ec.europa.eu/site-relocation_en), seit 20. Juli 2025 eingestellt. Veralteter Link aus dem Impressum entfernt.

## Freigabegrenze

Vor Einreichung bestätigt Marco die echten Anbieterangaben, Produktionsdomain und Support-Adresse, vervollständigt die Datenverarbeitungsangaben anhand des produktiven Betriebs und prüft die URLs öffentlich. Danach werden Website, In-App-Datenschutz und App-Store-Datenschutzantworten mit dem tatsächlich eingereichten Build abgeglichen. Dieser Bericht bescheinigt keine Freigabe des gesamten iOS-Releases.
