# Referenz-Demo: act() bei rohen Callbacks & echte Timer in Jest/RNTL

Reproduziert und verifiziert zwei nicht-offensichtliche Jest/RNTL-Fallstricke
(siehe Memory `testing_rn_act_and_real_timers.md` und die entsprechende
Ergaenzung im `jest-testing`-Skill). **Nicht Teil von `bun run test`/CI** —
die Dateien heissen bewusst `*.demo.tsx` statt `*.test.tsx`, damit der
Standard-`testMatch` (`**/*.test.ts(x)`) sie ignoriert; eine der Dateien
schlaegt absichtlich fehl, um den Bug lebendig zu zeigen.

## Dateien

| Datei | Zeigt |
|---|---|
| `listener-demo.repro-sync-act.demo.tsx` | ❌ Bewusst rot: `act(() => emit(...))` (sync) flusht das State-Update aus einem rohen, per `jest.mock` gecapturten Callback nicht |
| `listener-demo.fix-async-act.demo.tsx` | ✅ Fix: `await act(async () => emit(...))` — sauber, ohne Warnung |
| `listener-demo.alt-findby-warns.demo.tsx` | ⚠️ Alternative: `findByText` ohne jedes `act()` besteht zwar (Polling holt das Update irgendwann ein), aber mit React-Warnung "update not wrapped in act(...)" — **kein sauberer Fix**, nur zufaellig gruen |
| `polling-banner.repro-real-timers.demo.tsx` | Echte Timer sind wall-clock-gebunden: ein einzelner Assertion-Check braucht hier nachweislich >450ms echte Zeit |
| `polling-banner.fix-fake-timers.demo.tsx` | Fix: `jest.useFakeTimers()` + `advanceTimersByTimeAsync()` (in `act()`), Cleanup mit `runOnlyPendingTimers()` vor `useRealTimers()` |

## Manuell ausfuehren

```bash
npx jest --config test/examples/act-and-real-timers-demo/jest.demo.config.js
```

Erwartet: 1 fehlgeschlagen (REPRODUKTION), 4 bestanden.

## Quellen

- https://oss.callstack.com/react-native-testing-library/docs/advanced/understanding-act
- https://testing-library.com/docs/using-fake-timers/
- https://testing-library.com/docs/user-event/options/#advancetimers
- https://jestjs.io/docs/timer-mocks
- https://jestjs.io/docs/jest-object#fake-timers
