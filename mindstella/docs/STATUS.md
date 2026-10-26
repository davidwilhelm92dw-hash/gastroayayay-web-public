# Status Prototyp Kapitel 1

Stand: 26. Oktober 2026. Entwicklung und Selbstprüfung erfolgten in derselben Hand; eine unabhängige Qualitätsprüfung steht aus.

## Erledigt

- Vollständiger Quellcode der Android-App (Capacitor 8, Three.js) mit eigenem nativem Plugin für Spracheingabe, Sprachausgabe, Rückkehrhilfe, Wissensfolgen-Wiedergabe und Spotify-Link.
- Fünf Figuren (Abenteurerin, Abenteurer, Forscherin, Forscher, geschlechtsneutrale Figur „Navigation“) mit längeren, wilden Haaren und Pilotenbrille, deren Lederband durchgehend von der Außenkante des einen Glases um den Hinterkopf zur Außenkante des anderen läuft.
- Zusammenhängende Welt: Wiese mit fremdartiger Vegetation, Gebirge mit Pass, drei Monde, verunglückte Landekapsel mit Schleifspur, Vorratskisten, Materiallager, Signal hinter dem Pass nach Kapitelabschluss.
- Geschichte nach Vorgabe: Bruchlandung nach Kollision, Funkkontakt abgerissen, Signal hinter dem Gebirge; Einführung überspringbar und mit Überblick über die sieben Bauabschnitte.
- Hütte aus 74 Bauelementen; Fortschrittsverteilung für beliebige Schrittzahl; genau eine vollständige Hütte pro abgeschlossener Hauptaufgabe; Verkleinern ohne Zusatzbelohnung und ohne Verlust an Gebautem.
- Aufgabenerfassung per Text oder Systemspracherkennung mit vorherigem Datenschutzhinweis, Zerlegung diktierter Schritte, gespeicherte Abläufe vor Vorlagen, drei Vorlagen, ehrliche Rückfrage bei unbekannten Aufgaben, Bearbeiten und Umsortieren vor dem Start.
- Hilfen: Pause, Schritt verkleinern, Gedanken parken (Text oder Sprache), „Faden sichern“ als optionales Feld im selben Erfassungsablauf, Anzeige beim Abschluss.
- Acht Wissenskarten mit getrennter Kennzeichnung von Sachwissen und Fiktion sowie Quellenangaben; freischaltend je Bauabschnitt, jederzeit schließbar.
- Hörwahl mit drei Optionen; Spotify nur als Playlist-Link; Wissensfolgen-Player mit Zeit, Position, Fortsetzen auf Wunsch; Koordination mit Sprachbegleitung und Aufgabenpause.
- Skript der Wissensfolge (842 Wörter, ca. 6,5 Minuten), Fiktion und Sachwissen gekennzeichnet, mit Quellen.
- Test-Neustart, Einstellungen für Sprachbegleitung, Haptik, Ton und reduzierte Bewegung.
- App-Symbol und Startbild mit dem Mindstella-Zeichen; kein Cloud-Backup der persönlichen Aufgaben.
- GitHub-Actions-Workflow für eine reproduzierbare Debug-APK, Build-Anleitung, Testanleitung.

## Tatsächlich geprüft

**Unit-Tests** (`npm test`, 20 Prüfungen, alle bestanden): Fortschrittsverteilung für 1 bis 74 Schritte, gleichmäßige Verteilung, Doppeltipp auf Logikebene, Verkleinern, Pause, Parken, Speichern und Laden, Abbruch mit anschließender Fertigstellung, leere Eingaben, beschädigter Spielstand, Zerlegung diktierter Texte, Vorlagen- und Ablaufzuordnung.

**End-to-End-Test der Web-Fassung** (`npm run test:e2e`, Chromium mit Software-Rendering, Handyformat 360 × 760): siehe Abschnitt „Ergebnis E2E“ unten. Geprüft werden unter anderem Doppeltipps über die echte Oberfläche, Neustart mitten in der Aufgabe, Pause über Neustart hinweg, Parken, Verkleinern, kurze (2) und lange (20) Liste, unbekannte Aufgabe, Ausweis der fehlenden Aufnahme, Wiedergabe, Position und Fortsetzen der Wissensfolge mit einer Test-Audiodatei, Überschneidungsfreiheit von Vorlesen und Folge, Spotify-Link, Test-Neustart und fehlerfreie Konsole.

**Kompilierprüfung des Java-Codes** gegen das Android-Framework (Robolectric `android-all` API 36) mit Stubs für Capacitor und AndroidX. Dabei wurde ein Initialisierungsfehler in `PodcastPlayer.java` gefunden und behoben. Ein vollständiger Gradle-Build war in der Entwicklungsumgebung nicht möglich, weil `dl.google.com` (Android SDK, AndroidX) gesperrt war.

## Implementiert, aber nicht geprüft

- Der gesamte Android-Build (Gradle, Ressourcen, Manifest, Plugin-Registrierung). Erster echter Nachweis ist der GitHub-Actions-Lauf.
- Rückkehrhilfe nach 30 Sekunden, Unterscheidung zwischen Appwechsel und Displaysperre, Aufheben bei Rückkehr, Pause oder Sperre, Antippen der Benachrichtigung.
- Benachrichtigungsfreigabe unter Android 13 und neuer.
- Android-Spracherkennung (`RecognizerIntent`) und Sprachausgabe (`TextToSpeech`).
- Native Wiedergabe der Wissensfolge mit Audiofokus, bei gesperrtem Display und nach Appwechsel.
- Öffnen des Spotify-Links in der Spotify-App.
- Haptik, Darstellung und Bildrate auf echten Geräten.

## Bekannte Grenzen

