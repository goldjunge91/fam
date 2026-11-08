# AI-Abläufe in fam

**Stand:** Lokaler Prototyp im Review-Worktree, 2026-11-08
**Zweck:** Die Diagramme beschreiben den aktuellen Ablauf in der App und im lokalen Supabase-Gateway. Sie sind keine Zusage für noch nicht implementierte Funktionen.

## 1. Assistant: Nachricht und Haushaltskontext

```mermaid
flowchart TD
    A[Assistant öffnen] --> B{Angemeldet und Haushalt aktiv?}
    B -- Nein --> B1[Anmelden oder Haushalt auswählen]
    B -- Ja --> C{Lokale AI-Einwilligung vorhanden?}
    C -- Nein --> C1[Verarbeitungshinweise anzeigen]
    C1 --> C2{Einwilligen?}
    C2 -- Nein --> X[Kein Modellaufruf]
    C2 -- Ja --> C3[Einwilligung verschlüsselt lokal speichern]
    C -- Ja --> D[Gespräch anzeigen]
    C3 --> D
    D --> E{AI-Abo aktiv?}
    E -- Nein --> E1[AI-Abo ansehen oder Käufe wiederherstellen]
    E1 --> E2[Bei aktivem Abo Haushaltsfreigabe synchronisieren]
    E2 --> D
    E -- Ja --> F[Nutzer sendet Nachricht]
    F --> F1[Nutzernachricht lokal verschlüsselt speichern]
    F1 --> I[Gateway lädt Haushaltsrezepte und Vorräte]
    I --> I1[Eigene Allergien, Unverträglichkeiten und Abneigungen per RLS laden]
    I1 --> J
    J --> K[Anbieteranfrage mit Nachricht und bis zu 12 früheren Nachrichten]
    K --> L{Assistant ruft freigegebene Werkzeuge auf?}
    L -- Ja --> M[Werkzeuge ausführen und Resultate zurückgeben]
    M --> K
    L -- Nein --> N[Antwortformat und Vorschläge validieren]
    N --> O{Antwort gültig?}
    O -- Ja --> P[Antwort, Werkzeugspur und Vorschläge lokal speichern]
    O -- Nein --> Q[Fehler anzeigen; bei fehlgeschlagener AI-Auswertung Credit erstatten]
```

Der Modellaufruf verwendet ein serverseitig festgelegtes Modell aus der Allowlist; in der App gibt es keine Modellauswahl für Nutzer und keinen separaten Haushaltskontext-Schalter. Nach der AI-Einwilligung lädt das Gateway für jede Assistant-Anfrage Haushaltsrezepte, Vorräte und die eigenen Lebensmittelregeln des anfragenden Accounts. Die vier Assistant-Werkzeuge sind auf höchstens sechs Modellrunden begrenzt. Gespräche und Einwilligung werden verschlüsselt im Account-Speicher auf dem Gerät gehalten.

## 2. Assistant-Werkzeuge und Vorschläge

```mermaid
flowchart TD
    A[Assistant-Anfrage nach Einwilligung] --> B{Werkzeugbedarf}
    B -- Rezept- oder Vorratsfrage --> C[Rezepte suchen oder Vorräte lesen]
    C --> D[Zutaten gegen eigene Lebensmittelregeln prüfen]
    D --> E[Ergebnis an das Modell zurückgeben]
    E --> F[Antwort ohne Änderung an Haushaltsdaten]
    B -- Wochenplan --> G[Rezepte suchen und Regelkonflikte ausschließen]
    G --> H[Typisierten Planvorschlag mit Rezeptständen erzeugen]
    H --> I[Vorschlag im Chat anzeigen]
    I --> J{Nutzer übernimmt den Vorschlag?}
    J -- Nein --> K[Haushaltsplan bleibt unverändert]
    J -- Prüfen oder übernehmen --> L[Aktuelle Regeln und Rezeptstände erneut lesen]
    L --> M{Regeln und Rezept noch aktuell?}
    M -- Nein --> N[Übernahme abbrechen und neuen Vorschlag anfordern]
    M -- Ja --> O[Plan und Einträge über bestehende lokale Mutationen anlegen]
    O --> P[Outbox und regulärer Sync]
    B -- Zutatenwechsel --> R[Ersatz gegen Lebensmittelregeln prüfen]
    R --> S[Idee im Chat anzeigen]
    S --> T[Rezept öffnen; Rezept bleibt unverändert]
```

