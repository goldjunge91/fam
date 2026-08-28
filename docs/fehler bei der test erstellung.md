Sehr gut — jetzt sind nicht nur alle 846 Tests grün, sondern Jest beendet sich auch sauber und ohne Konsolenwarnungen. Die meisten Probleme lagen nicht in der App, sondern in unvollständigen oder unrealistischen Testumgebungen.

## Zusammenfassung der gefundenen Fehler

### 1. Fehlende React-Keys durch Test-Mocks

Betroffen waren unter anderem:

- `InventoryItemRow`
- `ProductSearchDropdown`
- `RecipeTemplateDetailScreen`

Typische Ursachen:

```tsx
return [children, actions];
```

React behandelt das als Liste. Dann braucht jedes Element einen eindeutigen `key`.

Korrektur:

```tsx
return (
  <>
    {children}
    {actions}
  </>
);
```

Beim Rezeptvorlagen-Test fehlte dagegen tatsächlich das Feld, das als Key verwendet wurde:

```tsx
key={step.id}
```

Die Testdaten enthielten aber nur veraltete Felder:

```tsx
{
  step_order: 1,
  instruction: '...',
}
```

Korrekt war:

```tsx
{
  id: 'step-1',
  position: 0,
  text: '...',
}
```

Lernpunkt: Eine Key-Warnung kann aus der Komponente kommen, sehr häufig liegt sie aber an unvollständigen Testdaten oder einem vereinfachten Komponenten-Mock.

---

### 2. Asynchrone Events wurden nicht abgewartet

Mehrere Tests hatten:

```tsx
fireEvent.press(button);
```

Mit der verwendeten React Native Testing Library müssen diese Aktionen abgewartet werden:

```tsx
await fireEvent.press(button);
```

Dasselbe gilt für:

```tsx
await fireEvent.changeText(input, 'Text');
await user.press(button);
await user.type(input, 'Text');
```

Ohne `await` endet der von Testing Library verwaltete `act(...)`-Bereich zu früh. Nachfolgende State-Updates erzeugen dann Warnungen, obwohl der Test möglicherweise trotzdem besteht.

---

### 3. `act(...)` selbst wurde nicht abgewartet

Im Navigationstest stand sinngemäß:

```tsx
act(() => {
  result.current.openDrawer();
});
```

Korrekt:

```tsx
await act(() => {
  result.current.openDrawer();
});
```

Bei asynchroner Arbeit:

```tsx
await act(async () => {
  await result.current.mutateAsync(input);
});
```

Lernpunkt: Ein `async`-Test allein reicht nicht. Jede asynchrone React-Aktion muss bis zu ihrem sichtbaren Endzustand abgewartet werden.

---

### 4. TanStack-Mutationen waren intern noch nicht vollständig abgeschlossen

Betroffen waren unter anderem:

- Recipe-Mutationen
- Meal-Plan-Mutationen
- Lagerort-Mutationen
- Shopping-List-Mutationen
- Abschluss eines Einkaufs

Die Tests warteten zwar auf `mutateAsync()`, aber TanStack Query veröffentlicht den neuen Hook-Zustand in einem späteren Tick.

Das vollständige Muster lautet:

```tsx
await act(async () => {
  await result.current.mutateAsync(input);
});

await waitFor(() => {
  expect(result.current.isSuccess).toBe(true);
});
```

Erst danach sollte die eigentliche Assertion folgen.

Lernpunkt: Auf die Funktion zu warten ist nicht immer dasselbe wie darauf zu warten, dass React den neuen Zustand gerendert hat.

---

### 5. Ein Query-Mock lieferte `undefined`

Im Test für `useCompleteShoppingRun` stand:

```tsx
const mockDbGetAllAsync = jest.fn();
```

Ein leerer Jest-Mock liefert standardmäßig `undefined`. Der Hook erwartete aber eine Liste, und TanStack Query akzeptiert kein `undefined` als erfolgreiches Query-Ergebnis.

Korrektur:

```tsx
const mockDbGetAllAsync = jest.fn().mockResolvedValue([]);
```

Zusätzlich im `beforeEach`:

```tsx
mockDbGetAllAsync.mockResolvedValue([]);
```

Lernpunkt: Mocks sollten denselben Rückgabetyp wie die echte Funktion liefern:

- Listenabfrage → `[]`
- einzelner optionaler Datensatz → `null`
- asynchrone Aktion ohne Ergebnis → `Promise.resolve(undefined)`
- Mutationsergebnis → realistisches Objekt

---

### 6. Fehlende Provider oder fehlende Hook-Isolation

