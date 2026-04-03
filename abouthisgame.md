# SCS Play — Vollständige Spielbeschreibung

> Stand: April 2026 · v22 — Aktualisiert nach vollständiger Implementierung aller 9 Verbesserungsphasen.

---

## Inhaltsverzeichnis

1. [Übersicht](#1-übersicht)
2. [Technische Architektur](#2-technische-architektur)
3. [Screens & Navigation](#3-screens--navigation)
4. [Die 14 Spielmodi](#4-die-14-spielmodi)
5. [Die 4 Spieltypen](#5-die-4-spieltypen)
6. [Scoring-System](#6-scoring-system)
7. [Visuelle Effekte](#7-visuelle-effekte)
8. [Audio-System](#8-audio-system)
9. [XP & Progressions-System](#9-xp--progressions-system)
10. [Achievements (1000+)](#10-achievements-1000)
11. [Economy — Leben, Feuer & Shop](#11-economy--leben-feuer--shop)
12. [Daily Challenge & Glücksrad](#12-daily-challenge--glücksrad)
13. [Competition-Modus](#13-competition-modus)
14. [Eingabe & Gesten](#14-eingabe--gesten)
15. [Speicher & Authentifizierung](#15-speicher--authentifizierung)
16. [Engagement-Tracking](#16-engagement-tracking)
17. [PWA, Android & Monetarisierung](#17-pwa-android--monetarisierung)
18. [Design-System & CSS](#18-design-system--css)

---

## 1. Übersicht

**SCS Play** ist ein mobiles Reflex- und Kognitionsspiel, das als Progressive Web App (PWA) und native Android-App (via Capacitor) ausgeliefert wird. Der Spieler wischt oder tippt auf farbige Formen, löst Rechenaufgaben, beantwortet Quizfragen und trainiert kognitive Fähigkeiten wie Arbeitsgedächtnis, Inhibition und selektive Aufmerksamkeit.

| Eigenschaft | Wert |
|-------------|------|
| Spieltyp | Reflex / Kognition / Mobile |
| Plattformen | Web (PWA), Android (Capacitor) |
| Sprachen | Deutsch + Englisch (vollständig lokalisiert) |
| Authentifizierung | Google, Apple, E-Mail (Firebase) oder Gast (localStorage) |
| Spielmodi | 14 |
| Spieltypen | 4 |
| Achievements | 1000+ (template-basiert generiert) |
| Speicher | localStorage + optionale Firebase Firestore Cloud-Sync |

---

## 2. Technische Architektur

### Dateistruktur

```
js/
  app.js                 — Haupt-Orchestrator, instanziiert alle Services, bindet globale Events
  appState.js            — Zentrales State-Singleton (wird nie neu zugewiesen, nur gemutiert)
  config.js              — Alle Konstanten, Timings, Inhaltsbanken, Shapes, Themes, Trails
  audio.js               — Prozedurale 3-Schichten-Musik + alle synthetischen SFX
  auth.js                — Firebase Auth + Gast-Modus
  effects.js             — Canvas-Trails, Partikel, Screen-Shake, Ambient
  i18n.js                — 300+ UI-Strings (DE/EN), parametrierbar mit {n}/{mode}/{pt}
  input.js               — SwipeHandler: 4/8/12-Wege-Gesten, Tap-Hit-Test
  save.js                — Lade/Speicher-System, XP, Achievements, Cloud-Sync
  game/
    GameEngine.js        — Spiellogik-Zustandsmaschine, alle Modi, Spawn, Scoring, Timers
  screens/
    BootScreen.js        — Splash + Ladesequenz
    AuthScreen.js        — Login-UI
    HomeScreen.js        — Haupt-Hub, Karussell, Stats, Daily, Wheel, FAB
    TutorialScreen.js    — 4-Slide interaktives Onboarding
    GameScreen.js        — Vollbild-Spielfeld, HUD, Overlays, Trail-Canvas
    ResultsScreen.js     — XP-Ring, Stats-Grid, PB-Badge, Level-Up, Buttons
    LeaderboardScreen.js — Top-20 gefiltert nach Modus + Spieltyp
    AchievementsScreen.js— Akkordeon, 13 Kategorien
    SettingsScreen.js    — 6 Toggles, Sprache, Avatar, Report, Logout
    StoreScreen.js       — 3 Tabs: Premium IAP, Themes, Trails
    AvatarScreen.js      — Icon-Grid (16), Farb-Grid (8), Foto-Upload
    WheelScreen.js       — Tägliches Glücksrad (Canvas)
    EngagementReportScreen.js — Analyse-Dashboard
  services/
    AdService.js         — AdMob-Integration (Capacitor) + Mock-Fallback
    ShareService.js      — Viral-Cards, Web Share API, Clipboard-Fallback
    ThemeService.js      — Wechselt body-Klassen für CSS-Theme-Switching
  helpers/
    dom.js               — querySelector-Shortcuts, escHTML, safeSrc, hexToRgba
    engagementTracker.js — Passives lokales Verhaltens-Analytics
    haptics.js           — 27 Vibrationsmuster (navigator.vibrate)
    microFeedback.js     — Emoji-Feedback-Prompt (1 pro Session, 1 pro Tag)
    onboardingHints.js   — Spotlight-Overlay-Hinweise für neue Spieler
  renderers/
    avatars.js           — Inline-SVG für 16 Avatar-Icons
    shapes.js            — Inline-SVG für 12 Spielformen + Bonus-Glow-Filter
  achievements/
    AchievementSystem.js — Template-basiert, erzeugt 1000+ Achievements per Cross-Product
```

### Zentrales State-Objekt (`appState.js`)

| Property | Default | Bedeutung |
|----------|---------|-----------|
| `currentScreen` | `'boot'` | Aktiver Screen-Identifier |
| `selectedMode` | `'klassik'` | Ausgewählter Spielmodus |
| `selectedPlayType` | `'blitz'` | Ausgewählter Spieltyp |
| `colorblind` | `false` | Farbenblind-Modus aktiv |
| `sessionGames` | `0` | Spiele dieser Session |
| `sessionBest` | `0` | Bestes Ergebnis dieser Session |
| `pendingDaily` | `false` | Wird gerade Daily gespielt |
| `gameStarting` | `false` | Verhindert Doppel-Start (1500ms Gate) |
| `gameDuration` | `0` | Dauer des letzten Spiels in Sekunden |
| `lastResultStats` | `null` | Stats vom letzten Spiel |
| `continueStats` | `null` | Stats während Continue-Prompt aktiv |

### Lifecycle beim Starten der App

1. `DOMContentLoaded`
2. Error-Boundary + globale Haptics initialisieren
3. `boot(navShowHome, navShowAuth)` aufrufen (BootScreen.js)
4. Firebase Auth-Status prüfen (oder Gast laden)
5. Save-Daten laden + Cloud-Sync
6. Nach Boot: AdService, Offline-Indicator, Visibility-Pause, BackButton, Orientation-Check
7. Navigation über vorgefertigte Closure-Funktionen (`navShowHome`, `navStartGame`, etc.)

---

## 3. Screens & Navigation

### Screen-Übergänge

Alle Screens verwenden CSS-Klassen-basierte Übergänge:
- `screen-exit` → Element verschwindet (opacity, scale)
- `screen-enter` → Ziel-Screen erscheint
- Dauer: 350ms, dann Klassen entfernen
- Bei jedem Screen-Wechsel: `engagement.trackScreenVisit(id)` aufgerufen

### Boot-Screen

- Vollbild, zentriertes Logo
- **7-Buchstaben-Raster** für "SCSPLAY" — jeder Buchstabe in anderem Farbverlauf (Lila, Pink, Grün, Orange, Cyan, Orange, Rot)
- Buchstaben rotieren auf 3D-Ebene mit elastischem Überschwingen herein
- **Rotierender Ring** hinter dem Logo (2px gestrichelt, Primärfarbe, endlose Rotation)
- **4 schwebende Lichtkugeln** (80px blur, verschiedene Farben, gedämpfte Einblendung)
- Ladebalken: 240px breit, Gradient links-rechts, glühender Dot-Effekt
- Status-Text: "LOADING..." mit pulsierender Opacity
- Minimale Anzeigedauer: 2800ms (`CONFIG.BOOT_MIN_DISPLAY`)

### Auth-Screen

- Gleiche schwebende Kugeln + Buchstaben-Raster wie Boot (repositioniert)
- **"JETZT SPIELEN" / "PLAY NOW"** — Großer Primär-Button, Purple-Gradient, Glow-Schatten
- Untertitel: "Fortschritt wird lokal gespeichert" (gedämpft)
- Trennlinie: "oder einloggen"
- **Google-Button**: Blauer Gradient (#4285F4 → #2b6bdd)
- **Apple-Button**: Dunkler Gradient (#333 → #000)
- **E-Mail-Toggle**: Klappt Eingabefelder für E-Mail + Passwort auf (Glass-Morphism-Felder)
- Fehlermeldungen: Rot (#EF4444), Shake-Animation bei Auth-Fehler
- Safe-Area-Padding für Notch-Geräte

### Home-Screen

Vollbild-Split-Layout, scrollbares Bottom-Sheet:

**Top-Bereich (Hero Zone)**:
- **Top-Bar**: Links Avatar-Kreis (34px, lila Rand) + Begrüßungstext + Status-Badge. Rechts: Herz-Pill (rot) + Feuer-Pill (orange) mit Zählern
- **XP-Leiste**: Level-Zahl mit Glow, Mini-Fortschrittsbalken (4px), Prozent, Level-Name, Wochenend-Bonus-Badge
- **Hero-Karussell** (~28vh Höhe): Wischbares Modus-Karussell. Aktive Karte: volle Größe + scharf. Links/Rechts: 35% translateX, 72% Scale, 55% Opacity, unscharf. Navigationspfeile

**Bottom-Sheet** (scrollbar):
- Sheet-Handle: 36×2px abgerundeter Balken
- **Schnellzugriffe** (4 pinnbare Slots): Direktstart zu Lieblingsmodi
- **Spieltyp-Selector** (4 horizontale Pills): BLITZ (Play-Icon), MARATHON (Uhr), ENDLOS (∞), WETTKAMPF (Pokal). Ausgewählt: Lila Hintergrund, Scale 1.05
- **Modus-Grid** (7 Spalten, 14 Karten): Alle Spielmodi als 40–56px quadratische Karten mit SVG-Icon; Hover: leicht heben; Auswahl: Glow + Scale 1.08
- **Statistik-Zone** (3 Spalten):
  - Gold-Karte: Pokal + "Persönlicher Rekord" (große goldene Zahl)
  - Pink-Karte: Stern + "Serie" (Tage)
  - Lila-Karte: Play + "Spiele gespielt"
- **Daily-Challenge-Karte**: Goldener Stern, "+100 XP", Streak-Counter, PLAY-Button (Gold-Gradient). Wenn gespielt: Ablauf-Timer statt Button
- **Glücksrad-Karte**: Drehendes Rad-Icon (Orange), "DREHEN!"-Button
- **PWA-Install-Banner** (falls noch nicht installiert): Slide-in von oben
- **Play-FAB** (Floating Action Button): Zentriert, groß, Primary→Accent Gradient, "SPIELEN" + Play-Icon, Atemanimation (Scale 1.0 → 1.015, endlos)

**Footer-Navigation** (fest unten, 42px):
- 4 Buttons: Rangliste (Pokal), Erfolge (Stern), Shop (Warenkorb), Einstellungen (Zahnrad)
- Aktives Element: Lila Glow-Punkt-Indikator

### Tutorial-Screen

4 interaktive Slides:

1. **Slide 1 — Spielfeld-Erklärung**: Mock-Spielfeld (220×220px, dunkle Glass-Box). 4 farbige Ecken (rot oben-links, blau oben-rechts, grün unten-links, orange unten-rechts). Mitte: gestrichelter Kreis mit pulsierendem roten Punkt. Text: "Jede Ecke zeigt eine Farbe. Eine Form erscheint in der Mitte."
2. **Slide 2 — Interaktiver Test**: Benutzer wischt/tippt. Korrekte Richtung (oben-links) löst Glow aus + grüne Bestätigung + Auto-Fortschritt nach 800ms. Falsch: "Versuche oben links!" (orange)
3. **Slide 3 — Speed-Bonus**: Blitz-Symbol (pulsierend), "+150" grüner Text (groß, springend). "Je schneller du wischst, desto mehr Punkte!"
4. **Slide 4 — Multiplikator**: "×1 → ×3 → FEVER ×5" (große orange Zahlen). "Serien steigern deinen Multiplikator!"

Navigation: Zurück-Button (links, bei Slide 0 versteckt), Weiter/Fertig (rechts, lila), Überspringen (Ghost-Style unten). Dots oben als aktiver Pill.

### Game-Screen

Vollbild, absolut positionierte Elemente:

**HUD (oben)**:
- Pause-Button (52×52px, dunkles Glas, Pause-Icon)
- Modus-Indikator ("4-DIR", Space Grotesk, lila Pill)
- Regelanzeige (kleiner, bei bestimmten Modi)
- Timer (2.2rem Space Grotesk, weiß, tabellarische Ziffern)
- **Score-Sektion** (darunter, dunkles Glas):
  - 3 Gruppen: "PUNKTE / 0", "MULTIPLIKATOR / ×1", "STREAK / 0"
  - Labels klein/gedämpft, Werte groß
  - Multiplikator-Farbe: Grün (normal) / Gold (hoch) / Rot (niedrig)
- Fever-Indikator (wenn aktiv): Pink "FEVER" mit Scale-Puls

**Spiel-Elemente**:
- **Eck-Shapes** (4): Bildschirmecken, 52–80px (clamp), SVG-Form + Drop-Shadow. Korrekt: Scale 1.15 + Brightness 1.8. Falsch: Links-Rechts-Shake 6px
- **Kanten-Shapes** (4, Expert+): Oben/Unten/Links/Rechts
- **Ultra-Slots** (4): Kompassrichtungen
- **Zentrum-Plattform**: 110–165px (clamp), Float-Animation (−8px translateY), Drop-Shadow-Glow
- **Zentrum-Form**: SVG (Shape-Modi) oder Text (Brain-Modi). Spawn-Pop-Animation bei neuem Shape

**Overlays**:
- **Modus-Instruktion** (vor dem Spiel): Dunkler Scrim, Karte mit Icon + Titel + Beschreibung + START
- **Countdown** (3-2-1-GO): Große Zahlen (5–8rem), Gradient-Fill, Pop-Animation (Scale 2.5 → 1 mit Überschwingen)
- **Pause-Overlay**: Dunkler Scrim, Karte mit Spielinfos, Buttons (Fortsetzen/Neustart/Einstellungen/Verlassen), Ad-Banner
- **Score-Pop** (schwebende Zahlen): Erscheint bei Swipe-Position, steigt 90px auf und verblasst über 1s. Farben: Weiß (normal), Grün (Bonus), Rot (Fehler)
- **Rush-Text**: Großes "RUSH!" (lavendel/lila), Bounce-Entrance (Scale 0.15 → 1.25 → 1), steigt 40px auf
- **Fever-Text**: Großes "FEVER!" (pink), ähnliche Bounce-Animation
- **Combo-Text**: "×3" / "×5" (gold), Zoom-Pop + Uhrzeigerdrehung
- **Shuffle-Text**: "SHUFFLE!" (orange), Scale-Pop + 180°-Drehung
- **Speed-Lines** (während Rush): Radiale konische Gradient-Streifen aus Mitte, Opacity pulsiert, endlose Drehung
- **Trail-Canvas**: Wisch-Linien während Gameplay, verblasst nach Swipe-Ende
- **Near-Miss-Pfeil**: Zeigt auf fast-getroffene Richtung, pulsende Scale

**Intensitäts-System (HUD)**:
- CSS-Klassen `intensity-low/mid/high/max` und `edge-glow-warm/hot/fire` basierend auf Streak
- Max-Glow + Feuer-Stroke bei Fever

### Results-Screen

Zentriertes scrollbares Panel (380px max):

**Phase 1 (sofort)**:
- **XP-Ring** (140×140px clamp): SVG-Kreis, Hintergrund-Ring grau, Füll-Ring lila vom leeren → vollen Bogen animiert. Zentrum-Text: große Gradient-Zahl (Primär→Akzent). Ring-Entrance: Scale 0.4 → 1, 0.7s, Blur-Fade
- Modus-Badge darunter

**Phase 2 (nach Count-Up, 0.5s Einblendung)**:
- **Stats-Grid** 2×2: Richtig/Genauigkeit%/Beste Serie/Ø Reaktion (Glass-Hintergrund)
- Bonus-Zeile: "+X Streak-Bonus · +X Genauigkeits-Bonus"
- **PB-Badge** (neuer Rekord): Gold-Hintergrund, Krone springt, Text glüht
- **Level-Up-Badge** (wenn aufgestiegen): Lila Highlight, Glow-Puls
- XP-Menge + Feuer verdient
- Fortschrittsbalken zum nächsten Level
- Modus-spezifischer XP-Balken (Skill-Tree)

**Phase 3 (Buttons)**:
- **Continue-Prompt** (wenn Leben verfügbar): Pink-umrandete Box mit Dringlichkeits-Puls. "Weiterspielen?", Leben-Info, 4 Buttons: "X Leben verwenden" / "Leben kaufen" / "Werbung anschauen" / "Nein danke"
- Normal-Buttons: "Nochmal" (groß, lila Primary), "Teilen" (sekundär), "Startseite" (Ghost)

### Leaderboard-Screen

- Modus-Filter-Chips (scrollend, 14 Modi)
- Spieltyp-Filter (Blitz, Marathon, Endlos, Wettkampf)
- Score-Liste (Top 20):
  - #1: Gold-Rand + goldene Rang-Zahl + 🥇
  - #2: Silber-Rand + 🥈
  - #3: Bronze-Rand + 🥉
  - Avatar (28×28px, Glass-Kreis) + Spielername + Datum
  - Großer Score rechts (glüht wenn eigener Score)
  - Pop-In-Animation mit 0.08s Staffelung
- Leerer Zustand: Pokal-Icon + erklärung + "Jetzt spielen!"-Button

### Achievements-Screen

- Fortschrittsbalken (X/Y Achievements, Prozent)
- **4 Filter-Tabs**: Alle / Erreicht / Gesperrt / Fast (≥50% Fortschritt)
- **Akkordeon** (13 Kategorien, exklusiv — nur eine offen):
  - Kategorie-Header: Name, Beschreibung, X/Y Zähler, Fortschrittsbalken, Pfeil
  - Gestaffelte `popIn` Animation (0.06s Delay pro Item)
  - **Ketten-Fortschrittsbalken** (nächstes gesperrtes Achievement, %, Ziel)
  - **Achievement-Nodes**: Erreicht: ✓ in Stufenfarbe + Name + Stufen-Name. Gesperrt: 🔒 + Name + Mini-Fortschrittsbalken

Stufen-Farben: Bronze #CD7F32 / Silber #C0C0C0 / Gold #FFD700 / Platin #E5E4E2 / Diamant #B9F2FF

### Settings-Screen

- 6 Handbuch-Toggles:
  1. Farbenblind-Modus — Wechselt auf zweites Farbpaletten-Set
  2. Reduzierte Animationen — Deaktiviert Partikel + Ambient
  3. Haptik — `navigator.vibrate()`
  4. Soundeffekte
  5. Hintergrundmusik
  6. Sprache (Dropdown: Auto / Deutsch / Englisch)
- Buttons: "Avatar ändern", "Engagement Report", "Ausloggen" (Ghost, roter Text)

### Store-Screen

**Tab 1 — Premium (IAP)**:
- 7 Produkte als Karten (gestaffelte Pop-In): Werbefrei (€4.99), +3 Leben (€0.99), +10 Leben (€2.99), Custom Avatar (€1.99), VIP Bronze/Silber/Gold (€9.99/19.99/29.99)
- Status: "[Im Besitz]" oder Preis-Button
- VIP-Items: Zusätzliches Glow-Effekt + "BELIEBT" / "BESTES ANGEBOT"-Badge

**Tab 2 — Themes**: 8 Themes mit Farbvorschau (Gradient-Preview)

| Theme | Farben |
|-------|--------|
| Default | Lila → Pink |
| Neon | Grün → Magenta |
| Ocean | Cyan → Blaugrün |
| Sunset | Orange → Rot |
| Forest | Grün → Braun |
| Cosmic | Lila → Pink (Variante) |
| Retro | Grün → Orange |
| Crystal | Cyan → Lavendel |

**Tab 3 — Trails**: 6 Wisch-Spurenstile
- Fire, Ice, Rainbow, Electric, Stardust, Default

Jedes Unlock-Item: Aktiv (Auge + "Aktuell aktiv"), Besessen (aktivierbar), Gesperrt (Feuer-Kosten + "Nicht genug Feuer" wenn leer)

### Avatar-Screen

- Avatar-Vorschau (72×72px Kreis, lila Rand, Glow-Aura)
- **Icon-Grid** (4 Spalten, 16 Icons): Glass-Hintergrund, Hover: leicht heller, Auswahl: lila Rand + Scale 1.05
- **Farb-Grid** (6–8 Kreise): Hover: Scale 1.15, Auswahl: weißer Rand + Glow
- **Foto-Upload** (gesperrt bis IAP-Kauf): Lock-Emoji + "Im Shop freischalten" → freigeschaltet: Datei-Input (WebP, 128×128px, Qualität 0.8) + Entfernen-Button

### Wheel-Screen

- Canvas-Rad: 8 gleiche Kuchensegmente, weiße 2px Trennlinien, Beschriftungen an 62% Radius, zentrierter Kreis dunkel (#1F1F1F) mit Gold-Rand (3px)
- Spin: 4–6 Umdrehungen, 3.5–5s, Ease-Out cubic, requestAnimationFrame
- Ergebnis-Text nach Spin zeigt gewonnenen Preis
- "Heute bereits genutzt" wenn bereits gedreht

### Engagement-Report-Screen

- Zusammenfassungstext (oben)
- **Score-Ring**: SVG, animierter Füllbogen, Zentrum-Zahl (0–100)
- **Signal-Karten** (2-Spalten-Grid): Titel, Wert, Farbcodierter Balken (Grün/Gelb/Orange/Rot ≥75/55/35/0%)
- Feedback-Sektion: Key-Value-Paare
- **Tages-Chart**: 7–14-Balken-Diagramm, Gradient-Füllung
- Export-Buttons: Als Text kopieren, JSON exportieren

---

## 4. Die 14 Spielmodi

### Modus-Unlock-Level

| Modus | Freischaltung |
|-------|--------------|
| Klassik | Immer verfügbar |
| Beginner | Immer verfügbar |
| Mathe | Immer verfügbar |
| Expert | Level 5 |
| Ultra | Level 7 ODER 10 Competition-Level bestanden |
| Alle anderen | Je nach Level-Konfiguration in CONFIG |

---

### Shape-Modi (Wisch-basiert)

Diese vier Modi bilden den Kern-Gameplay-Loop: Eine Form erscheint in der Mitte, der Spieler wischt in Richtung der passenden Ecke.

#### Klassik

- **Richtungen**: 4 diagonal (oben-links, oben-rechts, unten-links, unten-rechts)
- **Formen**: Nur Quadrat
- **Farben**: 4 unterschiedliche Farben pro Ecke
- **Mechanik**: Auf Farbe wischen (nicht Form, da nur eine Form vorhanden). Perfekter Einstiegsmodus.
- **Corner Shuffle**: Ab 12 Richtigen, dann alle 10 (Minimum 6). 1400ms Warnblitzen vorher → Ecken tauschen Farben + Positionen. Erste Shuffle zeigt kurze Erklärung (Tooltip).

#### Beginner

- **Richtungen**: 4 diagonal
- **Formen**: Kreis, Quadrat, Dreieck, Stern (4 Formen)
- **Farben**: Je Ecke unterschiedlich
- **Mechanik**: Auf die Ecke wischen, die Form + Farbe des Zentrums zeigt. Beides muss übereinstimmen.

#### Expert

- **Richtungen**: 8 (diagonal + oben/unten/links/rechts)
- **Formen**: Beginner-Formen + Diamant, Hexagon, Pentagon, Kreuz (6–8 Formen)
- **Besonderheit**: Deutlich schwieriger, da mehr Richtungen; Dead Zone 2° an Grenzen

#### Ultra

- **Richtungen**: 12 (8 + ENE/NNW/WSW/SSE)
- **Formen**: Alle 12: Kreis, Quadrat, Dreieck, Stern, Diamant, Hexagon, Pentagon, Kreuz, Herz, Mondsichel, Pfeil, Blitz
- **Besonderheit**: Präzisionswischen erforderlich; Dead Zone 3° an Grenzen; höchste kognitive + motorische Anforderung

**Corner Shuffle (alle Shape-Modi)**:

```
Erste Shuffle:    nach 12 richtigen Antworten
Folge-Shuffles:   alle 10 richtigen (−2 pro Shuffle, min. 6)
Warnung:          1400ms vorher (Pulse-Animation + Audio-Whoosh)
Animation:        Ecken blinken, dann neue Positionen mit Pop-In
Erklärungs-Tip:   Einmalig beim allerersten Shuffle (onShuffleExplain-Callback)
```

---

### Brain-Modi (Lese-/Denkanforderung)

Diese Modi verlangsamen die Spawn-Rate (2400–2800ms statt 850ms) und erfordern Denken statt reines Reflexe.

#### Mathe

Rechenaufgaben erscheinen in der Mitte, 4 Ecken zeigen Zahlen (eine korrekt, drei Distraktoren).

**Progressive Phasen**:

| Phase | Auslöser | Operatoren | Zahlenbereich |
|-------|---------|------------|---------------|
| 0 | Start | +− | 1–10 |
| 1 | 5+ richtig | +− | 1–20 |
| 2 | 12+ richtig | +−× | 2–12 |
| 3 | 25+ richtig | +−×÷ | 2–15 |
| 4 | 70+ richtig | Alle | 5–40 |

**Distraktoren**: Zifferntausch (z.B. 12 → 21), ±1, ±2, ±5, ±10, gleichmäßige Abstände — immer plausible Fehler

#### Algebra

7 Phasen mit algebraischen Gleichungen:

| Phase | Typ | Beispiel |
|-------|-----|---------|
| 0 | Lineare Addition | x + 3 = 7 |
| 1 | Lineare Subtraktion | x − 5 = 2 |
| 2 | Zwei-Schritt | 2x + 1 = 9 |
| 3 | Quadrat | x² = 16 |
| 4 | Quadratwurzel | √49 = ? |
| 5 | Potenzen | 2³ = ? |
| 6 | Bruchaddition | ½ + ¼ = ? |

- Perfekte Quadrate: [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225]
- Potenzen: Vorberechnete Basis/Exponent-Kombos (alle ≤ 1000)
- Bruchpaare: Vorberechnete Paare mit ganzzahligen Ergebnissen

#### Wörter

4 Kategorien (DE: Tier/Essen/Sport/Farbe; EN: Animal/Food/Sport/Color), je 40 Wörter. Ecken zeigen Kategorie-Namen, Mitte zeigt ein Wort → Spieler wischt zur passenden Kategorie.

**Progressive Phasen**:

| Phase | Auslöser | Änderung |
|-------|---------|---------|
| 0 | Start | Normaler Text |
| 1 | 20+ richtig | 25% Chance: Emoji statt Wort |
| 2 | 30+ richtig | 40% Chance: Stroop-Einfärbung (Textfarbe ≠ Kategorie) |

Alle 12 Spawns: Kategorie→Ecke-Mapping wird neu gemischt.

#### Hauptstädte

130 Länder-Einträge, 5 Schwierigkeitsstufen. Frage: Land erscheint in Mitte → wische zur richtigen Hauptstadt.

| Tier | Auslöser | Beispiele |
|------|---------|---------|
| Easy | Sofort | Frankreich, Deutschland, Japan |
| Medium | 10+ richtig | Thailand, Argentinien, Portugal |
| Hard | 25+ richtig | Mongolei, Bolivien, Ghana |
| Very Hard | 50+ richtig | Tadschikistan, Mauretanien |
| Obscure | 100+ richtig | Mikronesien, Nauru, Tuvalu |

- Distraktoren: bevorzugt Hauptstädte aus derselben Region (kognitiv herausfordernd)

#### Wissen (IQ-Quiz)

100 Fragen in 4 Schwierigkeitsstufen, 6 Kategorien: Geografie, Wissenschaft, Geschichte, Kultur, Sport, Natur. Alle dual-sprachig (DE + EN).

| Tier | Anzahl | Auslöser |
|------|--------|---------|
| 0 (leicht) | 30 | Sofort |
| 1 (mittel) | 30 | 10+ richtig |
| 2 (schwer) | 20 | 25+ richtig |
| 3 (Experte) | 20 | 50+ richtig |

Bereits gestellte Fragen werden nicht wiederholt (`_wissenUsed` Set).

**v22 — Wissen-Overhaul**:
- **Globaler Timer**: 60 Sekunden für das gesamte Spiel (kein per-Frage-Timeout). Jede Frage wartet auf Antwort des Spielers.
- **Speed-Scoring**: Punkte = `WISSEN_BASE_POINTS (100)` + Geschwindigkeits-Bonus nach Antwortzeit:
  - < 2s → +150 Bonus
  - < 4s → +75 Bonus
  - < 6s → +25 Bonus
  - ≥ 6s → kein Bonus
- **Zeit-Bonus**: Antwort < 3s → +5s auf den globalen Timer
- **Zeit-Strafe**: Falsche Antwort → −3s auf den globalen Timer
- **Level-Up-System** (5 Stufen, Thresholds: 300 / 700 / 1200 / 1800 / 2500 Punkte):
  - Level-Up löst `onWissenLevelUp`-Callback aus → Pop-Animation + `wissenLevelUp(level)`-Audio
- **Mindest-Anzeigezeit**: 1500ms (Frage bleibt mindestens 1.5s sichtbar)

---

### Memory-Modi

#### Memo — Versteckte Ecken

Das Gedächtnisspiel: Ecken kurz sichtbar, dann abgedeckt. Spieler muss sich merken, welche Form/Farbe wo ist.

**Ablauf**:

```
Start → Ecken sichtbar (3000ms, min. 1200ms, −200ms pro Zyklus)
     → Ecken abgedeckt
     → Spieler tippt/wischt aus dem Gedächtnis
     → Alle 8 richtig: Kurze Wiederaufdeckung + eventuell Neuanordnung
     → Alle 3 Wiederaufdeckungen: Ecken-Positionen neu gemischt
```

- `MEMO_PREVIEW_MS`: 3000ms Start-Sichtbarkeit
- `MEMO_PREVIEW_MIN_MS`: 1200ms Minimum
- `MEMO_PREVIEW_SHRINK`: −200ms pro Zyklus
- `MEMO_REVEAL_EVERY`: 8 richtige
- `MEMO_SHUFFLE_AFTER`: 3 Zyklen

#### Sequenz — Simon Says

System zeigt Muster → Spieler wiederholt es in gleicher Reihenfolge.

**Ablauf pro Runde**:

```
1. "MERKEN!"-Overlay erscheint
2. Jede Ecke blinkt der Reihe nach (500ms Flash, 300ms Pause)
3. "GO!"-Overlay → Spieler gibt Muster ein
4. Korrekt → Nächste Runde mit längerem Muster
5. Falsch → Leben −1, Runde neu starten
```

**Konfiguration**:

| Parameter | Wert |
|-----------|------|
| Start-Länge | 4 Schritte |
| Max-Länge | 20 Schritte |
| Flash-Dauer | 500ms (min. 250ms) |
| Pause zwischen Flashes | 300ms |
| Beschleunigung | alle 3 Runden −1 Flash-ms |
| Input-Timeout | 4000ms (−100ms je Extra-Runde) |
| Verfügbare Spieltypen | Nur Endless |

---

### Reflex-Modi

#### Stroop — Kognitive Interferenz

Klassischer Stroop-Test: Farbwort erscheint in falscher Tintenfarbe. Spieler muss die **Tintenfarbe** anklicken, nicht den Wortinhalt.

```
Beispiel: Das Wort "BLAU" erscheint in roter Tinte
→ Spieler wischt zu ROT (Tintenfarbe), nicht zu Blau
```

- Ecken: Reine Farbfelder (kein Text)
- 35% kongruente Trials (Wort + Tinte = gleich)
- 65% inkongruente Trials (kognitiver Konflikt)
- 4 Farben im Basis-Set, 8 im erweiterten Set

#### Fokus — Flanker Task

Kognitive Inhibitions-Aufgabe: Mittel-Pfeil identifizieren, Flanker-Pfeile ignorieren.

```
Darstellung: ← ← → ← ←
Korrekte Antwort: Rechts (→ ist der Mittelpfeil)
```

- `FOKUS_FLANKER_COUNT`: 4 (je 2 Seiten)
- 30% kongruent (alle gleich) / 70% inkongruent
- Ecken: 4 Pfeil-Richtungen

#### Chaos — Dimensionswechsel

Aktive Regel wechselt periodisch zwischen mehreren Dimensionen. Der Spieler muss erkennen, worauf er im Moment achten soll.

**Regeln**:

| Regel | Aktion |
|-------|--------|
| Farbe | Auf passende Farbe wischen |
| Form | Auf passende Form wischen |
| Größe | Auf größte/kleinste Form wischen |
| Mathe | Algebra-Aufgabe lösen (ab 15+ richtig) |
| Stroop | Stroop-Aufgabe (ab 15+ richtig) |

- Regelwechsel nach 4–8 richtigen Antworten (zufällig)
- Aktuell aktive Regel: Farbcodiertes Badge in der Mitte

---

## 5. Die 4 Spieltypen

| Spieltyp | DE-Name | Timer | Spawn-Start | Besonderheit |
|----------|---------|-------|-------------|--------------|
| Blitz | Blitz | 30s | 850ms | Schnellste; +2s nach 5er-Streak; −1s bei Fehler |
| Classic | Marathon | 60s | 850ms | Ausgewogen |
| Endless | Endlos | Kein Timer | 850ms | 5 Leben; alle 10 Streak: +1 Leben; Fehler: Leben −1 |
| Competition | Wettkampf | 20–60s (je Level) | 850ms | 10 Level; Sterne 1–3; schaltet Ultra frei |

### Endless-Spezifik

- Start-Leben: 5 (`CONFIG.ENDLESS_MAX_MISSES`)
- Leben-Verdienst: Alle 10 Streaks ein extra Leben (`CONFIG.ENDLESS_LIFE_STREAK`)
- Zeitbonus (bei Streak ≥5): +2s pro richtige Antwort
- Zeitstrafe (Fehler): −1s (nur bei Shape-Modi, NICHT bei Brain-Modi)
- Continue-Prompt wenn Leben aufgebraucht: 1 Leben verwenden / Lives kaufen / Werbung ansehen

### Competition-Spezifik

- 10 Level, progressiv schwieriger (Timer schrumpft, Score-Ziele wachsen)
- Score-Ziele: [500, 1200, 2000, 3000, 4500, 6000, 7500, 9000, 11000, 14000]
- Sterne-Vergabe: 1 Stern (Ziel erreicht), 2 Sterne (150%), 3 Sterne (200%)
- Alle 10 Level mit ≥1 Stern: Ultra-Modus dauerhaft freigeschaltet
- Nicht kompatibel mit Sequenz-Modus (Endless-only)

---

## 6. Scoring-System

### Punkte pro Treffer

```
Punkte = 100 (Basis)
       + Zeitbonus (0–50, wenn Reaktion < 500ms; < 2000ms bei Brain)
       × Bonus-Multiplikator (×3 Golden, ×5 Diamond, ×1 normal)
       × Spieler-Multiplikator (1–8)
       × Fever-Bonus (×2 wenn Fever aktiv)
```

### Bonus-Shapes

| Bonus | Spawn-Chance | Multiplikator | Visuell |
|-------|-------------|---------------|---------|
| Kein Bonus | 81% | ×1 | Normal |
| Golden | 12% | ×3 | Gold-Glow (feGaussianBlur std=3) |
| Diamond | 7% | ×5 | Cyan-Glow (feGaussianBlur std=4) |

(In Practice-Modus: 0% Bonus-Chance)

### Multiplikator-System

- +1 pro 5 richtige Antworten in Folge
- Maximum: ×8 (`CONFIG.MULTIPLIER_MAX`)
- −1 bei jedem Fehler (`CONFIG.MISS_PENALTY`)
- Perfect-Window: Reaktion < 400ms → visuelles "PERFECT!"-Feedback + Ton

### Fever

- Auslöser: 15 Streak (Normal) / 8 Streak (Brain-Modi)
- Dauer: 5000ms
- Cooldown: 3000ms (kein Re-Trigger)
- Effekt: ×2 auf alle Punkte, spezielle visuelle + Audio-Effekte

### Rush

- Auslöser: Alle 15 Timer-Sekunden
- 2s Vor-Warnung: `onRushWarning`-Callback → Warntextband + `rushWarning()`-Audio
- 800ms Haupt-Warnung (Pop-Text + Audio-Whoosh)
- 2 Shapes in schneller Folge (1200ms Abstand)
- Kein Multiplikator-Verlust bei einem Fehler während Rush (`RUSH_NO_MULTIPLIER_LOSS: true`)
- Kein Rush/Shuffle in den ersten 10 Spielsekunden (`GENTLE_START_NO_RUSH_SEC`)

### Anti-Frustrations-System (v22)

| Mechanik | Wert | Beschreibung |
|----------|------|--------------|
| Gentle Start | 5 Antworten | Erste 5 Antworten ohne Beschleunigung |
| Gentle Start Gate | 10 Sekunden | Kein Rush/Shuffle/Fever in ersten 10s |
| Streak-Schutz | Streak ≥ 10 | Erster Fehler: nur Warnung + geringerer Multiplikator-Verlust |
| Miss Grace Period | 600ms | Verzögerung nach Fehler vor nächstem Spawn |
| Richtige Antwort zeigen | 400ms | Korrekte Ecke blinkt kurz nach Fehler auf |
| Rush Kein Mult-Verlust | true | Fehler während Rush reduziert Multiplikator nicht |

### Adaptiver Schwierigkeitsgrad (Spawn-Tempo)

```
Start-Intervall:   850ms  (Brain: 2400–2800ms, Memo: 3200ms)
Minimum:           400ms  (Brain: 1000ms)
Maximum:           1100ms (Brain: 4000ms)
Schritt:           15ms pro richtige Antwort

Bei Fehler:        +75ms Recovery (5× Beschleunigungs-Schritt)
Adaptiv gut:       Wenn Genauigkeit ≥90% + Reaktion ≤600ms → weiter beschleunigen
Adaptiv schlecht:  Wenn Genauigkeit ≤70% oder ≥2 Fehler in Folge → verlangsamen
```

### Endabrechnung

```
Final-Score = Laufender Score
            + Streak-Bonus  (Beste Serie × 50)
            + Genauigkeits-Bonus (Genauigkeit% × 100)
            + Perfect-Round-Bonus (+500, wenn 100% Genauigkeit & ≥15 Antworten)
            + Blitz-Bonus (Reaktionen <300ms: je ×25)
            × Wochenend-Multiplikator (Samstag/Sonntag: ×1.5)
```

### Score-Meilensteine

Bei Erreichen folgender Punkte werden Feier-Effekte ausgelöst:

| Schwellenwert | Effekte |
|--------------|---------|
| 1.000 | Confetti, Haptic, Toast |
| 2.500 | Confetti, Haptic, Toast |
| 5.000 | Confetti, Haptic, Toast |
| 10.000 | Confetti, Haptic, Toast |
| 25.000 | Massive Confetti-Explosion |

---

## 7. Visuelle Effekte

### Performance-Erkennung

Beim Start wird die Geräteleistung bestimmt:
- `deviceMemory` API (RAM)
- `hardwareConcurrency` (CPU-Kerne)
- Canvas-Benchmark: 500 `arc()`-Zeichnungen

3 Leistungsstufen: **Full** / **lowPerf** (mittlere Geräte) / **reduced** (Benutzereinstellung)

### Trail-System (Canvas)

- 3–4 Schichten mit Schatten-Blur (outer/mid/inner Glow-Passes)
- Max. 60 Punkte im FIFO-Buffer
- Finger-Cursor: Äußerer Ring + Kernpunkt + weißes Zentrum + Glow-Halo

**Trail-Stile**:

| Stil | Effekt |
|------|--------|
| Default | Zentrierte Spur in Spielfarbe |
| Rainbow | Animierte Farbrotation (12 Farben/s) |
| Stardust | Funken 1–3px alle 3 Punkte entlang der Spur |
| Fire | Ember-Partikel aufwärts, Rot/Gold, alle 4 Punkte |
| Ice | Bleu-weiße Spur mit Frost-Glow |
| Electric | Elektrisch-blau, schnelle Flicker |

Nach Swipe: Flash (Grün = richtig / Rot = falsch), dann exponentieller Fade.

### Touch-Ripple

- Radiale Ausbreitung + Verblassen bei Touch-Position
- CSS-Animation-gesteuert
- Auto-Cleanup bei `animationend`

### Ambient-Partikel

8 schwebende Punkte im Hintergrund:
- Größe: 2–6px
- Opacity: 6–18%
- Drift-Offset: ±30px (CSS-Variable)
- Animations-Dauer: 7–17s
- Versatz: 0–6s Delay
- Nur auf Non-reduced, Non-lowPerf Geräten

### Screen-Shake

4 vordefinierte Profile mit unterschiedlichen Amplituden-Envelopen:

| Profil | Dauer | Intensität | Envelope | Verwendung |
|--------|-------|------------|----------|-----------|
| `shakeHeavy()` | 450ms | 14px | Decay (Quad) | Schwerer Treffer |
| `shakeError()` | 300ms | 10px | Decay diagonal | Falsche Antwort |
| `shakeHeartBeat()` | 600ms | 4px | Constant | Puls-Effekt |
| `shakeCrescendo()` | konfig. | 12px | Crescendo | Aufbau-Spannung |

Direktionaler Shake: Hohe Frequenz entlang Kraftvektor + 30% Rauschen senkrecht dazu

### HUD-Intensitäts-System

| Streak | CSS-Klasse | Effekt |
|--------|-----------|--------|
| <5 | `intensity-low` | Minimal |
| 5–9 | `intensity-mid` | Subtile Edge-Glow |
| 10–19 | `intensity-high` | `edge-glow-warm` |
| 20–29 | `intensity-max` | `edge-glow-hot` |
| Fever | — | `edge-glow-fire` + Max-Glow |

### Spawn-Partikel-Pool

6 vorallozierte DIVs (kein GC-Druck), Stern-Ausbruch bei korrektem Treffer, 500ms Lebensdauer

### Hit-Stop (Zeit-Einfrieren)

- 50ms CSS-Animationsstopp via `.hit-stop-active`
- Nur auf Spiel-Kinder-Elemente (Shapes, Partikel)

### v22-Animationen & Feedback-Elemente

| Element | CSS-Klasse / Keyframe | Beschreibung |
|---------|----------------------|--------------|
| Spawn Pop (verbessert) | `@keyframes spawnPop` | Blur(4px)→0 Eingang + mehrstufiger Bounce |
| Ecken Richtig (verbessert) | `@keyframes cornerCorrect` | Stärkere Brightness-Filter-Schritte |
| Ecken Falsch (verbessert) | `@keyframes cornerWrong` | Schärferes Shake-Profil |
| Streak-Schutz | `.streak-shield` + `streakShield` | Schild-Flash wenn Streak-Schutz aktiviert |
| Richtige Antwort zeigen | `.corner-shape.show-correct` + `showCorrectPulse` | Korrekte Ecke blinkt nach Fehler |
| Rush-Warnung | `.rush-warning` + `rushWarnPulse` | Warntextband erscheint 2s vor Rush |
| Shuffle-Erklärung | `.shuffle-explain` + `shuffleExplainIn` | Tooltip beim ersten Corner Shuffle |
| Wissen Level-Up | `.wissen-level-up` + `wissenLevelPop` | Pop-Animation bei Wissen-Level-Aufstieg |
| Streak Pill Glow | `streakPillGlow` | Pulsierendes Glow auf Home-Streak-Pill |

### Modus-Identität (body.mode-* CSS)

Jeder Spielmodus setzt `--mode-hue` und `--mode-accent` via `body.mode-{name}`-Klasse. Die Zentrum-Plattform und andere Akzente reagieren dynamisch darauf.

| Modus | --mode-hue | --mode-accent |
|-------|-----------|---------------|
| klassik | 250 | #7C3AED |
| beginner | 280 | #9D4EDD |
| expert | 200 | #0EA5E9 |
| ultra | 170 | #06B6D4 |
| mathe | 120 | #22C55E |
| algebra | 150 | #059669 |
| worte | 45 | #F59E0B |
| hauptstaedte | 200 | #0EA5E9 |
| wissen | 230 | #6366F1 |
| reflex | 15 | #F97316 |
| stroop | 0 | #EF4444 |
| fokus | 180 | #06B6D4 |
| chaos | 300 | #A855F7 |

### Performance (v22)

- `.corner-shape`: `will-change: transform, opacity; contain: layout style`
- `.center-platform`: `will-change: transform; contain: layout style`
- Swipe-Velocity-Gate: Langsame Drags (< 0.3 px/ms) werden vor dem Dispatch verworfen

---

## 8. Audio-System

### Architektur

Drei-Schichten-Prozedurmusik mit Synthesizer:
- Melodie-Layer (Gain 0.12)
- Pad/Akorde-Layer (Gain 0.08)
- Bass-Layer
- Master-Gain: 0.18
- Dynamics-Compressor: −24dB Threshold, Knee 12, Ratio 4:1
- Algorithmischer Reverb: 0.9s Tail, exponentiell gedämpftes Rauschen

### Musik-Konfigurationen pro Modus

| Kontext | Tonart | Wellenform | Filter | Charakter |
|---------|--------|-----------|--------|----------|
| Menu | C-Dur Pentatonik | Sinus | Kein | Entspannt |
| Blitz | E-Moll Pentatonik | Sägezahn | High-Pass 3.5kHz Q2 | Aggressiv |
| Classic | C-Dur Pentatonik | Dreieck | Kein | Ausgewogen |
| Endless | D-Moll Pentatonik | Sinus | Kein | Ambient |
| Competition | A-Moll Natürlich | Sägezahn | High-Pass 4kHz | Intensiv |

Jeder Modus hat 6 Melodie-Phrasen × 8 Noten + 4 Akkord-Voicings.

### Soundeffekte (alle synthesiert, keine Audiodateien)

| Event | Klang |
|-------|-------|
| `correct(streak)` | Sub-Bass + Dreieck + Shimmer-Paar (detuned ±8¢), Stereo-Pan 20%; alle 5 Streak Milestone-Chime (660/880/1100 Hz) |
| `wrong()` | Dual-Sägezahn (200/150 Hz) + Noise-Burst (4kHz Filter) |
| `perfect()` | 3-Ton-Arpeggio aufsteigend: 880 → 1320 → 1760 Hz, 60ms Staffelung |
| `multiplierUp(level)` | Dreieck-Paar (Base + 25%, 70ms Staffelung) |
| `rush()` | Triple-Chirp: 600/700/800 Hz, 60ms Abstände |
| `countdown(n)` | Sub-Bass Thump bei GO; Chord-Stab 523/659/784 Hz bei Countdown |
| `gameOver()` | 5-Ton-Sequenz (392/440/523/494/523 Hz) + Warm-Major-Pad (C4-E4-G4-C5 mit Chorus-Detuning) |
| `newPB()` | 4-Ton-Fanfare (523/659/784/1047 Hz, 120ms Staffelung) + Dreieck-Undertone |
| `goldenFound()` | Schimmerndes Arpeggio (660/880/1100/1320 Hz, 40ms) |
| `diamondFound()` | Kristalline 4 Töne (1047/1319/1568/2093 Hz), 1% Shimmer-Detuning |
| `feverStart()` | Schnelles Sägezahn-Arpeggio (262 → 784 Hz, 40ms), Tempo-Boost auf 180 BPM |
| `feverEnd()` | Sanfter Doppel-Sinus-Abstieg (400/300 Hz) |
| `cornerShuffleWarn()` | Absteigendes Whoosh (800 → 500 Hz), wachsendes Detuning |
| `cornerShuffleDone()` | 3-Ton Bestätigungs-Chord (523/659/784 Hz, 60ms) |
| `levelUp()` | Grand-5-Ton-Sequenz mit Dreieck-Undertone |
| `streakProtected()` | Aufsteigendes 2-Ton Chime (660/880 Hz, 80ms Staffelung) + Sub-Impact |
| `rushWarning()` | Ansteigender 3-Tick Square-Wave (700/800/900 Hz, 150ms Abstand) |
| `wissenLevelUp(level)` | Helles aufsteigendes Arpeggio (3–5 Töne je Level, 70ms Staffelung) |

---

## 9. XP & Progressions-System

### XP-Berechnung

```
XP = (Spieler-Score / 100) × 3
   × Wochenend-Multiplikator (×1.5 Sa/So)
   × Tages-Diminishing-Returns-Rate
```

### Tägliche Diminishing Returns

| Tages-XP-Budget | Rate |
|----------------|------|
| 0 – 5.000 Punkte-XP | 100% |
| 5.000 – 10.000 | 50% |
| 10.000 – 20.000 | 25% |
| 20.000+ | 10% |

(Pro Kalendertag zurückgesetzt, in `dailyXPDate` + `dailyXPEarned` gespeichert)

### Level-System

20 Level (0–19) mit exponentiell wachsenden Schwellenwerten:

```
[0, 50, 200, 500, 1200, 3000, 7000, 15000, 30000, 60000,
 120000, 200000, 350000, 600000, 1000000, 1600000, 2500000, 4000000, 6500000, 10000000]
```

**Level-Namen**:

| # | DE | EN |
|---|----|----|
| 0 | Neuling | Rookie |
| 1 | Anfänger | Beginner |
| 2 | Lehrling | Apprentice |
| 3 | Aufsteiger | Rising Star |
| 4 | Geselle | Journeyman |
| 5 | Profi | Pro |
| 6 | Experte | Expert |
| 7 | Meister | Master |
| 8 | Veteran | Veteran |
| 9 | Könner | Adept |
| 10 | Großmeister | Grand Master |
| 11 | Champion | Champion |
| 12 | Legende | Legend |
| 13 | Titan | Titan |
| 14 | Phänomen | Phenomenon |
| 15 | Mythisch | Mythic |
| 16 | Unsterblich | Immortal |
| 17 | Göttlich | Divine |
| 18 | Transzendent | Transcendent |
| 19 | Gott | God |

**Level-Up-Belohnungen**:
- +1 Leben (bis Maximum)
- Fire-Bonus basierend auf Streak + Level

### Pro-Modus-Progression (Skill-Tree)

Separate `modeXP_*` + `modeLevel_*` Felder für jeden Modus — ermöglicht modusgebundene Fortschrittsbäume (v25).

### Daily Challenge Rewards

```
Basis-Belohnung: +100 XP + 2 Leben
Feuer-Belohnung: +5 Feuer Basis + min(Streak-Tage × 2, 20) Feuer-Bonus (v22)
Login-Streak-Bonus: +25 XP × Streak-Tage (max. 250 XP)
```

---

## 10. Achievements (1000+)

### Stufensystem

| Stufe | Farbe | XP |
|-------|-------|-----|
| Bronze | #CD7F32 | 10 XP |
| Silber | #C0C0C0 | 25 XP |
| Gold | #FFD700 | 50 XP |
| Platin | #E5E4E2 | 100 XP |
| Diamant | #B9F2FF | 250 XP |

Stufen-Zuweisung per Schwellenwert-Rang (0–25% → Bronze, 25–50% → Silber, 50–72% → Gold, 72–88% → Platin, 88–100% → Diamant).

### 13 Kategorien

1. **Meilensteine** — Spiele gespielt (gesamt, je Modus, je Spieltyp, Kombos)
2. **Highscores** — Score-Ziele (gesamt, je Modus, je Spieltyp)
3. **Serien** — Streak-Rekorde
4. **Präzision** — Genauigkeit + Perfect-Rounds
5. **Geschwindigkeit** — Reaktionszeit-Rekorde
6. **Spielmodi** — Modus-Erkundung
7. **Endlos** — Endless-spezifisch (Leben-Management, Korrekte gesamt)
8. **Competition** — Level-Fortschritt, Sterne-Sammlung
9. **Boni & Fever** — Golden/Diamond-Catches, Fever-Triggs
10. **Progression** — Level, XP, Login-Streaks
11. **Daily** — Tägliche Herausforderungen gespielt
12. **Kumulativ** — Lifetime-Stats (Gesamtpunkte, Korrekte, Spielzeit)
13. **Meisterschaft** — Kombinierte Erfolge (alle Modi mit PB, etc.)

### Template-System

~35 Templates × Cross-Product = 1000+ einzigartige Achievements:

| Template-Beispiel | Modi | Spieltypen | Schwellenwerte | Gesamt |
|-------------------|------|-----------|---------------|--------|
| `games_total` | — | — | 12 Werte | 12 |
| `games_m` | 14 Modi | — | 8 Werte | 112 |
| `games_pt` | — | 4 Typen | 7 Werte | 28 |
| `games_mp` | 14 Modi | 4 Typen | 4 Werte | 224 |
| `score_any` | — | — | 8 Werte | 8 |
| `score_m` | 14 Modi | — | 7 Werte | 98 |
| `lvl` | — | — | 19 Werte | 19 |
| `cum_correct` | — | — | 8 Werte | 8 |
| ... | | | | **1000+** |

**Kettenfortschritt**: Achievements derselben Familie (Bronze→Silber→Gold→Platin→Diamant) gruppieren sich unter einem `chainKey`. Im Achievements-Screen wird der Fortschritt zur nächsten Stufe visualisiert.

---

## 11. Economy — Leben, Feuer & Shop

### Währungen

**Leben (❤️)**:
- Benötigt für: Endless-Modus (Leben verlieren), Continue-Prompt
- Start: 3 Leben. Maximum: 50
- Quellen: Level-Ups, Daily Challenge (+2), Glücksrad, Shop-IAP, Endless-Streak-Bonus

**Feuer (🔥)**:
- Shop-Währung für Themes und Trails
- Quellen: Streaks (Menge basierend auf Beste Serie), Level-Up-Bonus, Score-Boni, Daily Challenge (v22: +5 Basis + bis zu 20 Streak-Bonus)

### IAP-Produkte (7)

| Produkt | Beschreibung | Preis |
|---------|-------------|-------|
| `adfree` | Alle Werbung entfernen | €4.99 |
| `lives3` | +3 Leben | €0.99 |
| `lives10` | +10 Leben | €2.99 |
| `avatar_photo` | Custom-Foto als Avatar | €1.99 |
| `vip_bronze` | Abo + bundled Leben | €9.99 |
| `vip_silber` | Abo + mehr Lives | €19.99 |
| `vip_gold` | Abo + maximale Lives | €29.99 |

VIP-Pakete beinhalten automatisch auch `adfree`.

### Freischaltbare Items mit Feuer

**Themes** (Freischalt-Level → Feuer-Kosten laut `unlockLevel`):

| Theme | Charakter |
|-------|----------|
| Default | Lila→Pink (inklusive) |
| Neon | Grün+Magenta, futuristisch |
| Ocean | Cyan+Blaugrün, beruhigend |
| Sunset | Orange+Rot, warm |
| Forest | Grün+Braun, natürlich |
| Cosmic | Lila+Pink-Variante, galaktisch |
| Retro | Grün+Orange, retro-digital |
| Crystal | Cyan+Lavendel, eisklar |

**Trails** (Wisch-Spuren):

| Trail | Effekt |
|-------|--------|
| Default | Standard-Spur in Spielfarbe |
| Fire | Ember-Partikel aufwärts, Rot/Gold |
| Ice | Kalt-blau mit Frost-Glow |
| Rainbow | Animierte Farbrotation 12 Farben/s |
| Electric | Elektrisch-blau, schnelle Flicker |
| Stardust | Funken 1–3px entlang der Spur |

---

## 12. Daily Challenge & Glücksrad

### Daily Challenge

- Täglich wechselnder Modus + Spieltyp
- **Seeded RNG**: `mulberry32(todaySeed())` — identisch für alle Spieler weltweit
- Selber Seed = selbe Shapes/Fragen für alle
- Nach Abschluss: Ablauf-Timer bis Mitternacht statt Play-Button
- Belohnungen:
  ```
  +100 XP Basis
  +2 Leben
  +5 Feuer Basis + min(Streak × 2, 20) Feuer-Bonus
  +25 XP × Login-Streak-Tage (max. 250 XP Bonus)
  ```
- Streak-Pill auf dem Home-Screen glow-animiert bei aktiver Serie

### Glücksrad (Wheel of Fortune)

**8 Segmente mit gewichteter Wahrscheinlichkeit**:

| Preis | Gewicht | Frequenz |
|-------|---------|---------|
| 1 Leben | 30 | Häufigster |
| 2 Leben | 15 | Häufig |
| 5 Feuer | 25 | Häufig |
| 15 Feuer | 10 | Mittel |
| 50 XP | 15 | Mittel |
| 200 XP | 3 | Selten |
| Jackpot (5 Leben + 50 Feuer) | 2 | Sehr selten |
| 10 Feuer | 0 | (Filler) |

**Spin-Physik** (v22-überarbeitet):
- 5–7 volle Umdrehungen
- Dauer: 4–5.5 Sekunden
- Ease-Out Quartic (stärkere Verlangsamung als Cubic)
- Endet exakt auf gewähltem Segment (rückwärts berechnet)
- `requestAnimationFrame`-basiert
- Segmente: Per-Segment Radial-Gradienten (Gold-Akzent auf Alternating)
- äußerer Glow-Ring: Rotierender konischer Gradient um das Rad

**Limits**:
- 1× täglich kostenlos
- 1× extra via Reward-Werbevideo (AdMob)
- `lastWheelSpin`, `wheelSpinsToday`, `wheelStreak` (Consecutive-Days) in Save

---

## 13. Competition-Modus

**10 Level**, progressiv schwieriger:

| Level | Score-Ziel | Timer | Schwellenwert für Sterne |
|-------|-----------|-------|--------------------------|
| 1 | 500 | ~20s | 1★: 500, 2★: 750, 3★: 1000 |
| 5 | 4500 | ~40s | Entsprechend skaliert |
| 10 | 14000 | ~60s | Entsprechend skaliert |

- **1 Stern**: Score-Ziel erreicht
- **2 Sterne**: 150% des Ziels
- **3 Sterne**: 200% des Ziels

**Freischaltung Ultra**:
- Alle 10 Level mit mindestens 1 Stern abgeschlossen
- `save.completeCompetitionLevel(level, stars)` → `ultraUnlockedViaCompetition = true`

---

## 14. Eingabe & Gesten

### SwipeHandler (`js/input.js`)

Verarbeitet Touch (primär) und Maus (Fallback):

```
_start()  → Startposition + Zeit merken, Trail beginnen
_move()   → Trail aktualisieren (onTrailMove)
_end()    → Geste klassifizieren + auflösen
```

**Klassifikation**:
- **Tap** (Distanz < `MIN_DISTANCE`): Hit-Test gegen Ecken-Elemente (inkl. `TAP_HIT_PADDING` für Fat-Finger)
- **Swipe** (Distanz ≥ Schwelle, Zeit ≤ `MAX_TIME`): Winkel-Berechnung via `Math.atan2`

### Richtungs-Modi

**4-Wege** (Klassik, Beginner) — 90°-Sektoren, 1° Dead Zone:

```
↖ ul    ↗ ur
↙ dl    ↘ dr
```

**8-Wege** (Expert) — 45°-Sektoren, 2° Dead Zone:

```
     ↑ up
↖ ul      ↗ ur
← left  → right
↙ dl      ↘ dr
     ↓ down
```

**12-Wege** (Ultra) — 30°-Sektoren, 3° Dead Zone:

```
        ↑ up
   ↖ ul    ↗ ur
← left         → right
   ↙ dl    ↘ dr
        ↓ down
+ ENE, NNW, WSW, SSE (Zwischen-Himmelsrichtungen)
```

### Anti-Cheat

- Reaktionszeiten < 50ms werden ignoriert (Bot-Schutz)
- `ANTI_CHEAT_MIN_REACTION: 50ms`

### Velocity-Gate (v22)

- Wische mit Geschwindigkeit < 0.3 px/ms werden als langsame Drags abgewiesen
- `SWIPE_MIN_VELOCITY: 0.3` — verhindert versehentliche Slow-Swipes
- Velocity = Strecke (px) / Zeit (ms), berechnet in `_end()`

### Haptics (`js/helpers/haptics.js`)

27 vordefinierte Vibrationsmuster (`navigator.vibrate()`):

| Ereignis | Muster (ms) | Charakter |
|---------|------------|----------|
| `tap` | [10] | Knackiger Tipp |
| `correct` | [15] | Schneller Snap |
| `perfect` | [15, 10, 25] | Rollender Aufprall |
| `wrong` | [20, 30, 20, 30, 20] | Stotternder Fehler |
| `heartLost` | [60, 40, 100] | Schwerer Schlag |
| `fever` | [50, 20, 50, 20, 60, 10, 80] | Massive Explosion |
| `levelUp` | [30, 40, 40, 40, 60, 20, 90] | Grand Fanfare |
| `newPB` | [40, 30, 30, 30, 50, 20, 80, 20, 120] | Ekstatischer Herzschlag |
| `gameOver` | [100, 50, 150, 50, 200] | Vernichtender Crush |
| `diamond` | [10, 10, 10, 10, 10, 50] | Schimmern dann Pop |
| `rush` | [15, 30, 15, 30, 15, 30] | Anhaltender Thrumm |

---

## 15. Speicher & Authentifizierung

### Lokaler Speicher (`js/save.js`)

**localStorage-Schlüssel**: `scs_save`

**Gespeicherte Daten**:
- Scores (Top 50 pro Modus, mit: Score, Streak, Genauigkeit, Ø-Reaktion, Datum)
- Personal Bests pro Modus (+ Endless-Varianten nach korrekten Antworten)
- `totalXP`, `level`, `gamesPlayed`
- Freigeschaltete Achievements (Array von IDs)
- `achStats` — Kumulierte Statistiken für Achievement-Checks
- Daily-Challenge-Einträge: `{datum: {score, mode}}`
- Competition: `competitionLevel`, `competitionStars`, `ultraUnlockedViaCompetition`
- Economy: `lives`, `fire`, `purchases`
- Login: `lastLoginDate`, `loginStreak`
- XP-Tracking: `dailyXPDate`, `dailyXPEarned`
- Settings: 6 Toggle-Werte + `language`, `gameMode`, `playType`, `tutorialDone`
- Onboarding: `hintsShown`, `pinnedModes` (4 Slots)
- Wheel: `lastWheelSpin`, `wheelSpinsToday`, `wheelStreak`, `lastWheelDate`
- Avatar: `{icon, colorIndex, photo}` (photo = base64 WebP)
- Themes: `activeTheme`, `activeTrail`
- Modus-XP: `modeXP_*`, `modeLevel_*` pro Modus

**Migrationen beim Laden**:
- Altes `'indie'`-Modus → `'beginner'`
- Fehlende Felder werden mit Defaults initialisiert
- Level mit neuer Schwellenwert-Formel neu berechnet

### Cloud-Sync (Firebase Firestore)

- Nur bei authentifizierten Nicht-Gast-Benutzern
- **Merge-Strategie**: Immer das Maximum für PBs/XP/Games behalten
- Score-Arrays: Deduplizierung nach Datum + Score, Top-50
- Bei Cloud-Fehler: Toast-Benachrichtigung, lokale Daten bleiben erhalten

### Authentifizierung (`js/auth.js`)

```
Firebase Auth (optional, CDN-geladen)
  → Google OAuth (signInWithPopup)
  → Apple OAuth (E-Mail + Name Scopes)
  → E-Mail + Passwort
  → Kein Firebase → Gast-Modus
      → UUID (timestamp-basiert) in localStorage als 'scs_guest'
      → isGuest = true, kein Cloud-Sync
```

`onAuthStateChanged(cb)` — Event-System für alle Listener

---

## 16. Engagement-Tracking

### Zweck

Passives lokales Verhaltens-Analytics. **Keine Daten an Server übertragen.**

### Erfasste Signale

| Signal | Erhebungsmethode |
|--------|-----------------|
| Session-Dauer | `visibilitychange` + `pagehide` Events |
| Return-Tage | Tägliches Datum-Set (letzte 30 Tage) |
| Post-Game-Aktionen | Retry/Home/Share nach Spiel + Zeit auf Results-Screen |
| Quit-Muster | Mid-Game-Quits, Pause→Quit, Early-Quits, Total-Starts |
| Feature-Adoption | Screens, Modi, Spieltypen, Avatar, Theme, Daily, Tutorial |
| Score-Trend | Lineare Regression (letzte 20 Scores je Modus) |
| Mikro-Feedback | Emoji-Rating 1–4 (max. 100 Einträge) |

### Engagement-Score Berechnung

**Gewichtete Formel (0–100)**:

| Signal | Gewicht |
|--------|---------|
| Retention (aktive Tage/7) | 0.25 |
| Session-Länge | 0.15 |
| Score-Trend | 0.15 |
| Retry-Rate | 0.15 |
| Quit-Rate (invers) | 0.10 |
| Exploration (Modi gespielt) | 0.10 |
| Feature-Adoption | 0.05 |
| Feedback-Bewertung | 0.05 |

**Stufen**: Hoch (≥80) / Solide (≥60) / Gemischt (≥40) / Niedrig (<40) / Zu wenig Daten (<3 Spiele)

Session-Länge verwendet Bell-Curve-Scoring (8–25 Minuten = optimal).

### Mikro-Feedback-Prompt

- Trigger: `'pb'`, `'levelup'`, `'sampling'`, `'new_mode'`, `'streak'`
- Limits: Max. 1 pro Session, min. 3 Spiele seit letztem Prompt, max. 1 pro Tag
- UI: 4 Emoji-Buttons (😐😊😄🤩) + Überspringen
- Auto-Dismiss nach 8s

---

## 17. PWA, Android & Monetarisierung

### PWA

- `manifest.json`: Icons (192/512px), Theme-Color, Display Standalone
- `sw.js`: Service Worker, Offline-Cache-Strategie
- **Install-Prompt**: `beforeinstallprompt` Event, 7-Tage-Dismissal-Cache (`scs_pwa_dismiss`)
- **Wake Lock**: `navigator.wakeLock.request('screen')` verhindert Screen-Sleep während Gameplay; Release bei Tab-Verbergen/Spielende

### Android (Capacitor)

- `capacitor.config.json` + `android/` Ordner (Gradle, Manifests)
- **AdMob-Plugin** (`Capacitor.Plugins.AdMob`):
  - Banner-Ads (Kein Banner wenn Werbefrei)
  - Interstitial (alle 2 Spiele, konfigurierbar via `AD_SHOW_EVERY_N_GAMES`)
  - Reward Video (für extra Wheel-Spin oder Continue)
  - Mock-Fallback für Browser-Testing (simuliert 3s Countdown + Reward)

### Orientierung & Systemintegration

- **Landscape-Warnung**: Bei ≤900px Viewport + Touch-Gerät im Querformat
- **Tab-Hide**: Spielpause wenn Browser-Tab verborgen (`document.hidden`)
- **Offline-Indikator**: `online`/`offline` Events, 5s Toast mit Nachricht

---

## 18. Design-System & CSS

### Farbpalette

| Variable | Wert | Verwendung |
|----------|------|-----------|
| `--primary` | `#7C3AED` | Hauptfarbe, Buttons, Akzente |
| `--primary-glow` | `#9D4EDD` | Glühende Variante |
| `--accent` | `#EC4899` | Hot Pink, Streaks |
| `--accent-glow` | `#F472B6` | Pink Glow |
| `--bg` | `#030014` | Fast-Schwarz Hintergrund |
| `--surface` | `rgba(255,255,255,0.04)` | Karten-Hintergrund |
| `--border` | `rgba(255,255,255,0.08)` | Karten-Rand |
| `--text` | `#F8FAFC` | Primärer Text |
| `--text-muted` | `rgba(248,250,252,0.5)` | Gedämpfter Text |
| `--gold` | `#FBBF24` | Premium/PB-Farbe |
| `--success` | Grün | Richtige Antwort |
| `--danger` | `#EF4444` | Fehler/Timer-Kritisch |
| `--cyan` | `#00D2FF` | Diamond-Effekte |

### Typografie

- **Body**: `Outfit` (Google Fonts) — clean, modern
- **Headers/Zahlen**: `Space Grotesk` — bold, geometrisch, tech-forward
- **Monospace**: `JetBrains Mono` (konfigurationsseitig definiert, nicht primär genutzt)

### Glass-Morphismus

Durchgängig im gesamten UI:
```css
background: rgba(255, 255, 255, 0.03–0.08);
border: 1px solid rgba(255, 255, 255, 0.06–0.12);
backdrop-filter: blur(12–20px);
```

### Animations-System

| Typ | Dauer | Easing | Verwendung |
|-----|-------|--------|-----------|
| Entrance Scale | 0.35–0.6s | cubic-bezier (elastic overshoot) | Screens, Karten |
| Float | 3–4s | ease-in-out, infinite | Schwebende Elemente |
| Pulse | 1.5–2s | ease-in-out, infinite | FAB, Fever-Indikator |
| Ripple | 0.5s | ease-out | Touch-Feedback |
| Shake | 0.1–0.5s | linear | Fehler, Erschütterung |
| Pop | 0.15s | ease-out | Score-Pops, Zahlen |
| Confetti | 1.5–2.5s | Physik-simuliert | Achievements, PBs |

### Responsive-Strategie

- `clamp()` für alle Größen (320px Minimum → Tablet-Expansion bei 600px+)
- Safe-Area Insets (`env(safe-area-inset-*)`) für Notch-Geräte
- Landscape-Warnung für ≤900px + Touch
- Ultra-Kompakt-Modus bei 320px

### CSS-Dateistruktur

| Datei | Inhalt |
|-------|--------|
| `01-tokens.css` | CSS-Custom-Properties (alle Design-Tokens) |
| `02-base.css` | Reset, Basis-Typografie, scrollbar, Transitions |
| `03-boot-auth.css` | Boot- + Auth-Screen-Spezifisch |
| `04-home.css` | Home-Screen: Hero, Karussell, Stats, FAB, Footer; v22: Streak-Pill-Glow |
| `05-game.css` | Spielfeld: HUD, Corners, Platform, Center, Score; v22: Modus-Identität für alle 14 Modi, `will-change`/`contain` |
| `06-overlays.css` | Alle Overlay-Typen: Pause, Countdown, Continue, Result; v22: Rad-Glow-Ring + verbesserter Pointer |
| `07-effects.css` | Trail-Canvas, Partikel, Screen-Shake, Glow-Klassen |
| `08-patches-v7-v9.css` | Bugfixes + Rückwärtskompatibilität v7–v9 |
| `09-extensions.css` | Zusatzfeatures, neue Komponenten |
| `10-micro-modes.css` | Modus-spezifische Layout-Klassen (`body.mode-*`); v22: Enhanced SpawnPop mit Blur-Eingang |
| `12-polish-v18-v19.css` | Feinschliff v18–v22: 6 neue Keyframes (streakShield, showCorrectPulse, rushWarnPulse, shuffleExplainIn, wissenLevelPop, streakPillGlow) |

### Avatar-System

**16 Icons** (alle algorithmisch als SVG generiert):
circle, star, hexagon, diamond, heart, bolt, crown, shield, flame, leaf, moon, sun, drop, gem, paw, rocket

**8 Farb-Indizes** aus `CONFIG.COLORS.normal`

**Foto-Avatar**: base64-codiertes WebP (max. 128×128px, Qualität 0.8, center-crop), gesichert via `safeSrc()` (nur `data:image/*` oder `https://` erlaubt)

### Shape-Renderer

**12 Formen** als SVG:
circle, square, triangle, star, diamond, hexagon, pentagon, cross, heart, crescent, arrow, bolt

**Bonus-Filter**:
- Golden: `feGaussianBlur` stdDeviation=3, Gold-Stroke `#FFD700`
- Diamond: `feGaussianBlur` stdDeviation=4, Cyan-Stroke `#00D2FF`

---

*Ende der Dokumentation — v22: Alle 9 Verbesserungsphasen implementiert und verifiziert (April 2026).*
