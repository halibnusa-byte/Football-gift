# Football Gift Challenge — Projekt-Audit

Stand: 27. November 2026  
Arbeitszweig: `comeback-era-build-2026-11-27`  
Status: Entwicklungsstand, nicht produktionsbereit.

## Bereits im Projekt umgesetzt

### Runden und Geschenke
- 15 gemeinsame Geschenkboxen pro Runde.
- Höchstens 3 Öffnungen je Spieler und Runde.
- Jede Box-Öffnung wird pro Spieler und Runden-ID atomar beansprucht und vor der Belohnung gespeichert; ein Neuladen kann dieselbe Box nicht erneut öffnen. Die Drei-Box-Grenze wird ebenfalls atomar über alle Tabs hinweg durchgesetzt.
- Beim erneuten Beitritt wird die sichtbare Rundendarstellung mit dem atomaren Claim-Ledger abgeglichen. So bleiben bestätigte Öffnungen auch dann sichtbar, wenn das zusätzliche Rundensnapshot-Schreiben nach dem Claim fehlschlägt; der Spieler erhält dafür einen Hinweis.
- Gemeinsamer Live-Spielstand und Runden-Neustart.
- Ein Shop-Punkt pro geöffneter Box; Kontostand wird in der Datenbank gespeichert.
- Bestehende Gewinnliste und Belohnungslogik bleiben erhalten.

### Tokens und Seltenheiten
- Die sechs vereinbarten Haupt-Tokens: Revenge Token, Double Goal Token, Football Loser Token, Selbst-Retter-Token, Freistoß-Token und Football Token.
- Die Wahrscheinlichkeitsreihenfolge dieser sechs Haupt-Tokens ist in der Gewinnliste abgestuft.
- Football Token wird über eine globale Datenbank-Transaktion nur einmal vergeben.
- Zusätzliche Token-Freischaltungen werden erst nach dem tatsächlichen Beenden des Skibidi-Events gesetzt, nicht beim Start.
- Weitere ältere Preise wie Comeback-, Deine-Wahl-, Penalty- und Spielvorteil-Preise bleiben erhalten.
- Galaxy Gift kann nur während des Galaxy Events erscheinen; Chance: 0,001 %. Eine vom Admin vorgemerkte Galaxy-Box garantiert außerhalb des Galaxy Events keinen Galaxy-Gewinn.
- Galaxy-Belohnungsauswahl berücksichtigt den globalen Football-Token-Besitzer.

### Events
- Bestehende Spezialevents bleiben vorhanden: Galaxy, Diamond, Hacker, Unicorn/Piñata, Robot, Zauberwürfel, Skibidi, Godzilla vs. Kong, Time Travel, School, Lava, Alien Invasion, LaserTag, Ocean, Zombie, Blitz, Spider-Man, Coca-Cola, Pflanzen und Elefanten.
- Ocean: drei pro Spieler und Event-Runde gespeicherte Truhen, Goldener-Hai-Ereignis, Pearl Radar.
- Zombie: fünf Serum-Fläschchen, ein sicheres Serum, Zombie Detector.
- 34 Standardevents besitzen eigene spielbare Mini-Challenges: Reaktion, Gedächtnis, Reihenfolge, Schatzkarte, Elfmeter, Wissensfragen und Auswahl-Challenges. Insgesamt sind 45 Event-Challenges im Spieler-Panel erreichbar; das Ocean-Panel wurde ergänzt.
- Zufällige Ergebnisse für Schatzkarte, Portalwahl und Elfmeter werden pro Spieler und Event-Durchlauf gespeichert, damit Neuladen die Auswahl nicht neu auswürfelt.
- Godzilla-vs.-Kong-Abstimmung bleibt an den Videoclip und die vom Admin gespeicherte Gewinnerseite gebunden.
- Time Travel behält die vereinbarten Fußballstar-Clips und den Rückweg zum Event.
- Skibidi behält seine fünf Boss-Stufen.

### Admin Abuse und Power Hours
- Admin Abuse kann nur der Hauptadmin starten und stoppen.
- Zufällige Empfängerauswahl für Geschenke, Tokens, Galaxy-Truhen und Blitz ist nur während Admin Abuse möglich; sie bestimmt ausschließlich einen anderen Online-Spieler als Empfänger, niemals die Belohnung. Der Hauptadmin wählt Geschenk/Token/Event-Aktion.
- Teilnehmer am Admin Abuse werden beim Start und beim Beitritt während des aktiven Durchlaufs auf dem jeweiligen Spielerprofil markiert. Das Comeback Gift wird anhand dieser gespeicherten Teilnehmer vergeben, nicht anhand einer späteren Online-Liste.
- Der Admin-Abuse-Tippgeber zeigt nur dem Hauptadmin während aktivem Admin Abuse Hinweise, sortiert nach DRINGEND, EMPFEHLUNG und OPTIONAL. Er führt keine Aktionen selbst aus.
- Legendary Comeback Gift kann für einen gestarteten Admin-Abuse-Durchlauf an dessen gespeicherte Teilnehmer vergeben werden. Erfasst werden Spieler, die beim Start online sind oder während des aktiven Durchlaufs beitreten; die Vergabe kann auch nach Ende des Durchlaufs erfolgen. Jeder Teilnehmer erhält drei verdeckte Karten und wählt eine. Der Titel OG COMEBACK PLAYER und das kosmetische Cape bleiben erhalten.
- Power Hours: Sonntag–Freitag 15:00–17:00 Uhr, Samstag ganztägig. Normale Spieler erhalten mindestens 2× Glück; das globale Hauptadmin-Glück ist 1×–5×. Werte werden nicht miteinander multipliziert.