Der Onboarding-Komponententest verwendete echte PostHog-Feature-Flag-Hooks, ohne einen PostHog-Provider bereitzustellen.

Da der Test nicht PostHog prüfen sollte, wurde der Hook isoliert:

```tsx
jest.mock('@/lib/posthog', () => ({
  useFeatureFlag: (_key: string, defaultValue: boolean) => defaultValue,
}));
```

Ein ähnliches Problem gab es im Settings-Test: Dort startete `useFabPosition()` eine echte asynchrone AsyncStorage-Query.

Korrektur:

```tsx
jest.mock('@/features/navigation/fab-position-settings', () => ({
  DEFAULT_FAB_POSITION: 'right',
  useFabPosition: () => ({ data: 'right' }),
  useSetFabPosition: () => jest.fn(),
}));
```

Lernpunkt: Ein kleiner Komponententest sollte keine fremde Infrastruktur starten, die für seine Testaussage irrelevant ist.

---

### 7. `VirtualizedList` führte verzögerte Updates aus

`FlatList` und `SectionList` verwenden intern `VirtualizedList`. Diese plant ein Zellen-Layout ungefähr 50 ms später.

Dadurch entstand nach dem eigentlichen Test noch ein React-Update außerhalb von `act(...)`.

Die Lösung waren kontrollierte Fake Timer:

```tsx
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(async () => {
  await act(() => {
    jest.runOnlyPendingTimers();
  });

  jest.useRealTimers();
});
```

Nach dem Öffnen der Liste:

```tsx
await fireEvent.press(storeCard);

await act(() => {
  jest.advanceTimersByTime(60);
});
```

Lernpunkt: Nicht jede `act`-Warnung wird direkt durch den eigenen State-Code ausgelöst. React-Native-Listen, Animationen und andere Komponenten können interne Timer verwenden.

---

### 8. Fake Timer wurden nicht React-konform weitergeschaltet

Beim damaligen Verifizierungs-Banner (heute `EmailVerificationPanel`) liefen mehrere Dinge gleichzeitig:

- Animationen
- ein 3-Sekunden-Session-Poll
- ein 15-Sekunden-Server-Poll
- Cooldown-Timer

Das Weiterstellen der Zeit musste innerhalb von `act(...)` erfolgen:

```tsx
async function advanceFakeTimersByTime(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}
```

Anschließend:

```tsx
await advanceFakeTimersByTime(15_000);
```

Das war zugleich schneller als die vorherige Verwendung von `advanceTimersByTimeAsync`, weil nicht zwischen jedem einzelnen Animations- und Polling-Timer unnötig viele Mikroaufgaben abgearbeitet wurden.

---

### 9. TanStack-Cache-Timer hielten Jest offen

Viele Tests erstellten eigene QueryClients:

```tsx
new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});
```

Nach dem Unmount plante TanStack Query Cache-Aufräumarbeiten. Diese Timer konnten Jest offenhalten.

Für Testclients verwenden wir nun:

```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: Number.POSITIVE_INFINITY,
    },
    mutations: {
      retry: false,
      gcTime: Number.POSITIVE_INFINITY,
    },
  },
});
```

Lernpunkt: Für Unit-Tests braucht der Cache keinen zeitgesteuerten Garbage Collector. Jeder Test bekommt ohnehin einen neuen oder kontrollierten QueryClient.

---

### 10. Das echte Sentry-SDK startete beim Import einen Intervall-Timer

Der letzte offene Handle kam eindeutig aus:

```text
AsyncExpiringMap.startCleanup
@sentry/react-native
```

Der Haushalt-Bootstrap-Test importierte indirekt `sync-runner`, dieser wiederum `@/lib/sentry`. Bereits der Modulimport des echten Sentry-SDKs startete einen dauerhaften Cleanup-Timer.

Da der Test nicht Sentry prüft, wurde es isoliert:

```tsx
jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureMessage: jest.fn(),
  },
}));
```

Lernpunkt: SDKs können bereits beim Import Nebenwirkungen auslösen. In Unit-Tests sollten Analytics-, Monitoring-, Netzwerk- und native SDKs normalerweise gemockt werden.

---

### 11. Erwartete Konsolenwarnungen wurden nicht abgefangen

Einige Tests lösten absichtlich Fehlerfälle aus:

- PostHog-Key fehlt
- Sentry-DSN fehlt
- Synchronisierung schlägt offline fehl

Die Produktivlogik durfte dabei warnen. Der Test sollte diese Warnung aber ausdrücklich prüfen:

```tsx
const consoleWarn = jest
  .spyOn(console, 'warn')
  .mockImplementation(() => {});

await operation();

expect(consoleWarn).toHaveBeenCalledWith(
  expect.stringContaining('offline'),
);
```