`search_recipes` und `get_inventory` lesen nur. Ein Wochenplan wird erst nach ausdrücklicher Nutzeraktion angelegt und vor dem Anwenden erneut auf geänderte Lebensmittelregeln, Haushalt und Rezeptstand geprüft. Ein Zutatenwechsel ist im aktuellen Prototyp eine Idee mit Link zum Rezept; er wird nicht automatisch gespeichert.

## 3. AI-Rezeptimport

```mermaid
flowchart TD
    A[Import öffnen] --> B{Angemeldet, Haushalt aktiv und Einwilligung vorhanden?}
    B -- Nein --> B1[Anmelden, Haushalt auswählen oder Einwilligen]
    B -- Ja --> C[Quelle wählen: URL, Text, Foto, PDF oder Video-URL]
    C --> D{Mehrere URLs?}
    D -- Ja --> E[Jeden Link einzeln in die Importwarteschlange geben]
    D -- Nein --> F[Einzelne Quelle verarbeiten]
    E --> G[Gespeichertes Rezept und lokalen Entwurf auf Duplikat prüfen]
    F --> G
    G --> H{Duplikat?}
    H -- Ja --> H1[Vorhandenes Rezept oder Entwurf öffnen]
    H -- Nein --> I{Quelle ist URL?}
    I -- Ja --> J[URL sicher laden und strukturierte Rezeptdaten lesen]
    J --> K{Strukturierte Daten vollständig und gültig?}
    K -- Ja --> L[Entwurf ohne Modellaufruf zurückgeben]
    K -- Nein --> M[Lesbaren Seiteninhalt prüfen]
    M --> N{Rezepttext gefunden?}
    N -- Nein --> X[Importfehler für diesen Link anzeigen]
    N -- Ja --> O[AI-Gateway, Abo und Credit prüfen]
    I -- Nein --> P[Text, Foto, PDF oder Video an AI-Gateway geben]
    P --> O
    O --> Q[Strukturierten Rezeptentwurf vom AI-Anbieter lesen]
    L --> R[Entwurf verschlüsselt lokal speichern]
    Q --> R
    R --> S[Importstatus: Entwurf prüfen]
    S --> T[Rezepteditor mit Quelle, Unsicherheiten und Rohzutaten öffnen]
    T --> U[Zutaten Produkten zuordnen und Mengen in Gramm prüfen]
    U --> V{Alle ausgefüllten Zutaten gültig?}
    V -- Nein --> T
    V -- Ja --> W{Nutzer speichert?}
    W -- Nein --> Y[Entwurf bleibt lokal; Rezept unverändert]
    W -- Ja --> Z[Haushaltsrezept über bestehenden Mutationspfad anlegen]
    Z --> ZA[Importentwurf lokal als abgeschlossen markieren]
    X --> XB[Link einzeln erneut versuchen oder Eingabe korrigieren]
```

Strukturierte Webseitenrezepte benötigen keinen AI-Aufruf. Text-, Foto-, PDF- und Videoauswertung sowie der Fallback für unvollständige Webseiten verwenden das Gateway und dessen Abo-/Credit-Prüfung. Quellinhalte gelten dabei als nicht vertrauenswürdige Daten; die AI-Antwort muss dem strukturierten Entwurfsformat entsprechen. Der Video-Pfad übergibt die öffentliche Video-URL direkt an ein unterstütztes Modell; Untertitel, Audio oder Einzelbilder werden nicht separat extrahiert. Importentwürfe werden erst nach Prüfung und ausdrücklichem Speichern zu Haushaltsrezepten.

## 4. AI-Abo und Haushaltsfreigabe

