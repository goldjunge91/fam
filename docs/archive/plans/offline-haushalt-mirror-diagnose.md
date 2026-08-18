# Diagnose: Offline kann kein Supermarkt/Artikel angelegt werden

**Status:** Untersuchung abgeschlossen — Design-Entscheidung offen, noch nicht
umgesetzt.
**Created:** 2026-08-11
**Gefunden bei:** manueller Zwei-Geräte-Test zu Gate D (`003-gate-d-two-device-verification.md`)

## Problem (Nutzer-Report)

Ist ein Nutzer offline, kann er weder einen neuen Supermarkt anlegen noch
einen Artikel auf die Einkaufsliste setzen. Beide Aktionen wirken wie
"online-only", obwohl die App als local-first (SQLite + Outbox + Sync-Engine)
konzipiert ist — siehe `src/lib/sync/sync-runner.ts`, `src/lib/db/client.ts`.

## Untersuchte Bereiche

- `src/features/shopping-list/use-shopping-list-mutations.ts`,
  `use-stores.ts`, `components/add-item-form.tsx`, `stores-screen.tsx`,
  `shopping-list-screen.tsx`
- `src/features/household/api.ts` (`useHouseholds`)
- `src/features/household/active-household-provider.tsx`
- `src/features/household/active-household-store.ts`
- `src/lib/query-client.ts` (Cache-Konfiguration, Persistenz)

## Befund: Die Mutationen selbst sind NICHT das Problem

`use-shopping-list-mutations.ts` und `use-stores.ts` schreiben bereits
korrekt local-first — SQLite + Outbox, kein `await` auf einen Netzwerkcall.
Das ist dasselbe Muster wie bei den (offline funktionierenden) Inventory-
Mutationen. Hier liegt kein Bug.

## Root Cause: `households` selbst ist die einzige Entität ohne lokalen Mirror

Jede andere synchronisierte Entität (Inventory, Fridge-Items,
Shopping-List-Items, Stores) hat eine lokale SQLite-Tabelle als
Wahrheitsquelle für Lesevorgänge. **Haushalte nicht.**

`src/features/household/api.ts:34-53` — `useHouseholds()`:

```ts
export function useHouseholds() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: householdsQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('households')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userId,
  });
}
```

Das ist ein reiner Live-Supabase-Call über React Query — kein SQLite-Read,
kein Outbox-Bezug. `src/lib/query-client.ts` persistiert den Query-Cache
nicht (kein `persistQueryClient`/AsyncStorage-Persister). Nach einem
Kaltstart offline (oder bevor der erste Fetch durchgelaufen ist) liefert
dieser Hook `data: []`.

`src/features/household/active-household-provider.tsx:85-92` leitet
`activeHousehold` direkt aus diesem Array ab:

```ts
const activeHousehold = useMemo(() => {
  if (!households || households.length === 0) return null;
  if (selectedId) {
    const found = households.find((h) => h.id === selectedId);
    if (found) return found;
  }
  return households[0] ?? null;
}, [households, selectedId]);
```

Zwar wird die **ID** des zuletzt aktiven Haushalts persistiert
(`active-household-store.ts`, per `getStoredActiveHouseholdId`/
`setStoredActiveHouseholdId`, in `active-household-provider.tsx:52-59`) —
aber das nützt nichts, weil `activeHousehold` trotzdem erst existiert, wenn
die ID in einem geladenen `households`-Array wiedergefunden wird. Ist das
Array leer (offline), bleibt `activeHousehold` `null`, komplett unabhängig
von der gespeicherten ID.

**Wirkung auf die UI:**

- `stores-screen.tsx:23-24,38` — `currentHousehold = activeHousehold`;
  `handleAdd()` beginnt mit `if (!currentHousehold || ...) return;` → beim
  Tippen auf "Hinzufügen" passiert offline schlicht nichts.
- `shopping-list-screen.tsx:55-56` — `householdId = activeHouseholdId ?? undefined`;
  `AddItemForm` verlangt `householdId: string` als Pflicht-Prop, ist also ohne
  aktiven Haushalt gar nicht sinnvoll benutzbar/wird nicht gerendert.