Danach:

```tsx
afterEach(() => {
  jest.restoreAllMocks();
});
```

Lernpunkt: Eine erwartete Warnung sollte Teil der Assertion sein. Sie einfach in der Testausgabe stehen zu lassen, verdeckt später neue, unerwartete Warnungen.

## Häufige Fehler beim Erstellen neuer Tests

### Testdaten stimmen nicht mit dem echten Typ überein

Testdaten sollten möglichst typisiert werden:

```tsx
const template: RecipeTemplateDetail = {
  // ...
};
```

So erkennt TypeScript sofort:

- fehlende IDs
- veraltete Feldnamen
- falsche Null-Werte
- zusätzliche, nicht mehr gültige Felder

Ungetypte Testobjekte können lange grün bleiben und trotzdem unrealistisch sein.

### Zu stark vereinfachte Komponenten-Mocks

Problematisch:

```tsx
return [children, actions];
```

Besser ist ein Mock, der sich strukturell wie eine React-Komponente verhält:

```tsx
return <>{children}{actions}</>;
```

Der Mock muss nicht das ganze Original nachbauen, aber er sollte gültiges React zurückgeben.

### Assertions erfolgen zu früh

Nicht nur auf die Aktion warten:

```tsx
await fireEvent.press(button);
```

Sondern anschließend auf das sichtbare Ergebnis:

```tsx
expect(await screen.findByText('Gespeichert')).toBeTruthy();
```

Bei Hooks:

```tsx
await waitFor(() => {
  expect(result.current.isSuccess).toBe(true);
});
```

### `waitFor` wird für einfache Elementsuche verwendet

Statt:

```tsx
await waitFor(() => {
  expect(screen.getByText('Bananen')).toBeTruthy();
});
```

ist dies verständlicher:

```tsx
expect(await screen.findByText('Bananen')).toBeTruthy();
```

`waitFor` ist besser für Zustände und Mock-Assertions geeignet.

### Fake Timer werden zurückgesetzt, bevor Komponenten unmounten

Vor `jest.useRealTimers()` sollten ausstehende Fake Timer innerhalb von `act` abgearbeitet werden:

```tsx
afterEach(async () => {
  await act(() => {
    jest.runOnlyPendingTimers();
  });

  jest.useRealTimers();
});
```

### Ein Test lädt unnötig die halbe App

Wenn nur ein bestimmter Flow-Zustand geprüft wird, dürfen spätere, irrelevante Schritte leichtgewichtig gemockt werden. Wichtig ist, dass der Teil, dessen Verhalten geprüft wird, echt bleibt.

Beim Onboarding-Test blieben beispielsweise echt:

- Welcome-Carousel
- Account-Formular
- Pending-Auth-Banner
- Auth-Listener
- doppelte Auth-Auslösung
- zentrale Schrittsteuerung

Nur spätere Formulare wurden gemockt.

### `--forceExit` verdeckt offene Handles

`--forceExit` beendet Jest gewaltsam und versteckt dadurch:

- laufende Intervalle
- offene Server oder Sockets
- SDK-Cleanup-Timer
- TanStack-GC-Timer
- fehlendes Komponenten-Cleanup

Dass du `--forceExit` entfernt hast, war deshalb wichtig. Erst dadurch wurde der Sentry-Timer eindeutig sichtbar.

## Praktische Checkliste für neue Tests

Vor Abschluss eines Tests prüfen:

- Werden `render`, `renderHook`, `fireEvent`, `userEvent` und `act` korrekt abgewartet?
- Wartet der Test auf den sichtbaren Endzustand?
- Liefern asynchrone Mocks realistische Werte statt `undefined`?
- Sind Testobjekte mit den echten Typen typisiert?
- Besitzt jedes gemappte Element eine stabile ID?
- Werden fremde SDKs und irrelevante Hooks isoliert?
- Verwendet ein Test-QueryClient `retry: false` und `gcTime: Infinity`?
- Werden Fake Timer in `afterEach` geleert und zurückgesetzt?
- Werden erwartete `console.warn`/`console.error` abgefangen und geprüft?
- Beendet Jest den Lauf selbstständig, ohne `--forceExit`?
- Bleibt die Konsole auch bei bestandenen Tests vollständig sauber?

Der wichtigste Grundsatz ist: Ein bestandener Test ist noch nicht automatisch ein sauberer Test. Erst wenn er ohne Warnungen, offene Handles und erzwungenes Beenden läuft, kann man sich auf sein Ergebnis wirklich verlassen.
