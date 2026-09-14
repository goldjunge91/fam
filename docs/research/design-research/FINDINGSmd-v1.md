# Inventar-Redesign: Innovative visuelle Referenzen & Onboarding-Patterns

---

## Cycle 000 — Konkrete Design-Referenzen & Cold-Start / Onboarding-Patterns

**Sub-Frage:** Welche konkreten visuellen Design-Referenzen existieren für Urgency-first Food-Inventar — und welche Onboarding-Patterns lösen das Cold-Start-Problem am effektivsten?

### Vier direkt verwertbare Design-Referenzen

**1. Eatable App (UX Case Study, Cathy Zhao)** — [Link](https://cathyzhao.squarespace.com/eatableapp/)
User-getestetes Urgency-first-Tab-Konzept. Wichtigstes Feedback aus Nutzertests: *"People don't care about storage location and more care about the expiry date. The top bar may be used for Expired, Hurry, and Fresh replacements."*
→ Direkte Bestätigung des Tab-Konzepts (Jetzt verwenden / Diese Woche / OK) durch echte Nutzer.

**2. Blūm App (UX Capstone, Florentina Audrina, Nov 2025–Jan 2026)** — [Link](https://crow-ferret-8f3z.squarespace.com/uiux-design/blum)
Vollständig usability-getestete (2 Runden) Food-Waste-App, die den Onboarding-Flow explizit optimiert hat:
- **Receipt Upload als primäre Eingabe** (filled CTA) + Add Manually als sekundäre Option (outline) — ohne diese Hierarchie wählten Nutzer den aufwändigen manuellen Weg
- **AI-Ablaufdatum-Schätzung** aus Kassenbon: kein Formular, nur Review
- **Streak auf dem Home Screen sichtbar** (nicht versteckt in einem Tab) — erst dann Verhaltensänderung
- Messbares Ergebnis: Logging-Zeit −42%, Engagement +80%, Pantry-Awareness-Vertrauen +48%

**3. Stockpile Inventory Template (Sleek.design)** — [Link](https://sleek.design/es/templates/inventory-app)
Visuelle Metasprache aus Warehouse-Kontext, die sich direkt übersetzen lässt: **Stock Health Bar** — ein einzelnes UI-Element, das den Lagerzustand kommuniziert (grün = OK, amber = Schwellwert unterschritten). Das Element kehrt auf Dashboard, jeder Listenzeile und der Detailansicht wieder — ein einziger Blick reicht.
→ Direktes Mapping auf den Haushalt-Score Banner: dasselbe Prinzip, andere Domäne.

**4. Cooklist (ScreensDesign)** — [Link](https://screensdesign.com/apps/cooklist-pantry-meals-recipes/)
Einzige bekannte App, die das Cold-Start-Problem durch **Loyalty-Card-Sync** löst: Supermarkt-Treuekarten werden verknüpft und importieren die Kaufhistorie automatisch. Ergebnis: Vorrat ist beim ersten Start nicht leer.
→ Für das eigene Produkt: der Kassenbon-Scan beim Einkaufen über die eigene Einkaufsliste hat dieselbe Wirkung.

### Cold-Start: Priorisierte Eingabe-Hierarchie (Blūm-Erkenntnis)

```
Receipt Upload  →  [Primary CTA — filled, farbig]
Barcode Scan    →  [Secondary — outline]
Manuell         →  [Tertiary — text-only, nicht prominent]
```

Ohne diese Hierarchie wählen Nutzer intuitiv den manuellen Weg — und brechen nach dem dritten Item ab (bestätigt durch Your Food's eigener Marktforschung und Blūm-Usertests).

### Schlüssel-Insight
Der effektivste Cold-Start ist der automatische Import (Receipt-Scan / Loyalty-Card). Für das eigene Produkt löst der Einkaufsliste→Kassenbon-Flow dieses Problem bereits strukturell — das muss im Onboarding explizit kommuniziert werden: *"Scanne deinen Kassenbon nach dem Einkauf — dein Vorrat füllt sich automatisch."*

**Quellen:** [Eatable UX Case Study](https://cathyzhao.squarespace.com/eatableapp/), [Blūm App Design 2025–26](https://crow-ferret-8f3z.squarespace.com/uiux-design/blum), [Stockpile Template](https://sleek.design/es/templates/inventory-app), [Tokki Behance](http://portfolios.scad.edu/asset/536071/Tokki---Fight-Food-Waste-App-UI-Kit), [Cooklist ScreensDesign](https://screensdesign.com/apps/cooklist-pantry-meals-recipes/)

---

## Cycle 001 — Push-Notification-Design: Timing, Framing & Permission-UX

**Sub-Frage:** Was funktioniert bei Push-Notifications für Ablaufdatum-Alerts, was nervt — und wie gestaltet man den Opt-in-Flow?

### Kernerkenntnisse (stark — 2 unabhängige Quellen 2026)

**1. Timing schlägt Copywriting**
Der richtige Moment für den Permission-Ask: **direkt nach dem ersten Kassenbon-Scan** — Nutzer hat gerade Produkte eingescannt, der Wert ist unmittelbar. Erster App-Start ist immer zu früh; kein Kontext = kein Ja.

**2. 2-Stufen-Opt-in (Soft-Ask → OS-Prompt)**
```
Kassenbon gescannt
    ↓
In-App-Karte: "Soll ich dich erinnern, bevor Produkte ablaufen?"
    ↓ Ja               ↓ Nein
OS Permission       App funktioniert normal
                    In-App-Badge zeigt trotzdem dringende Produkte
```
Wichtig: OS-Prompt **nur** nach Ja auslösen. Sonst lernen Nutzer dem UI nicht zu vertrauen.

**3. Positives Framing — nie Schuldgefühle**
- ✅ *"Noch 2 Tage — heute ideal für eine Frittata mit Eiern und Tomaten"*
- ❌ *"Achtung! Deine Eier laufen morgen ab!"* — löst Stress aus, keine Handlung

Appbot-Auswertung tausender App-Reviews: Copy die sich "stressig und aggressiv" anfühlt führt direkt zur Deinstallation.

**4. Kategorie-Kontrolle (kein einziger Toggle)**
3 separate Toggles in den Einstellungen:
- Ablaufdatum-Alerts (Standard: an)
- Rezeptvorschläge basierend auf ablaufenden Produkten (Standard: an)
- Wochenbericht / Streak (Standard: aus — optional)

Ein einziger On/Off-Toggle → Nutzer deaktivieren alles, weil sie Streak-Spam vermeiden wollen.

**5. Frequenz-Disziplin**
- Max. 1 Notification/Tag, auch wenn 10 Produkte ablaufen → **konsolidieren**: *"3 Produkte laufen bald ab"*
- Eskalation: 3-Tage-Hinweis einmal, 1-Tag-Hinweis einmal — kein tägliches Ping
- Keine Notifications 22:00–08:00

**6. Fallback wenn kein Opt-in**
In-App-Badge auf dem "Jetzt verwenden 🔴"-Tab zeigt Anzahl dringender Produkte. In-App-Inbox (Bell-Icon) zeigt alle Hinweise innerhalb der App — kein Dead End für Nutzer, die Nein gesagt haben.

### Schlüssel-Insight
Notifications sind Teil des Produkt-UX — nicht ein Growth-Taktik am Ende des Funnels. Die Formel: **richtiger Moment + konkreter Nutzen + positive Sprache + Nutzerkontrolle** = Notifications die sich wie Hilfe anfühlen, nicht wie Lärm.

**Quellen:** [Appbot Push Notification Best Practices 2026](https://appbot.co/blog/app-push-notifications-2026-best-practices/), [AppMaster Permission UX Guide 2026](http://appmaster.io/blog/push-notification-permission-ux)

---

## Research State

**Beantwortet (aus parent_findings.md, Campaign b40d41a5):**
- ✅ Konkurrenz-UX-Patterns und Schwachstellen (Cycle 000 parent)
- ✅ Innovative Paradigmen aus anderen Kategorien — 4 übertragbare Konzepte (Cycle 001 parent)
- ✅ Konkretes 3-Layer-Design-Konzept (Cycle 002 parent)
- ✅ Executive Summary & Empfehlung (Cycle 003 parent)
- ✅ Rezept-Nudge + Konsum-Micro-Interactions + Waste-Tracking-Framing (Cycle 004 parent)

**Beantwortet (diese Kampagne):**
- ✅ Cycle 000: Konkrete visuelle Design-Referenzen + Cold-Start/Onboarding-Patterns (moderate Evidenz)
- ✅ Cycle 001: Push-Notification-Design — Timing, Framing, Permission-UX, Kategorie-Kontrolle (starke Evidenz, 2 Quellen)

**Offen (2 Cycles verbleibend):**
- ❓ Household-Sharing-Patterns — wie synchronisieren Familien den Vorrat effektiv? (Konflikt: wer hat was verbraucht?)
- ❓ Emergenter Lead: Home-Screen-Widgets für Ablaufdaten (iOS/Android) — wie weit verbreitet, wie gut?

**Dead-ends:**
- Tokki (Behance) — Kit gefunden, aber Inhalt hinter Paywall
- Dribbble search/food-app: überwiegend Delivery-Apps, kaum Inventar-Fokus
