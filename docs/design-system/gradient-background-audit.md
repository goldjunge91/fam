# Audit: `GradientBackground`-Farbstopps

> Bestandsaufnahme für Issue [#122](https://github.com/goldjunge91/fam/issues/122)
> (Design-System). **Umgesetzt (2026-08-16): alle 17 Render-Fundstellen in
> 12 Screen-Komponenten nutzen jetzt `Gradients.hub`.** Der Token hält Farben
> und Stop-Positionen der Variante B zentral. A und C sind Geschichte, D
> bleibt bewusster Sonderfall. Details unten. **Weiterhin offen:** die 10
> Screens mit manuellem `<GradientBackground>` bauen ihre
> Struktur (Safe Area, `PageHeader`, Breite) noch selbst statt `<Screen>`
> zu nutzen — nur die Farbe ist vereinheitlicht, s. `docs/DESIGN_SYSTEM.md`
> Abschnitt 6, Punkt 1.

Historische und aktuelle Fundstellen von `<GradientBackground>` bzw.
`<Screen backgroundGradient>`, Stand dieses Audits (`git grep`, keine
Testdateien). Die früher duplizierten Arrays sind inzwischen durch
`Gradients.hub` ersetzt.

## Variante A — bisher meistverwendet, jetzt auf B umgestellt (war 15 Fundstellen)

```
['#FFD2B9', '#F8F4EF', '#EEE7F4']
```

| Datei | Zeile(n) | Screen |
| --- | --- | --- |
| `src/features/calorie-tracking/diary-screen.tsx` | 249 | Tagebuch |
| `src/features/recipe-templates/recipe-template-detail-screen.tsx` | 117, 139 | Rezeptvorlage-Detail (2×, vermutlich Loading- + Erfolgs-Zustand) |
| `src/features/settings/settings-screen.tsx` | 74 | Einstellungen |
| `src/features/recipes/recipes-screen.tsx` | 289 | Rezepte-Übersicht |
| `src/features/recipes/cooking-mode-screen.tsx` | 125, 230, 267, 329 | Kochmodus (4×, mehrere interne Zustände) |
| `src/features/recipes/recipe-log-screen.tsx` | 131 | Rezept ins Tagebuch loggen |
| `src/features/recipes/recipe-create-screen.tsx` | 608 | Rezept erstellen/bearbeiten |
| `src/features/recipes/recipe-detail-screen.tsx` | 307, 337 | Rezept-Detail (2×) |
| `src/features/meal-planner/meal-planner-screen.tsx` | 234 | Essensplan |
| `src/features/premium/premium-screen.tsx` | 91 | Premium (äußerer Verlauf) |

→ War bislang die am häufigsten verwendete Kombination — jetzt Geschichte:
alle 15 Fundstellen sind auf Variante B migriert.

## Variante B — Standard für alle Hub-Screens (jetzt 17 Fundstellen)

```
['#FFCCB2', '#F9F2EB', '#E8DEF2']
```

| Datei | Zeile | Screen |
| --- | --- | --- |
| `src/features/dashboard/dashboard-screen.tsx` | 124 | Übersicht |
| `src/features/fridge/fridge-screen.tsx` | 150 | Vorrat (war Variante C) |
| alle 15 A-Fundstellen (oben) | — | Rezepte, Kochmodus, Tagebuch, Einstellungen, Essensplan, Premium, … |

**Umgesetzt:** der eine Verlauf für alle Hub-Screens — 17 von 17. Das Array
steht nur noch einmal in `Gradients.hub`; die 17 Verbraucher referenzieren
den Token.

## Variante C — Vorrat, jetzt auf B umgestellt (war 1 Fundstelle)

```
['#FFD8C5', '#F8F4F0', '#EEE8F4']
```

War nah an A/B, aber eigene, leicht abweichende Werte — jetzt wie A auf B
vereinheitlicht.

## Variante D — Premium-Karte, intern (1 Fundstelle, bewusst anders)

```
['#705573', '#c38b75']
```

| Datei | Zeile | Kontext |
| --- | --- | --- |
| `src/features/premium/premium-screen.tsx` | 102 | Zweiter, innerer Verlauf auf einer Karte *innerhalb* des Screens (Mauve → Gold), nicht der Screen-Hintergrund |

Nur 2 Stopps statt 3, klar andere Farbfamilie (dunkles Mauve → Gold statt
warmes Pfirsich/Creme/Flieder) — sieht nach bewusstem Sonderfall für die
Premium-Badge-Optik aus, nicht nach Drift.

## Zusammenfassung

- **B ist der einzige Hub-Verlauf.** Farben und Stop-Positionen liegen in
  `Gradients.hub`; alle 17 Fundstellen in 12 Screen-Komponenten verwenden
  den Token. Es gab keine strukturellen Änderungen an den Screens.
- **Noch offen, bewusst nicht Teil dieser Migration:** die 10 Screens, die
  `<GradientBackground>` manuell statt über `Screen`s
  `backgroundGradient`-Prop einbinden, bauen ihre Struktur (Safe Area,
  `PageHeader`, Breite) weiterhin selbst nach — Migrations-Backlog-Punkt 1
  aus `docs/DESIGN_SYSTEM.md`. Die Essensplaner-V2 ist strukturell auf
  `Screen` umgestellt und im Simulator geprüft; sie dient jetzt als Vorlage
  für die übrigen Screens.
- **D bleibt ein eigenständiger Fall** (Innenkarte, andere Farbfamilie, nur 2
  Stopps) — kein Kandidat für Konsolidierung mit B.

## Verwandter Fund: Schattenfarben (`shadowColor` / `boxShadow`) — erledigt

Gleiches Muster wie bei den Gradients: durchweg Hex/RGBA-Literale statt
Tokens, in zwei erkennbaren Clustern plus drei `#000`-Ausreißern:

| Farbfamilie | Fundstellen (Auswahl) |
| --- | --- |
| `rgba(41–46, 28–36, 43–61, …)` — dunkles Mauve/Violett | `navigation-drawer.tsx`, `quick-add-sheet.tsx`, `profile-sheet.tsx`, `edit-fridge-item-sheet.tsx`, `fridge-item-actions-sheet.tsx`, `fridge-tab-bar.tsx`, `product-information.tsx`, `floating-action-button.tsx` |
| `rgba(84–89, 59–74, 88–106, …)` — helleres Mauve | `dashboard-screen.tsx` (2×), `fridge-screen.tsx`, `fridge-summary-card.tsx`, `card.tsx` (`shadowColor: '#594059'`), `segmented-control.tsx` |
| `#000` pur — **entfernt** | ~~`pending-auth-banner.tsx`, `product-search-dropdown.tsx`, `week-grid.tsx`~~ |

**Umgesetzt (2026-08-16):** `Colors.light`/`Colors.dark` haben jetzt
`shadowCard` (`#594059`, helleres Mauve — Karten auf Screen-Hintergrund) und
`shadowSheet` (`#2A1F2C`, dunkles Mauve/Violett — Sheets/Overlays/Dropdowns),
je aus dem Mittelwert des jeweiligen Clusters. Ein neuer `withAlpha(hex,
alpha)`-Helper in `theme.ts` erlaubt, den Farbton mit variabler Deckkraft in
`boxShadow`-Strings einzusetzen. **13 der 15 verbliebenen Fundstellen sind
migriert** (die drei `#000`-Ausreißer plus alle `rgba(...)`-Literale beider
Cluster): `quick-add-sheet.tsx`, `profile-sheet.tsx`, `fridge-screen.tsx`,
`fridge-tab-bar.tsx`, `fridge-summary-card.tsx`, `edit-fridge-item-sheet.tsx`,
`fridge-item-actions-sheet.tsx`, `product-information.tsx`,
`floating-action-button.tsx`, `segmented-control.tsx`, `dashboard-screen.tsx`
(2×), `card.tsx`.

**Bewusst nicht migriert (2 Fälle):** `premium-promo-card.tsx`
(`rgba(103,74,106,.2)`) und `navigation-drawer.tsx`
(`rgba(41, 31, 43, 0.18)`). Beide Komponenten sind fast vollständig
hartcodiert gestylt (Hintergrundfarben, Verläufe, Textfarben — nicht nur der
Schatten laufen nicht über `useTheme()`), oft mit explizitem Verweis auf ein
1:1 aus Figma übernommenes Mockup. Nur den Schatten zu tokenisieren und den
Rest hartcodiert zu lassen wäre eine inkonsistente Teilkorrektur — beide
brauchen stattdessen eine vollständige Theme-Anbindung, kein isolierter
Schatten-Fix. Vorgemerkt als eigener, größerer Posten.

## Nächster Schritt

Gradient- und Schattenfarben-Migration sind abgeschlossen. Die separate
Essensplaner-V2 belegt das Zielmuster. Offen bleiben ihre Übernahme als
regulärer Essensplaner, die anschließende strukturelle `Screen`-Migration der
übrigen betroffenen Screens sowie die volle Theme-Anbindung von
`premium-promo-card.tsx`/`navigation-drawer.tsx`.
