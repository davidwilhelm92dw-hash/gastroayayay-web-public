# Status Prototyp Kapitel 1

Stand: 26. Oktober 2026, nach dem Ergänzungsauftrag (ein Hauptcharakter, räumliche Welt, Hausarbeit nach Räumen). Entwicklung und Selbstprüfung erfolgten in derselben Hand; eine unabhängige Qualitätsprüfung steht aus.

## Erledigt

- **Ein fester Hauptcharakter.** Figurenwahl und Auswahlbildschirm sind entfernt, es gibt keinen Editor. Die Figur folgt den Referenzbildern in Kleidung, Proportionen und Materialien: offene Jacke über olivgrünem Hemd mit hochgekrempelten Ärmeln, Cargohose mit Taschen, Stiefel, Gürtel, Rucksack. Die Haare sind zerzaust und etwas kürzer als in der vorigen langen Fassung, die Pilotenbrille sitzt auf dem Kopf, das Lederband läuft von der Außenkante der Gläser um den Hinterkopf und hat eine Schnalle. Das Gesicht ist bewusst nicht geschlechtlich festgelegt.
- **Welt.** Plateau mit Bauplatz und Weg im Vordergrund, Hang zum See mit Inseln, bewaldeter Hügel, drei gestaffelte Bergketten, fremdartige Nadelbäume und Pflanzen, drei Monde als feste Himmelsrichtungen. Keine Häuser, Städte, Laternen oder Siedlungslichter. Tag und Nacht zeigen dieselbe Geografie; die Nacht kommt nur beim Kapitelabschluss, ein automatischer Tageswechsel ist nicht eingebaut.
- **Kamera.** Leicht erhöht hinter der Figur. Die Oberfläche meldet den freien Bildbereich über der Aufgabenkarte, die Kamera passt Abstand und Bildmitte so an, dass Figur und bisher Gebautes darin Platz finden.
- **Bauübersicht vor dem Kapitel** mit acht Abschnitten: Holz sammeln, Unterbau (Steinsockel und Schwellen), Boden, Tragwerk, Aussteifung, Wände, Dach, Witterungsschutz. Der Hinweis erklärt, dass jeder abgehakte Schritt den Bau weiterbringt, unabhängig von der Schrittzahl.
- **Hütte aus 82 Bauelementen.** Eine Hauptaufgabe ergibt genau eine vollständige Hütte; jeder Schritt baut mindestens ein sichtbares Element. Die Figur geht erst nach „Erledigt“ los, holt im ersten Abschnitt Stämme vom Holzplatz und arbeitet danach an der Baustelle. Warten erzeugt keinen Fortschritt.
- **Hausarbeit nach Räumen.** Küche, Bad, Wohnzimmer, Schlafzimmer, Flur, Wäsche; je Raum antippbare Tätigkeiten, häufige oben, seltenere darunter. Die gewählten Tätigkeiten werden in eine sinnvolle Reihenfolge gebracht (Bad: Spiegel, Waschbecken, Ablagen, Toilette zuletzt). Kleine Tätigkeiten wie Fernseher abstauben (Wohn- und Schlafzimmer) und Sofakissen hinrichten sind enthalten. Eigene Aufgaben per Text oder Sprache bleiben möglich.
- **Beibehalten:** Hörwahl (Spotify-Playlist-Link, Wissensfolge, ohne Audio), lokale Speicherung, Wiederaufnahme, Pause, Verkleinern, Gedanken parken, Wissenskarten, Rückkehrhilfe. Keine kostenpflichtigen Dienste.
- **Kompakte Aufgabenkarte** im Spiel: Raum, aktueller Schritt, Fortschritt, „Erledigt“, darunter Pause, Kleiner, Parken. Logo und Prozentanzeige sind im Spiel ausgeblendet, damit mehr Welt sichtbar bleibt.
- **Gerätetest im Android-Emulator** als zweiter Job im GitHub-Actions-Workflow (siehe unten).

## Tatsächlich geprüft

**Unit-Tests** (`npm test`): 25 von 25 bestanden. Neu: Räume und Tätigkeiten (Reihenfolge, Toilette zuletzt, Fernseher in beiden Zimmern, Standardauswahl), Vorlagen aus den Räumen.

**End-to-End-Test der Web-Fassung** (`npm run test:e2e`, Chromium mit Software-Rendering, Mobilemulation mit Touch): 83 von 83 Prüfungen bestanden. Dazu gehören:

- Raumauswahl: alle sechs Räume und alle Tätigkeiten per Antippen an- und abwählbar, Reihenfolge im Bad, Fernseher im Schlafzimmer, Übernahme in die Schrittliste.
- Layout auf 360 × 740 und 320 × 568 Pixeln: Figur mindestens 9 Prozent der Bildhöhe, Figur und Baustelle vollständig über der Aufgabenkarte, alle drei Monde im freien Bildbereich, Bauhandlung nach „Erledigt“.
- Bestehende Abläufe: Doppeltipps, Neustart mitten in der Aufgabe, Pause über Neustart, Parken, Verkleinern, kurze und lange Listen, unbekannte Aufgabe, Ausweis der fehlenden Aufnahme, Wissensfolge mit Test-Audiodatei, Spotify-Link, Test-Neustart, fehlerfreie Konsole.

**Android-Build:** Jeder Push baut eine Debug-APK (Artefakt `mindstella-testfassung`).

