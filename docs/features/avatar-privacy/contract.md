# Private Profilbilder

Freigegeben von Marco am 2026-09-23. Aufgaben und Nachweise: Beads `fam-ju7p`.

- `avatars` ist privat. Lesen und Signieren: Besitzer oder aktuell gemeinsamer Haushalt.
  Schreiben, Ersetzen und Löschen: ausschließlich Besitzer.
- `25_avatar_storage.sql` besitzt die Policies. Der Bucket-Zustand muss zusätzlich
  über die Storage-Verwaltung privat gesetzt werden; eine Policy allein schützt
  öffentliche Objekt-URLs nicht.
- `avatar-image.tsx` besitzt die autorisierte Bildauflösung für alle Avatar-Flächen.
  Signierte URLs gelten fünf Minuten, werden vor Ablauf erneuert und weder im
  Profil noch im persistenten Query-Cache gespeichert. Kein öffentlicher Fallback.
- Bestehende öffentliche URLs werden nur als Objektverweis gelesen. Neue Uploads
  speichern eine stabile authentifizierte Objektadresse mit Cache-Version.
  Die Anzeige ruft auch diese Adresse nie direkt ab, sondern signiert den Pfad.
- Eine bereits ausgestellte signierte URL ist bis Ablauf weiter verwendbar, auch
  nach Haushaltsaustritt. Neue Signaturen müssen dann abgewiesen werden.
- Abnahme: Besitzer/Mitglied können lesen; Fremder, anonymer Zugriff und ehemaliges
  Mitglied nicht. Fremde Schreibzugriffe bleiben verboten. Alle Avatar-Flächen
  verwenden denselben Resolver. Deployment ist erst mit privatem Live-Bucket und
  wirksamen Policies vollständig; lokale Dateien allein sind kein Schutz.
