# Kind-Tracking gehört dem Kindprofil, Umbau eingefroren

`child_profile_id` liegt heute auf neun Tracking-Tabellen (`food_entries`, `weight_entries`, `user_goals`, `fasting_sessions`, `medication_logs`, `symptom_logs`, `glucose_entries`, `ketone_entries`, `workout_sessions`) und ist über `active-profile-store.ts` plus Profil-Umschalter in Diary und Add-Food auch nutzbar. #182 ging davon aus, das sei ein totes, vorsorglich eingebautes Feld — tatsächlich ist es ein durchgezogener Vertikalschnitt. Die RLS aller dieser Tabellen ist aber `auth.uid() = user_id`: ein Kind-Eintrag gehört dem Elternteil, der ihn getippt hat.

Entscheidung: Zielmodell ist, dass ein Kind-Tracking-Eintrag dem **Kindprofil** gehört. `user_id` wird zum Audit-Feld ("wer hat eingetragen"), die RLS läuft über `child_profiles` und dessen Haushalt, Zugriff hat wer das Profil verwalten darf (`managed_by` **oder** Haushalts-Admin, analog zu den bestehenden `child_profiles`-Policies) — nicht jedes Haushaltsmitglied, weil eine WG Mitglieder hat, die keine Eltern sind. Nur in diesem Modell sehen beide Eltern dieselben Daten, und nur in ihm ist die Volljährigkeits-Übergabe eine Datenoperation statt einer Handmigration.

Dieser Umbau ist **eingefroren**. Er startet, sobald das erste von beidem eintritt: ein Nutzer fragt Kind-Tracking nach, oder die Volljährigkeits-Übergabe soll gebaut werden. Bis dahin bleiben Bestandsspalten und Bestandsdaten unangetastet.

## Konsequenzen

- **Neue Tabellen bekommen kein `child_profile_id`**, solange der Frost gilt. Die ursprüngliche Begründung fürs Vorbauen (`07_child_profiles.sql`: "nachtraeglich waere das eine schmerzhafte Migration") trägt nicht — eine nullable FK-Spalte nachzurüsten ist in Postgres ein Katalog-Update ohne Table-Rewrite. Betrifft konkret `activity_entries` (#296).
- **Kind-Tracking gilt pro Domäne, nicht pauschal.** Mit Kind-Bezug: Ernährung (`food_entries`, `user_goals`), Gewicht und Wachstum (`weight_entries`), Medikamente und Symptome (`medication_logs`, `symptom_logs`), Glukose (`glucose_entries`), Workouts (`workout_sessions`). Ohne: Fasten (`fasting_sessions`), Ketone (`ketone_entries`), Aktivität (`activity_entries`).
- **Die Fasten-Karte wird im Kindmodus geschlossen**, obwohl der Frost sonst nichts anfasst. Frost heißt, das Datenmodell nicht umzubauen, nicht, eine unerwünschte Funktion weiter anzubieten: heute kann ein Elternteil über den Profil-Umschalter ein 16:8- oder OMAD-Fasten für ein Kind starten. Bestehende Zeilen bleiben liegen.
- **Glukose ist der stärkste Kind-Fall im Backlog** (Typ-1-Diabetes bei Kindern, Fremdverwaltung durch Eltern ist dort die Normalsituation), bekommt die Spalte nach dem Punkt oben aber trotzdem erst beim Umbau.
- **Die Privatheitszusage in `09_tracking.sql` wird dadurch nicht aufgeweicht.** Sie schützt Daten von Accounts. Ein Kind hat keinen Account, seine Daten sind zwangsläufig fremdverwaltet — ein anderer Fall, kein Schlupfloch. Ohne diesen Satz liest ihn der nächste Mensch als Präzedenzfall für Haushaltszugriff auf Erwachsenendaten.
- **`child_profiles` speichert kein Gewicht.** Ein Kind-`user_goals` ist deshalb rechnerisch nicht befüllbar, weil jede BMR-Formel Gewicht braucht. `weight_entries` mit Kindbezug löst das beim Umbau mit.

## Verworfene Alternativen

- **Zurückbauen**: Umschalter, Store und neun Spalten entfernen. Verwirft funktionierende, erreichbare UI und kostet mehr als der Frost.
- **Weiter unentschieden lassen ohne Festschreibung**: der bisherige Zustand. Er hat #182, #190 und die Kollision mit #296 erzeugt; jede neue Welle hätte das Muster weiter zementiert.
- **Eigentümer bleibt der Elternteil**: schließt beide Anforderungen aus, die den Umbau überhaupt motivieren (zweiter Elternteil sieht mit, Übergabe bei Volljährigkeit).
