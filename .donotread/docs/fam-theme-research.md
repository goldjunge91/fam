---
title: fam — Theme-Recherche-Log (nativewind-styling)
date: 2026-09-03
---

# fam Theme-Recherche-Log

Dieses Dokument hält fest, was tatsächlich in die Token-Arbeit der
`nativewind-styling`-Initiative eingeflossen ist
(`docs/specs/nativewind-styling/SPEC-token-contract.md`) — im selben
ehrlichen Offenlegungsstil wie die früheren ui-/Pantry-Pop-Logs in
diesem Ordner (`theme-research.md`, `ui-inspiration-research.md`,
`visual-effects-research.md`, `visual-ui-inspiration-research.md`).

## Das ist kein GitHub-Crawl — die Quelle ist bekannt und lokal

Anders als die ui-Passes (die offenlegten, proprietäre Apps *nicht*
gecrawlt zu haben) hat das Referenzmaterial dieser Initiative eine
konkrete, benannte Herkunft: drei Dateien, abgelegt unter
`/Users/marco/Downloads` — `index.ts`, `ThemeProvider.tsx`, `ui.tsx` —
plus `src/lib/haptics.ts`, `src/lib/streak.ts` und `src/lib/tts.ts`, die
bereits in diesem Repo liegen, aber noch nicht verdrahtet sind (kaputte
Imports: `@shared/platform/kv`, `../../store`, `~/theme`). In den
Spec-Dokumenten werden diese informell "ui" genannt, nach dem
Schwesterprojekt, aus dem sie stammen. `docs/specs/nativewind-styling/CAPABILITY_MAP.md`
hält das explizit unter "Quellen und Einordnung" fest.

Dieses Log ist also ein **Herkunfts-/Adaptions-Audit**, keine
Wettbewerbsanalyse.

## Was übernommen und was verworfen wurde

| Referenzkonzept | Entscheidung | Warum |
| --- | --- | --- |
| Waivys Provider-Form (`useTheme()`, `useThemedStyles()`) | Übernommen | Löst ein reales Problem: fam hat aktuell keine einzige Runtime-Theme-Quelle (`SPEC-theme-runtime.md`) |
| Waivys `ui.tsx`-Komponentenoberfläche (`Button`, `Card`, `Field`, `Press`, `SegmentedControl` ...) | Übernommen, neu auf Fam-Tokens ausgerichtet | Die *Vertragsform* ist nützlich; die dahinterliegende Palette nicht |
| Waivys Hex-Palette (Basil-Grün, Karotte, Traube usw.) | **Vollständig verworfen** | fam hat bereits eine etablierte warme Mauve-/Creme-Palette (`src/constants/theme.ts`, Light+Dark, dokumentiert in `docs/DESIGN_SYSTEM.md`). `CAPABILITY_MAP.md` nennt das als expliziten Nicht-Zweck: "Übernahme der ui-Farben ..." ist außerhalb des Scopes |
| `useKVRaw` / `srf:settings-theme`-Storage | Verworfen, ersetzt | fam hat bereits eine MMKV-Device-Storage-Schicht (`src/lib/storage/device-storage.ts`); kein Grund, für eine einzelne UI-Präferenz eine zweite KV-Primitive einzuführen |
| `BUTTON_DEPTH` (3D-Press-Tiefe) | Als bestehendes Referenzverhalten übernommen, aber noch nicht neu bewertet | `SPEC-token-contract.md` verschiebt eine visuelle Entscheidung dazu ausdrücklich auf nach den zwei Screen-Mocks — dieses Log greift dieser Entscheidung nicht vor |

## fams tatsächliche Palette (kanonisch, von dieser Initiative unverändert)

Aus `src/constants/theme.ts` — das ist die Wahrheit, die der neue
Token-Vertrag umschließt, kein neues Design:

```
Light
  text:               #2D2830
  background:         #F8F4EF
  backgroundElement:  #FBF7F2
  backgroundSelected: #E9E1E7
  textSecondary:      #786F79
  border:             #E4DDE3
  accent:             #705773
  success:            #78906F
  warning:            #C69059
  danger:             #C65F50

Dark
  text:               #F2ECE7
  background:         #211D23
  backgroundElement:  #2B262E
  backgroundSelected: #382F3B
  textSecondary:      #B7ADB3
  border:              #3E3640
  accent:              #B79CBA
  success:             #8FAE86
  warning:             #D9A86C
  danger:              #D9776A
```

