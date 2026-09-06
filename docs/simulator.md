# iOS Simulator

Für die tägliche Entwicklung den Debug-Development-Build starten:

```bash
bun run native:dev -- --target ios-development-simulator
```

Optional kann ein bestimmtes Gerät gewählt werden:

```bash
bun run native:dev -- --target ios-development-simulator --device "iPhone 17"
```

Danach Metro starten, falls der Dev-Loop es nicht bereits tut:

```bash
bun start
```

Der Development-Simulator ist nicht Teil des Native-Build-Locks. Das hält den
lokalen Dev-Loop schnell und verhindert, dass ein veraltetes Debug-Artefakt den
Release-Lock oder CI blockiert. Änderungen an nativen Modulen oder Config-
Plugins erfordern einen neuen Development-Build; reine JS-/TS-Änderungen lädt
Metro neu.
