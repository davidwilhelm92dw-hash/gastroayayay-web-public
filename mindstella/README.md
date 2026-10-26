# Mindstella – Prototyp Kapitel 1

„Ein Dach unter fremden Monden“: Eine echte Alltagsaufgabe wird in Schritte gegliedert. Jeder erledigte Schritt baut automatisch an einer Hütte auf einem fremden Planeten; mit dem Abschluss der Hauptaufgabe steht genau eine vollständige Hütte. Der Prototyp richtet sich an Erwachsene mit ADHS und dient dem Test mit wenigen ausgewählten Personen. Er erhebt keinen Anspruch auf therapeutische Wirkung.

Der aktuelle Prüfstand, offene Punkte und notwendige Entscheidungen stehen in [docs/STATUS.md](docs/STATUS.md). Die Anleitung für Testpersonen steht in [docs/TESTANLEITUNG.md](docs/TESTANLEITUNG.md).

## Technischer Aufbau

Die App ist eine Android-App auf Basis von [Capacitor 8](https://capacitorjs.com). Welt und Bedienoberfläche laufen als Web-Code (Three.js, ohne UI-Framework) in der Android-WebView; Gerätefunktionen stellt ein eigenes natives Plugin bereit. Diese Wahl ergab sich aus der Prüfung der Entwicklungsumgebung: Ein Android-SDK war dort nicht installierbar, die Weboberfläche ließ sich dagegen vollständig automatisiert testen, und der APK-Build läuft reproduzierbar über GitHub Actions.

| Bereich | Umsetzung |
| --- | --- |
| 3D-Welt | Three.js 0.186, alle Modelle prozedural im Code erzeugt (`src/world/`) |
| Speicherung | `@capacitor/preferences` (Android SharedPreferences), lokal und ohne Konto |
| Spracheingabe | Android-Systemdialog `RecognizerIntent` (Erkennungsdienst des Geräts) |
| Sprachausgabe | Android `TextToSpeech`, Deutsch |
| Rückkehrhilfe | eigenes Plugin: `ReminderController` mit Handler und AlarmManager-Rückfallebene |
| Wissensfolge | `MediaPlayer` mit Audiofokus, Datei lokal in den App-Assets |
| Spotify | ausschließlich Öffnen eines Playlist-Links (siehe [docs/SPOTIFY.md](docs/SPOTIFY.md)) |
| Haptik | `@capacitor/haptics` |

### Verzeichnisse

```
src/
  domain/      Spielstand, Fortschrittsverteilung, Vorlagen (rein, ohne DOM, getestet)
  world/       Gelände, Vegetation, Kapsel, Hütte, Figuren, Szenensteuerung
  content/     Wissenskarten, Quellen, Skript der Wissensfolge
  app/         App-Steuerung, Speicherung, Audio-Koordination
  ui/          Bildschirme, Einblendungen, Logo, DOM-Helfer
  platform/    Schnittstelle zu Android bzw. Browser
android/app/src/main/java/de/mindstella/prototyp/
  MindstellaPlugin.java    Spracheingabe, Sprachausgabe, Benachrichtigungsrecht, Links, Audio
  ReminderController.java  30-Sekunden-Rückkehrhilfe, Unterscheidung Appwechsel/Displaysperre
  ReminderReceiver.java    AlarmManager-Rückfallebene
  PodcastPlayer.java       Wiedergabe mit Audiofokus
tests/unit/    Node-Test-Runner: Fortschritt, Spielstand, Vorlagen
tests/e2e/     Playwright-Durchlauf der Web-Fassung mit Screenshots
docs/          Status, Testanleitung, Spotify-Prüfung, Skript der Wissensfolge
```

### Datenmodell

Der Spielstand liegt als ein JSON-Dokument unter dem Schlüssel `mindstella.save.v1`. Reale Aufgaben (`task`), ausdrücklich gespeicherte Abläufe (`routines`), geparkte Gedanken (`parked`) und der Fortschritt der Welt (`world`) sind getrennte Bereiche. Spätere Kapitel können `world` erweitern, ohne Aufgaben oder Abläufe anzufassen. Beim Laden prüft `migrate()` die Version und verwirft unlesbare Stände, statt abzustürzen.

### Baufortschritt bei beliebiger Schrittzahl

Die Hütte besteht aus 74 Bauelementen in sieben Abschnitten (`src/world/hutPlan.js`). Beim Abhaken werden die noch fehlenden Elemente gleichmäßig auf die offenen Schritte verteilt, der letzte Schritt erhält den Rest (`src/domain/progress.js`). Daraus folgt: Jeder Schritt baut mindestens ein Element, bereits Gebautes bleibt stehen, und Verkleinern oder ein Abbruch verändern nur die Verteilung des Rests. Ein Abhaken muss die ID des aktuellen Schritts mitgeben; ein schneller zweiter Tipp trägt eine veraltete ID und wird verworfen. Zusätzlich sperrt die Oberfläche den Knopf für 700 ms.

## Entwickeln und testen

Voraussetzungen: Node.js 22, npm.

```bash
cd mindstella
npm ci
npm test                 # Unit-Tests (Node-Test-Runner)
npm run dev              # Browser-Vorschau unter http://localhost:5173
```

End-to-End-Durchlauf der Web-Fassung (benötigt Playwright mit Chromium und für den Audiotest `ffmpeg`):

```bash
npm run build
npx vite preview --port 4173 &
npm run test:e2e         # Screenshots landen in tests/e2e/screenshots/
```

Die Browser-Vorschau zeigt Welt und Ablauf vollständig. Rückkehrhilfe, Benachrichtigungsrecht und die Android-Spracherkennung gibt es dort nicht; die Vorschau weist das jeweils aus.

## Android-Testfassung bauen

### Über GitHub Actions (empfohlen)

Der Workflow `.github/workflows/mindstella-android.yml` baut bei jeder Änderung unter `mindstella/` eine Debug-APK und lädt sie als Artefakt `mindstella-testfassung` hoch (30 Tage gespeichert). In GitHub: *Actions* → *Mindstella Android-Testfassung* → letzter Lauf → *Artifacts*. Der Lauf lässt sich dort auch manuell starten.

Ohne weitere Einrichtung signiert jeder Lauf mit einem neuen temporären Debug-Schlüssel. Android lehnt dann ein Update über eine ältere Installation ab; die alte Fassung muss vorher deinstalliert werden, wobei der lokale Spielstand verloren geht. Für gleichbleibende Signaturen einmalig einen Test-Keystore anlegen und als Repository-Secrets hinterlegen:

```bash
keytool -genkeypair -v -keystore mindstella-test.jks -alias mindstella -keyalg RSA -keysize 2048 -validity 3650
base64 -w0 mindstella-test.jks   # Ausgabe als Secret MINDSTELLA_KEYSTORE_B64
```

Weitere Secrets: `MINDSTELLA_KEYSTORE_PASSWORD`, `MINDSTELLA_KEY_ALIAS` (hier `mindstella`), `MINDSTELLA_KEY_PASSWORD`. Den Keystore nicht ins Repository legen.

### Lokal mit Android Studio

Voraussetzungen: JDK 21, Android SDK mit Plattform 36 (Android Studio ab Ladybug).

```bash
cd mindstella
npm ci
npm run android:sync     # baut den Web-Teil und kopiert ihn nach android/
cd android
./gradlew assembleDebug  # APK: app/build/outputs/apk/debug/app-debug.apk
```

Alternativ `npx cap open android` und in Android Studio starten.

## App-Symbol und Startbild

`node tools/render-icons.mjs` erzeugt alle Launcher-Symbole und Startbilder aus dem Mindstella-Zeichen (Playwright mit Chromium nötig). Wird das Zeichen durch den freigegebenen Entwurf ersetzt, genügt es, das SVG im Skript und in `src/ui/logo.js` auszutauschen und das Skript erneut auszuführen.

## Wissensfolge einbinden

Die Audiodatei ist noch nicht produziert. Das geprüfte Skript liegt in [docs/wissensfolge-kapitel-1.md](docs/wissensfolge-kapitel-1.md) (erzeugt mit `npm run export:script`). Die fertige Datei gehört nach `public/audio/kapitel-1-huettenbau.mp3`; nach `npm run android:sync` und einem neuen Build erkennt die App sie automatisch. Bis dahin zeigt die App ausdrücklich an, dass keine Aufnahme vorliegt, und bietet das Skript zum Lesen an.

## Lizenzen

Eigener Code und alle 3D-Modelle: im Rahmen dieses Projekts erstellt. Fremde Bestandteile:

| Bestandteil | Lizenz |
| --- | --- |
| three.js | MIT |
| Capacitor (core, android, cli, app, haptics, preferences) | MIT |
| Atkinson Hyperlegible Next (Braille Institute) | SIL Open Font License 1.1 |
| Jost (Owen Earl) | SIL Open Font License 1.1 |

Der Holzklang beim Abhaken wird zur Laufzeit synthetisch erzeugt; es werden keine fremden Audiodateien verwendet.