### Shop
- Dauerhafte Shop-Punkte und gespeicherter Kontostand.
- Admin kann Produkte hinzufügen, Preise und Beschreibungen ändern, aktivieren/deaktivieren und löschen.
- Kaufaktionen verwenden denselben zusammengeführten Katalog wie die Anzeige, damit Standard- und Admin-Produkte gleichermaßen kaufbar bleiben.
- Zeitlich begrenzte Angebote mit regulärem und reduziertem Preis.
- Vorhandene Power-ups bleiben: Magic Remix, Lava Shield, Alien Radar, Pearl Radar, Zombie Detector und Goldene Zeugnisnote.
- Die jeweiligen Power-ups sind mit den dazugehörigen Events verbunden.

### LaserTag
- 3D-Arena mit fünf dreidimensionalen Skins: Space Trooper, Battle Robot, Titan Armor, Alien Runner und Shadow Ninja.
- Skin-Auswahl, 3 Leben, fünf Minuten Spielzeit, Echtzeit-Spielerstände und Rangliste.
- Top-3-Belohnungen sind vorgesehen; Doppel-Auszahlung wird durch Transaktionslogik begrenzt.
- PC- und Touch-Steuerung sind im Code vorgesehen.

### Rollen, Chat und Comeback
- Rollenoberflächen und Admin-Verwaltung für Hauptadmin, Halb-Admin, Viertel-Admin und Message Man.
- Message Man ist als Chat-Rolle vorgesehen.
- Live-Chat, eigene Nachricht löschen, Melden und Admin-Moderation.
- Admin-Abuse-Tippgeber analysiert Chat-Muster regelbasiert; es ist kein autonomes KI-System.
- Comeback-Gift, OG-Comeback-Titel und kosmetisches Cape.
- Lockdown-Oberfläche mit Hauptadmin-Ausnahme ist vorhanden.

## Wahrscheinlichkeiten und offene Werte
- Im bisherigen Token-Abgleich bestätigte Werte im Code: Revenge Token 0,00025 %, Double Goal Token 0,0005 %, Selbst-Retter-Token 0,001 %, Freistoß-Token 0,0015 %, Football Token 0,002 %. Football Token bleibt global einmalig.
- Die endgültige Chance des Football Loser Token sowie die Seltenheiten der Geschenkboxen, Diamond-Restchance und weitere nicht ausdrücklich bestätigte Event-Chancen müssen noch abgeglichen werden. Vorhandene Zahlen im Code gelten nicht automatisch als freigegeben.

## Automatische Prüfungen
- JavaScript-Modul-Syntaxprüfung in GitHub Actions.
- Statische Invariantentests für Token-IDs, globalen Football-Token, Galaxy-Event-Bedingung, persistente Box-Claims, Box-Anzahl, Öffnungsgrenze, Wiederabgleich des Claim-Ledgers, gespeicherte Event-Challenges und Ocean-/Zombie-Lootdaten, 3D-LaserTag, Shop-Katalog/Käufe und Mini-Game-Abdeckung.
- GitHub Actions: Die Push-Syntax- und Invariant-Prüfungen für den Box-Claim-Abgleich sind auf Commit `d4f6694e863ce10e49da9ca47c69a4dc342d2678` erfolgreich durchgelaufen; die Pull-Request-Prüfung mit den ergänzten neuen Invariantentests läuft noch.

## Noch nicht nachgewiesen / blockiert

1. **Firebase-Sicherheit:** Die bestehende Client-Code-Prüfung ist keine sichere Admin-Authentifizierung. Rollen und sensible Aktionen müssen serverseitig über Firebase Authentication Custom Claims und vertrauenswürdige Cloud Functions/Admin SDK abgesichert werden.
2. **Realtime Database Rules:** Die aktuelle Regeldatei ist ausdrücklich kein sicherer Produktionsschutz. Sie darf nicht als fertige Sicherheitslösung veröffentlicht werden.
3. **Browser- und Mobiltests:** Die gesamte Oberfläche muss in echten Browsern und auf Android getestet werden.
4. **Mehrspieler:** Mindestens zwei getrennte Konten müssen gleichzeitig Chat, Boxen, Runden, Events, LaserTag und Admin-Rollen testen.
5. **LaserTag:** 3D-Rendering, Touch-Steuerung, Kollisionen, Latenz, Ausscheiden und Top-3-Auszahlung benötigen einen echten Live-Test.
6. **Event-End-to-End:** Für jedes Event müssen Start, einmalige Teilnahme, Belohnung, Niete, Neuladen und Event-Ende praktisch getestet werden.
7. **Datenbank-Migration:** Es ist noch nicht geprüft, ob alle bestehenden Spielerdaten und alten Runden ohne Datenverlust in allen neuen Funktionen funktionieren.

## Release-Regel

Der Pull Request bleibt Entwurf. `main` und die öffentliche GitHub-Pages-App werden nicht verändert, solange die oben genannten Sicherheits- und Praxistests nicht abgeschlossen sind. Keine permissiven Firebase-Regeln veröffentlichen, um Funktionen scheinbar zum Laufen zu bringen.