Kein Guard ist absichtlich netzwerkbezogen (kein `NetInfo`/`isOnline`-Check)
— es ist ein Seiteneffekt davon, dass `activeHousehold` ausschließlich aus
einer Live-Query gespeist wird, die offline leer bleibt.

## Warum das kein reiner Mutation-Fix ist

Die eigentlichen Schreibaktionen sind bereits offlinefähig. Der Blocker sitzt
strukturell davor: die App weiß offline nicht, in welchem Haushalt sie
gerade ist, weil dieser Zustand nirgends lokal persistiert wird (nur seine
ID, nicht die Daten). Ein Fix rein in `use-stores.ts`/
`use-shopping-list-mutations.ts` würde am Symptom vorbeigehen.

## Design-Entscheidung, die getroffen werden muss

### Option A — Voller lokaler Mirror für `households`

Haushalte werden wie Inventory/Shopping-List-Items Teil der local-first
Sync-Engine: eigene SQLite-Tabelle, Aufnahme in `src/lib/db/entities.ts` /
`migrations.ts`, Pull-Sync und ggf. Realtime-Anbindung (siehe
`supabase/schemas/10_realtime.sql`).

- **Vorteil:** Konsistent mit der bestehenden Architektur. Löst nebenbei
  auch andere Stellen, die offline auf `households`/`useHouseholds`
  angewiesen sind (Haushalts-Wechsler, Mitgliederliste, evtl. weitere).
- **Nachteil:** Größerer Eingriff — neue Tabelle, Migration, Sync-Wiring,
  Konfliktbehandlung bei Owner-Wechsel/Verlassen/Löschen eines Haushalts
  (Sonderfälle, die Inventory/Shopping-List nicht hat).

### Option B — Leichtgewichtiges Persistieren nur des aktiven Haushalts

Statt der ganzen Liste wird nur das aktive Haushaltsobjekt (id, name, ggf.
weitere für die UI nötige Felder) beim erfolgreichen Laden zusätzlich lokal
abgelegt (z. B. AsyncStorage neben der bereits vorhandenen ID, oder eine
einzelne SQLite-Zeile) und beim Kaltstart als Fallback verwendet, bis
`useHouseholds()` erfolgreich nachlädt.

- **Vorteil:** Kleiner, gezielter Eingriff — löst genau das gemeldete
  Symptom (Supermarkt/Artikel anlegen offline).
- **Nachteil:** Haushalts-**Liste** (Wechsler, Mitgliederverwaltung) bleibt
  offline weiterhin nicht verfügbar — nur der zuletzt aktive Haushalt ist
  robust. Löst das Problem nicht strukturell, falls an anderer Stelle
  dieselbe Lücke nochmal auftaucht.

### Abwägung

Die Entscheidung hängt davon ab, ob Offline-Fähigkeit für
Haushalts-Verwaltung (Wechsel, Mitglieder, Einladungen) insgesamt gewünscht
ist (→ Option A) oder ob nur der konkret gemeldete Fall (Supermarkt/Artikel
anlegen) mit minimalem Aufwand behoben werden soll (→ Option B, ggf. als
Zwischenschritt vor einem späteren vollen Mirror).

## Betroffene Dateien (für die spätere Umsetzung, unabhängig von der Entscheidung)

- `src/features/household/api.ts` — `useHouseholds`
- `src/features/household/active-household-provider.tsx` — Ableitung von
  `activeHousehold`
- `src/features/household/active-household-store.ts` — bestehende
  ID-Persistenz, als Vorlage für Option B oder zu ersetzen durch Option A
- `src/features/shopping-list/stores-screen.tsx`,
  `shopping-list-screen.tsx`, `components/add-item-form.tsx` — Konsumenten,
  keine Änderung nötig sobald `activeHousehold` offline verfügbar ist
- Bei Option A zusätzlich: `src/lib/db/entities.ts`, `src/lib/db/migrations.ts`,
  `src/lib/sync/sync-runner.ts`, ggf. `src/lib/sync/realtime.ts`