**Gerätetest im Emulator** (GitHub Actions, Android 15 mit Chrome-WebView 124, 360 dp breit, Touch-Eingaben über adb; letzter Lauf 40414560251, Commit b00e9e1). Bestätigt sind: Die APK installiert und startet, WebGL steht zur Verfügung, die 3D-Welt wird gerendert (Pixelprobe mit Himmel- und Wiesenfarben, 225 Draw-Calls; auf dem adb-Bildschirmfoto sind Himmel, Berge, Bäume, Figur und Bauplan zu sehen), echte Tipps kommen in der WebView an (gemessener Versatz 48 px durch die Statusleiste), die Bauübersicht zeigt acht Abschnitte, die Raumauswahl öffnet sich per Antippen, und ein Raum öffnet seine Tätigkeitsliste.

Nicht zu Ende geführt ist der Emulatorlauf ab der Tätigkeitsauswahl. Der Emulator hat auf dem Runner keine Grafikkarte und berechnet die Szene auf dem Prozessor; gemessen wurden 0,9 bis 1,6 Bilder pro Sekunde. Tipps kamen dadurch erst beim zweiten oder dritten Versuch an, und der Ablauf überschritt die Wartezeiten. Die Rückkehrhilfe (Appwechsel, Displaysperre), die Wiederaufnahme nach dem Beenden und der Bau nach „Erledigt“ sind deshalb im Emulator nicht geprüft; der Bau nach „Erledigt“ ist in der Web-Fassung geprüft. Weitere Läufe würden an dieser Grenze nichts ändern. Die Konsole meldet beim Start „Error injecting safe area CSS“; die Meldung stammt nach meiner Einschätzung aus der Safe-Area-Einbindung von Capacitor, sichtbare Folgen gab es nicht.

Mit `MINDSTELLA_CDP` läuft derselbe Testablauf gegen lokales Chromium (Trockenlauf): 10 von 10 Prüfungen bestanden.

## Implementiert, aber nicht geprüft

- Darstellung, Bildrate und Akkulast auf echten Handys. Die Szene hat rund 225 Draw-Calls und 196 000 Dreiecke. Auf Geräten mit Grafikprozessor ist eine deutlich höhere Bildrate zu erwarten als im Emulator, belegt ist das nicht. Diese Prüfung ist der wichtigste offene Punkt (Testanleitung Nr. 17 bis 19).
- Rückkehrhilfe, Benachrichtigungen und Wiederaufnahme nach dem Beenden auf Android (Testanleitung Nr. 5 bis 14).
- Android-Spracherkennung und Sprachausgabe, Öffnen des Spotify-Links in der Spotify-App, Haptik.
- Native Wiedergabe der Wissensfolge (die Audiodatei fehlt weiterhin).

## Bekannte Grenzen

- **Figur:** Die Figur ist im Code aus Grundformen modelliert, nicht aus einem Modellierungsprogramm. Sie trifft Farben, Kleidung und Proportionen der Referenzen, erreicht aber nicht deren Detailgrad. Für Animationsfilm-Qualität wäre ein von Hand modelliertes und geriggtes Modell (etwa aus Blender als glTF) der nächste Schritt.
- **Rückkehrhilfe:** Der präzise Zeitgeber läuft im App-Prozess; friert Android den Prozess ein, greift ein nicht exakter Alarm, der sich bis etwa 52 Sekunden verspäten kann. Herstellerspezifische Energiesparfunktionen können die Erinnerung zusätzlich verzögern.
- **Wissensfolge im Hintergrund:** ohne Vordergrunddienst; bei langer Displaysperre kann Android die Wiedergabe beenden, die Position bleibt gespeichert.
- **Spracherkennung:** Der Systemdialog überträgt die Aufnahme je nach Gerät an den Anbieter des Erkennungsdienstes. Die App weist vorher darauf hin.

## Blockiert

- **Audiodatei der Wissensfolge:** keine geeignete deutsche Sprachsynthese in der Entwicklungsumgebung. Skript und Einbindung sind fertig.
- **Test-Keystore:** Die Secrets kamen im Build leer an. Bitte prüfen, ob sie unter *Settings → Secrets and variables → Actions* als **Repository-Secrets** (nicht als Environment- oder Codespaces-Secrets) mit genau diesen Namen angelegt sind: `MINDSTELLA_KEYSTORE_B64`, `MINDSTELLA_KEYSTORE_PASSWORD`, `MINDSTELLA_KEY_ALIAS`, `MINDSTELLA_KEY_PASSWORD`. Bis dahin muss vor jedem Update die alte Fassung deinstalliert werden.

## Entscheidung erforderlich

1. **Mindstella-Bildzeichen:** Das Zeichen in `src/ui/logo.js` und `public/icon.svg` ist weiterhin ein vorläufiger Entwurf.
2. **Öffentliches Repository:** Der Prototyp liegt im öffentlichen Repository der Website. Soll er in ein eigenes, privates Repository umziehen?
3. **Stimme für die Wissensfolge:** Auswahl eines Werkzeugs für die einmalige Vorproduktion.
4. **Figur in höherer Qualität:** ob ein von Hand modelliertes Figurenmodell beauftragt oder selbst erstellt werden soll (siehe Bekannte Grenzen).

## Bildschirmfotos

Unter `docs/screenshots/` (Web-Fassung, 360 Pixel breit): Start, Bauübersicht, Raumauswahl, Tätigkeiten im Bad, Ablauf, Aufgabe mit Welt, Zustand nach einem Schritt auf 360 und 320 Pixeln, Kapitelabschluss bei Nacht.