Mauve-/Violett-Basis, warme Neutraltöne, entsättigte Statusfarben, die sich
nie allein auf den Farbton verlassen (siehe den Codekommentar zu
`success`/`warning`/`danger` in `theme.ts` bzgl. Barrierefreiheit für
Farbfehlsichtige). An dieser Stelle wird durch die
nativewind-styling-Spezifikation nichts vorgeschlagen oder geändert —
`SPEC-token-contract.md` verbietet es, ui-Hexwerte irgendwo als
Fallback in Production-Defaults einzubauen.

## Zuordnung Referenz → fam-Token

Gemäß `SPEC-token-contract.md` werden die ui-Referenznamen auf
bestehende Fam-Tokens abgebildet statt wortwörtlich übernommen:

| ui-Referenzname | fam-Token | Unverändert übernommen? |
| --- | --- | --- |
| `bg` | `background` | Nur umbenannt |
| `surface` | `backgroundElement` | Nur umbenannt |
| `surfaceSoft` | `backgroundSelected` (bzw. dokumentierte Ableitung) | Nur umbenannt |
| `text` | `text` | Gleicher Name |
| `textMuted` | `textSecondary` | Nur umbenannt |
| `border` | `border` | Gleicher Name |
| `basil` / andere ui-Akzente | **nicht übernommen** | stattdessen `accent`, `success`, `warning`, `danger` aus fam |
| `scrim` | dokumentierte Fam-Ableitung über `withAlpha()` | Abgeleitet, nicht hartkodiert |

## Von den ui-Quelldateien referenzierte Repos (transitiv, ungeprüft)

Die ui-Dateien selbst tragen Kommentare, die auf Duolingo-artige
Muster hindeuten (siehe `fam-ui-inspiration-research.md`) und referenzieren
ein `@shared/platform/kv`-Modul, das in fam nicht existiert. Für diese
Passe wurde kein Repo über die drei lokalen Referenzdateien und fams
eigenen Baum hinaus konsultiert. Zieht eine künftige Passe tatsächlich
eine externe Abhängigkeit ein, bekommt sie hier eine Zeile mit URL,
Lizenz und was übernommen wurde — bisher existiert keine.

## Was umgesetzt vs. zurückgestellt ist

**In der Spec, in dieser Passe aber noch nicht implementiert:**

- `SPEC-token-contract.md` — vollständiger Token-Vertrag (vollständig spezifiziert)
- `SPEC-theme-runtime.md` — Provider- und `useThemedStyles()`-Vertrag
- `SPEC-typography-contract.md` — `Txt`-Rollentabelle, Migration alt→neu
- `SPEC-component-contract.md` — `Surface`-/`Card`-/`Button`-/`Field`-Verträge
- `SPEC-native-boundaries.md` — Regeln für die Grenze className vs. StyleSheet
- `SPEC-verification-matrix.md` — automatisierte + manuelle Abnahmematrix

**Laut `CAPABILITY_MAP.md` explizit außerhalb des Scopes:**

- Wechsel zu Uniwind, Unistyles oder Tamagui
- Jede ui-Farbe (Basil, Karotte, Traube, Pantry-Pop-Palette)
- Neue native Styling-Abhängigkeiten
- Eine zweite parallele Theme-API
- Ein vollständiges visuelles Redesign
- Geräteprüfung (iOS/Android) — ausdrücklich als außerhalb dieses
  Spec-Scopes benannt; nur statische/automatisierte Prüfungen + zwei
  Screen-Mocks sind im Scope

## Ehrliche Lücke: `tts.ts` gehört nicht dazu, kam aber im selben Schwung mit

`src/lib/tts.ts` (ElevenLabs + `expo-speech`-Fallback für die
geführte Koch-Erzählung) kam zusammen mit den Theme-Dateien an und teilt
deren kaputten `@shared/platform/kv`-Import, ist aber **nicht Teil der
nativewind-styling-Initiative** — es ist ein anderes Feature (Audio, nicht
visuelles Styling), das zufällig denselben Import-Pfad-Fix braucht. Nicht
stillschweigend ignoriert, nur hier außerhalb des Scopes; separat verfolgt.
