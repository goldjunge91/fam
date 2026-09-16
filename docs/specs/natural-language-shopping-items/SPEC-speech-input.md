# Spec: `speech-input`

**Status:** Entwurf, Review erforderlich
**Parent:** [SPEC.md](./SPEC.md)
**Capability:** `speech-input`

## Objective

Speech-to-Text soll innerhalb des bestehenden Einkaufslisten-Hinzufügen-Flows
verfügbar sein. Nach dem Stoppen der Aufnahme wird direkt die Artikelvorschau
geöffnet. Es gibt keinen separaten Transcript-Bearbeitungsschritt.

## Contract

- Die Aufnahme funktioniert offline, wenn die native Plattform das unterstützt.
- Die native Geräte-/Betriebssystemerkennung darf verwendet werden, auch wenn
  ein Gerät dafür online sein muss.
- Berechtigungsablehnung, Nichtverfügbarkeit und Transkriptionsfehler werden
  verständlich dargestellt.
- Texteingabe bleibt jederzeit nutzbar.
- Der fertige Transcript ist der einzige fachliche Output und wird an
  `local-recognition` übergeben.
- Roh-Audio wird nicht gespeichert, synchronisiert, geloggt oder an Analytics
  übertragen.

## Success Criteria

- iOS und Android bieten Aufnahme-Start und -Stop im Add-Item-Flow.
- Ein erfolgreicher Transcript öffnet direkt die Vorschau.
- Ein identischer Transcript führt zum identischen Parserinput wie getippter
  Text.
- Offline-Verhalten sowie Berechtigungs- und Fehlerzustände sind auf echten
  Geräten geprüft.

## Boundaries

- Keine Speech-to-Text-Abhängigkeit ohne Prüfung von Expo-57-Kompatibilität,
  Dev-Client-Auswirkung und Offlineverhalten.
- Keine Persistenz von Audio oder Roh-Transcript in synchronisierten Tabellen.
