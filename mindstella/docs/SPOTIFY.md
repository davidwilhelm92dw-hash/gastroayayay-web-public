# Spotify im Prototyp

## Entscheidung

Mindstella öffnet ausschließlich eine vom Nutzer hinterlegte Playlist über ihren Link (`https://open.spotify.com/playlist/…` oder `spotify:playlist:…`). Es gibt keine SDK- oder Web-API-Einbindung, keine Anmeldung bei Spotify und keine Wiedergabesteuerung aus der App heraus. Entsprechend zeigt die App keine Play-, Pause- oder Überspringen-Schaltflächen für Spotify, sondern nur „Playlist in Spotify öffnen“. Bauanimationen sind nicht mit der Musik synchronisiert.

## Prüfung am 26. Oktober 2026

Die Seiten `developer.spotify.com/policy` und `developer.spotify.com/compliance-tips` waren aus der Entwicklungsumgebung nicht direkt abrufbar (Netzwerksperre). Über eine Websuche ließ sich der Inhalt der Developer Policy prüfen; die gefundene Fassung ist auf Mai 2025 datiert, eine neuere Fassung war in den Ergebnissen nicht zu finden. Danach gilt:

- Die Policy nennt unter den unzulässigen Anwendungen ausdrücklich: „Do not create a game, including trivia quizzes.“
- Sie schränkt Streaming-Integrationen ein und untersagt unter anderem, Spotify-Audio mit anderem Audio zu überlagern.
- Ob eine Aufgabenhilfe mit Aufbauwelt unter das Spieleverbot fällt, beantwortet die Policy nicht ausdrücklich. Antworten im Spotify-Entwicklerforum deuten auf eine weite Auslegung hin; sie sind aber keine verbindlichen Aussagen von Spotify.

Die im Auftrag genannten Grenzen des Web-API-Development-Mode (Premium-Abo des App-Inhabers, fünf autorisierte Nutzer bei neu eingerichteten Anwendungen) konnten in dieser Sitzung nicht erneut an der Primärquelle geprüft werden.

## Folgerung

Eine direkte Integration bleibt bis zu einer belastbaren Klärung, idealerweise einer schriftlichen Auskunft von Spotify, außerhalb des Prototyps. Das Öffnen eines öffentlichen Playlist-Links ist davon nicht betroffen, weil dabei keine Spotify-Entwicklerschnittstelle genutzt wird.

## Verhalten auf dem Gerät (noch zu prüfen)

- Ist die Spotify-App installiert, öffnet Android den Link in der Regel direkt dort. Ob die Wiedergabe automatisch beginnt oder ein Tipp auf „Abspielen“ nötig ist, entscheidet die Spotify-App. Das Ergebnis bitte im Testprotokoll vermerken.
- Ohne Spotify-App öffnet sich der Link im Browser.
- Der Wechsel zu Spotify zählt als Appwechsel: Nach 30 Sekunden kann die Rückkehrhilfe erscheinen.
- Beim Öffnen pausiert Mindstella die eigene Wissensfolge. Startet Spotify die Wiedergabe, verliert die Wissensfolge zusätzlich den Audiofokus und bleibt angehalten.
