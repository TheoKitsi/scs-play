# SCS Play — Simple Color Sort

Ein blitzschnelles Reaktions-Sortierspiel als Progressive Web App (PWA).

## 🎮 Spielprinzip

- **4 Ecken** haben je eine einzigartige **Form + Farbe** (zufällig pro Runde)
- In der **Mitte** erscheint eine Form
- **Wische diagonal** zur passenden Ecke!
- Du hast **60 Sekunden** — sei schnell!
- **Streak-System**: 5er-Serien erhöhen den Multiplikator (bis x5)
- **Rush-Phasen** alle 15 Sekunden: 3 Formen in schneller Folge
- **Adaptiver Schwierigkeitsgrad**: Das Spiel passt sich deiner Leistung an

## 🚀 Starten

### Lokaler Server (Entwicklung)
```bash
cd "SCS Play"
python -m http.server 8080
# oder: npx serve .
# oder: npx http-server -p 8080
```
Dann öffne `http://localhost:8080` auf dem Smartphone-Browser.

### Auf einem Webserver
Kopiere den gesamten `SCS Play`-Ordner auf einen Webserver mit HTTPS.
Die App funktioniert als PWA und kann zum Homescreen hinzugefügt werden.

## 📱 Features

- **Vollbild-Modus** auf Smartphone-Browsern
- **Touch-only** — optimiert für Wisch-Gesten
- **PWA** — installierbar, offline-fähig
- **Gastmodus** — Spielstände lokal auf dem Gerät
- **Cloud-Auth** — Google, Apple, E-Mail (via Firebase)
- **Farbenblind-Modus** — alternative Farbpalette
- **Weniger Animationen** — Barrierefreiheit
- **Vibration / Haptics**
- **Sound-Effekte** (Web Audio API, keine externen Dateien)
- **Deutsch / Englisch**

## 🔐 Firebase einrichten (optional)

Der Gastmodus funktioniert sofort ohne Firebase. Für Cloud-Auth (Google/Apple/E-Mail):

1. Erstelle ein Projekt auf [Firebase Console](https://console.firebase.google.com/)
2. Aktiviere **Authentication** → Sign-in Providers:
   - E-Mail/Passwort
   - Google
   - Apple
3. Erstelle eine **Firestore Database** (Produktionsmodus)
4. Kopiere die Firebase-Config in `js/auth.js`:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            'AIza...',
  authDomain:        'dein-projekt.firebaseapp.com',
  projectId:         'dein-projekt',
  storageBucket:     'dein-projekt.appspot.com',
  messagingSenderId: '123456789',
  appId:             '1:123456789:web:abc123'
};
```

5. Firestore Security Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saves/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 📁 Projektstruktur

```
SCS Play/
├── index.html          # Haupt-HTML (alle Screens)
├── manifest.json       # PWA-Manifest
├── sw.js               # Service Worker (Caching)
├── css/
│   └── style.css       # Komplettes Styling
├── js/
│   ├── app.js          # Haupt-Orchestrator
│   ├── config.js       # Spiel-Konstanten
│   ├── i18n.js         # Lokalisierung (DE/EN)
│   ├── game.js         # Spiel-Engine
│   ├── input.js        # Touch/Swipe-Erkennung
│   ├── audio.js        # Sound (Web Audio API)
│   ├── effects.js      # Visuelle Effekte
│   ├── auth.js         # Authentifizierung
│   └── save.js         # Speicher-System
└── img/
    ├── icon-192.svg    # PWA-Icon
    └── icon-512.svg    # PWA-Icon
```

## 🏗 Technologie

- **Vanilla JavaScript** (ES Modules) — kein Framework, kein Build-Step
- **CSS Animations** — GPU-beschleunigt
- **SVG Shapes** — scharfe Formen auf jedem Display
- **Web Audio API** — synthetisierte Sounds
- **Vibration API** — haptisches Feedback
- **Fullscreen API** — echtes Vollbild
- **Firebase Auth + Firestore** — optional für Cloud-Sync
- **Service Worker** — Offline-Fähigkeit

## 📊 Punkte-System

| Komponente | Wert |
|---|---|
| Basis pro Wisch | 100 Punkte |
| Zeitbonus | bis +50 (je schneller, desto mehr) |
| Multiplikator | x1 bis x5 (alle 5er-Streak +1) |
| Miss-Strafe | Streak −3 |
| Endbonus | Beste Serie × 10 + Genauigkeit% × 20 |
