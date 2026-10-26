# Testanleitung Mindstella, Kapitel 1

Für David und die ausgewählten Testpersonen. Jede Person installiert ihre eigene Testfassung; der Spielstand bleibt auf dem jeweiligen Handy und wird nirgendwohin übertragen.

## Installation

1. Die APK-Datei aus dem GitHub-Actions-Artefakt `mindstella-testfassung` herunterladen (ZIP entpacken) und auf das Android-Handy übertragen, etwa per Kabel oder Cloud-Ordner.
2. Auf dem Handy die Datei antippen. Android fragt, ob die verwendete App (Dateimanager oder Browser) unbekannte Apps installieren darf. Das einmalig für diese App erlauben.
3. Mindstella installieren und öffnen. Voraussetzung ist Android 7 oder neuer.

Wer bereits eine ältere Testfassung installiert hat und beim Update die Meldung „App nicht installiert“ erhält, muss die alte Fassung zuerst deinstallieren. Der Spielstand geht dabei verloren (siehe README, Abschnitt Signatur).

## Erster Durchlauf

1. „Kapitel 1 beginnen“ antippen. Die Einführung erzählt die Ausgangslage und zeigt die acht Bauabschnitte der Hütte.
2. „Hausarbeit auswählen“ antippen, einen Raum wählen und die Tätigkeiten antippen, die du jetzt erledigst. Häufige Tätigkeiten stehen oben, seltenere darunter. Die App ordnet sie in eine sinnvolle Reihenfolge, im Bad etwa Spiegel und Flächen vor der Toilette. Alternativ eine eigene Aufgabe eintippen oder einsprechen.
3. Die Schrittliste prüfen, ändern, umsortieren.
4. Hörwahl treffen: eigene Musik über Spotify, die Wissensfolge oder ohne Audio.
5. Aufgabe erledigen und jeden Schritt mit „Erledigt“ abhaken. Erst dann geht die Figur los und baut; Warten bringt keinen Fortschritt.

## Prüfliste für das echte Gerät

Diese Punkte lassen sich nur auf einem Android-Handy prüfen. Bitte Ergebnis, Handymodell und Android-Version notieren.

| Nr. | Prüfung | Erwartung |
| --- | --- | --- |
| 1 | Aufgabe einsprechen | Systemdialog der Spracherkennung erscheint; erkannter Text steht danach bearbeitbar im Feld. Vor der ersten Nutzung erscheint ein Hinweis zur Datenübertragung. |
| 2 | Mikrofon im Erkennungsdialog verweigern | Fehlermeldung, Texteingabe funktioniert weiter. |
| 3 | Sprachbegleitung im Menü einschalten | Neuer Schritt wird nach dem Abhaken vorgelesen; ausgeschaltet bleibt es still. |
| 4 | Benachrichtigungen beim ersten Start erlauben | Einmalige Frage mit Erklärung, danach Android-Dialog. |
| 5 | Während laufender Aufgabe zu einer anderen App wechseln, nach 10 Sekunden zurück | Keine Benachrichtigung. |
| 6 | Wechseln und 30 Sekunden oder länger wegbleiben | Genau eine Benachrichtigung mit dem aktuellen Schritt. Tatsächliche Verzögerung bitte stoppen und notieren. |
| 7 | Benachrichtigung antippen | App öffnet sich beim selben Schritt. |
| 8 | In der App das Display sperren und 60 Sekunden warten | Keine Benachrichtigung. |
| 9 | Zu einer anderen App wechseln, nach 10 Sekunden Display sperren, 60 Sekunden warten | Keine Benachrichtigung. |
| 10 | Aufgabe pausieren, App verlassen, 60 Sekunden warten | Keine Benachrichtigung. |
| 11 | Benachrichtigungen verweigern, Aufgabe durchspielen | Alles andere funktioniert unverändert. |
| 12 | Energiesparmodus an, Test 6 wiederholen | Verzögerung notieren; kann länger als 30 Sekunden sein. |
| 13 | Spotify-Playlist-Link hinterlegen, „Playlist in Spotify öffnen“ | Richtige Playlist öffnet sich. Notieren, ob die Musik automatisch startet oder ein Tipp nötig ist. Zurück in Mindstella: unveränderter Schritt. |
| 14 | Mitten in der Aufgabe die App über die Übersicht schließen und neu öffnen | Derselbe Schritt, dieselbe Hütte. |
| 15 | Schnell doppelt auf „Erledigt“ tippen | Nur ein Schritt wird abgehakt. |
| 16 | „Weniger Bewegung“ einschalten | Bauteile erscheinen sofort, Rückmeldung bleibt verständlich. |
| 17 | Aufgabenkarte auf dem kleinsten verfügbaren Handy | Text vollständig lesbar, Knöpfe gut treffbar; Figur, Baustelle und drei Monde bleiben über der Karte sichtbar. |
| 18 | Alle Raumkacheln und Tätigkeiten antippen | Jede Kachel reagiert, Häkchen erscheinen und verschwinden zuverlässig. |
| 19 | Bildlauf und Bauanimation | Notieren, ob die Welt flüssig läuft oder ruckelt. |

Für die Wissensfolge (Tests zu Wiedergabe bei gesperrtem Display, Appwechsel, Audiofokus und Offline-Betrieb) muss zuerst die Audiodatei produziert und eingebunden werden. Bis dahin zeigt die App an, dass keine Aufnahme vorliegt; das ist das erwartete Verhalten dieser Fassung.

## Neu anfangen

Im Menü unter „Nur für Tests“ setzt der Test-Neustart Kapitel 1 nach einer Rückfrage zurück. Einstellungen, gespeicherte Abläufe und geparkte Gedanken bleiben erhalten.

## Rückmeldung nach dem Test

Bitte nach einigen Tagen kurz beantworten, gern in eigenen Worten:

1. Fiel es dir mit Mindstella leichter, mit einer Aufgabe anzufangen? Woran lag das, oder warum nicht?
2. Wenn du unterbrochen oder abgelenkt wurdest: Hat dir die App geholfen, zum richtigen Schritt zurückzufinden?
3. War immer klar, was als Nächstes zu tun ist? Wo warst du unsicher?
4. Hat die Welt dich motiviert, oder hat sie abgelenkt oder belastet? Was war zu viel oder zu wenig?
5. Hast du Spracheingabe, Vorlesen, Musik oder Wissensfolge genutzt? Was davon würdest du behalten?
6. Gab es Fehler, Abstürze oder Stellen, an denen die App anders reagierte als erwartet?

Die Antworten dienen der Weiterentwicklung. Sie sind kein Nachweis einer Wirkung und werden nicht als solcher verwendet.