```mermaid
flowchart TD
    A[Assistant oder AI-Import öffnen] --> B{RevenueCat meldet AI-Abo aktiv?}
    B -- Ja --> C[Haushalts-AI-Freigabe laden]
    C --> D{Freigabe im aktiven Haushalt vorhanden?}
    D -- Ja --> E[AI-Funktion freischalten]
    D -- Nein --> F[RevenueCat-Freigabe synchronisieren]
    B -- Nein --> G[AI-Abo ansehen oder Käufe wiederherstellen]
    G --> H{Aktives Abo in CustomerInfo gefunden?}
    H -- Nein --> I[AI-Funktion bleibt gesperrt]
    H -- Ja --> F
    F --> J[Entitlement-Sync authentifiziert Nutzer und Haushalt]
    J --> K{Lokale Supabase-Umgebung?}
    K -- Ja --> L[Test-Store-Entitlement aus lokaler CustomerInfo übernehmen]
    K -- Nein --> M[Entitlement serverseitig bei RevenueCat verifizieren]
    L --> N[AI-Zuordnung zum berechtigten Haushalt aktualisieren]
    M --> N
    N --> O{Sync erfolgreich und Haushalt zugeordnet?}
    O -- Nein --> P[Freigabe als ausstehend oder fehlgeschlagen anzeigen]
    O -- Ja --> Q[Premium-Status aktualisieren]
    Q --> E
```

Die App kann Käufe wiederherstellen; für eine echte AI-Anfrage prüft das Gateway die Haushaltsberechtigung erneut serverseitig. Die Clientmeldung allein ist keine Berechtigung. Die Test-Store-Variante gilt nur für die lokale Supabase-Umgebung.

## 5. AI-Gateway: Berechtigung, Credit und Anbieteraufruf

```mermaid
flowchart TD
    A[AI-Anfrage an ai-gateway] --> B[Supabase-Nutzer authentifizieren]
    B --> C[Mitgliedschaft im angefragten Haushalt prüfen]
    C --> D{Nur Credit-Status?}
    D -- Ja --> E[AI-Entitlement serverseitig prüfen]
    E --> F[Creditstand zurückgeben; kein Anbieteraufruf]
    D -- Nein --> G[Modell erlauben und Ratenlimit prüfen]
    G --> H{Web-Rezeptimport?}
    H -- Ja --> I[URL abrufen und strukturierte Daten zuerst lesen]
    I --> J{Strukturierter Entwurf gültig?}
    J -- Ja --> K[Entwurf ohne AI-Entitlement und Credit zurückgeben]
    J -- Nein --> L{Sicherer und lesbarer Rezepttext?}
    L -- Nein --> X[Fehler zurückgeben]
    L -- Ja --> M[AI-Entitlement serverseitig prüfen]
    H -- Nein --> M
    M --> N{Abo aktiv?}
    N -- Nein --> O[402: AI-Abo erforderlich]
    N -- Ja --> P[Bei freigegebenem Assistant-Kontext Haushaltsdaten laden]
    P --> Q[Credit atomar für Anfrage buchen]
    Q --> R{Credit verfügbar?}
    R -- Nein --> S[Credit-Limit-Fehler zurückgeben]
    R -- Ja --> T[Anbieter aufrufen; Assistant-Werkzeuge begrenzt ausführen]
    T --> U{Antwort und Fachregeln gültig?}
    U -- Ja --> V[Ergebnis mit Werkzeugspur und Nutzungsdaten zurückgeben]
    U -- Nein --> W[Credit erstatten und Fehler zurückgeben]
```

Providerfehler, leere Antworten und ungültige Modellantworten erstatten den gebuchten Credit. Eine erfolgreiche AI-Auswertung verbraucht ihn. Die strukturierte Rezeptantwort ist die Ausnahme: Sie kehrt vor AI-Entitlement und Credit-Buchung zurück.

## Noch nicht in diesen Abläufen enthalten

- Teilen aus anderen Apps und der konkrete Instagram-Shortcut-Ablauf.
- Extraktion von Untertiteln, Audiospur oder Videoframes.
- Sprachaufnahme und Vorlesen, Belegverarbeitung, Bildgenerierung und externe Rezeptsuche.
- Assistant-Anhänge und serverseitig synchronisierte Gespräche.

Die Produktziele und fachlichen Grenzen stehen in [AI und Assistant](ai-und-assistant-produktziel.md) und [Rezeptimport](rezeptimport-produktziel.md). Die Diagramme beschreiben die Implementierung im Review-Worktree; bei Änderungen am Quellverhalten müssen sie mitaktualisiert werden.