- **Rückkehrhilfe:** Die Erkennung der Displaysperre stützt sich auf `PowerManager.isInteractive()`, `KeyguardManager.isKeyguardLocked()` und das System-Ereignis `ACTION_SCREEN_OFF`. Die genaue Verzögerung kommt von einem Handler im laufenden Prozess. Friert Android den Prozess im Hintergrund ein, greift ein nicht exakter Alarm, der sich nach Android-Regeln um bis zu etwa 75 Prozent der Wartezeit verspäten kann (also bis rund 52 Sekunden). Exakte Alarme würden eine zusätzliche, vom Nutzer zu erteilende Berechtigung erfordern und wurden bewusst nicht verwendet. Herstellerspezifische Energiesparfunktionen können die Erinnerung verzögern oder unterdrücken.
- **Wissensfolge im Hintergrund:** Die Wiedergabe läuft ohne Vordergrunddienst. Bei längerer Displaysperre kann Android den Prozess beenden; dann bleibt die zuletzt gespeicherte Position erhalten. Zeigt der Gerätetest Abbrüche, ist ein Media-Vordergrunddienst die nächste Ausbaustufe.
- **Spracherkennung:** Der Android-Systemdialog überträgt die Aufnahme je nach Gerät an den Anbieter des Erkennungsdienstes, meist Google. Die App weist vor der ersten Nutzung darauf hin und speichert keine Aufnahmen.
- **Leistung:** Die Szene hat rund 130 Draw-Calls und 130 000 Dreiecke. Auf Mittelklassegeräten sollte das flüssig laufen; geprüft ist es nicht.
- **Quellenprüfung:** Die Fachaussagen wurden anhand von Textauszügen geprüft, weil die Volltexte aus der Entwicklungsumgebung nicht abrufbar waren. Vor einer Veröffentlichung ist ein Abgleich mit den Volltexten vorgesehen.

## Blockiert

- **Push nach GitHub:** Der Push auf `claude/mindstella-prototype-chapter-one-kyozrr` wurde mit HTTP 403 abgelehnt; die Claude-GitHub-App hat für dieses Repository keinen Schreibzugriff. Die Arbeit liegt als Commit in der Sitzung vor. Abhilfe: GitHub unter https://claude.ai/connect-github neu verbinden bzw. die Claude-GitHub-App für das Repository installieren. Erst danach läuft der APK-Build.
- **Installierbare APK:** Hängt am Push und am ersten Actions-Lauf.
- **Audiodatei der Wissensfolge:** In der Entwicklungsumgebung war keine geeignete deutsche Sprachsynthese verfügbar (Modell-Downloads gesperrt). Skript und Einbindung sind fertig.
- **Spotify-Primärquellen:** `developer.spotify.com` war nicht erreichbar; die Policy wurde über Suchergebnisse geprüft (siehe `docs/SPOTIFY.md`).

## Entscheidung erforderlich

1. **Mindstella-Entwurf:** Der im Auftrag erwähnte Entwurf (Bildzeichen, Figuren) lag nicht bei. Das verwendete Bildzeichen (vierstrahliger Stern über Horizontbogen mit kleinem Mond) ist ein vorläufiger Platzhalter in `src/ui/logo.js` und `public/icon.svg`. Bitte den freigegebenen Entwurf nachreichen; Figuren und Zeichen werden dann angeglichen.
2. **Öffentliches Repository:** Das Ziel-Repository `gastroayayay-web-public` ist öffentlich und dient der Website „GASTRO AYAYAY!“. Soll der Prototyp dort liegen oder in ein eigenes, privates Repository umziehen? Inhaltlich enthält der Code keine privaten Daten.
3. **Test-Keystore:** Für Updates ohne Datenverlust einmalig einen Keystore anlegen und als Secrets hinterlegen (README).
4. **Stimme für die Wissensfolge:** Auswahl eines Dienstes oder Werkzeugs für die einmalige Vorproduktion mit gekennzeichneter KI-Stimme.

## Ergebnis E2E

Letzter Gesamtlauf: 48 von 48 Prüfungen bestanden. Nach der anschließenden Umstellung von Systemdialogen auf In-App-Bestätigungen wurden die betroffenen Abschnitte erneut ausgeführt: Ablauf 1 mit 24 von 24 und „Unbekannte Aufgabe“ mit 4 von 4 Prüfungen (einschließlich des neuen Hinweises vor der Spracheingabe). Ausgewählte Screenshots liegen unter `docs/screenshots/`.

Während der Tests gefundene und behobene Fehler:

- Abdunklung des Startbildschirms fing Tipps ab.
- Bauanimation dauerte bei vielen Bauteilen pro Schritt bis zu 20 Sekunden; jetzt ein Gang und höchstens acht Hammerschläge.
- Während die Wissensfolge lief, wurde die Aufgabenkarte jede Sekunde neu gezeichnet; Tipps auf „Erledigt“ konnten dadurch verloren gehen.
- Ein durch die Doppeltipp-Sperre abgewiesener Tipp ließ den Knopf dauerhaft deaktiviert.
- Nach einem App-Neustart konnte die gespeicherte Hörposition beim Zurückkehren in die App auf 0 gesetzt werden.
- Initialisierungsfehler in `PodcastPlayer.java` (hätte den Android-Build verhindert).
- Das Spotify-Linkfeld war auch bei anderer Hörwahl sichtbar.

## Interaktive Vorschau

Die Web-Fassung ist zusätzlich als private Claude-Vorschau veröffentlicht. Sie zeigt Welt und Ablauf; Rückkehrhilfe, Android-Spracherkennung und Benachrichtigungen fehlen dort, `window.open` für Spotify ist im Vorschaurahmen eingeschränkt. Ob die Vorschau im Claude-Rahmen fehlerfrei lädt, wurde nicht geprüft.
