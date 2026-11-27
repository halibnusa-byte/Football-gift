# Football Gift Challenge — Projekt-Audit

Stand: 27. November 2026  
Arbeitszweig: `comeback-era-build-2026-11-27`  
Status: Entwicklungsstand, nicht produktionsbereit.

## Bereits im Projekt umgesetzt

### Runden und Geschenke
- 15 gemeinsame Geschenkboxen pro Runde.
- Höchstens 3 Öffnungen je Spieler und Runde.
- Gemeinsamer Live-Spielstand und Runden-Neustart.
- Ein Shop-Punkt pro geöffneter Box; Kontostand wird in der Datenbank gespeichert.
- Bestehende Gewinnliste und Belohnungslogik bleiben erhalten.

### Tokens und Seltenheiten
- Die sechs vereinbarten Haupt-Tokens: Revenge Token, Double Goal Token, Football Loser Token, Selbst-Retter-Token, Freistoß-Token und Football Token.
- Die Wahrscheinlichkeitsreihenfolge dieser sechs Haupt-Tokens ist in der Gewinnliste abgestuft.
- Football Token wird über eine globale Datenbank-Transaktion nur einmal vergeben.
- Weitere ältere Preise wie Comeback-, Deine-Wahl-, Penalty- und Spielvorteil-Preise bleiben erhalten.
- Galaxy Gift kann nur während des Galaxy Events erscheinen; Chance: 0,001 %.
- Galaxy-Belohnungsauswahl berücksichtigt den globalen Football-Token-Besitzer.

### Events
- Bestehende Spezialevents bleiben vorhanden: Galaxy, Diamond, Hacker, Unicorn/Piñata, Robot, Zauberwürfel, Skibidi, Godzilla vs. Kong, Time Travel, School, Lava, Alien Invasion, LaserTag, Ocean, Zombie, Blitz, Spider-Man, Coca-Cola, Pflanzen und Elefanten.
- Ocean: drei pro Spieler und Event-Runde gespeicherte Truhen, Goldener-Hai-Ereignis, Pearl Radar.
- Zombie: fünf Serum-Fläschchen, ein sicheres Serum, Zombie Detector.
- 34 Standardevents besitzen jetzt eigene spielbare Mini-Challenges statt nur eines allgemeinen Quiz-Buttons: Reaktion, Gedächtnis, Reihenfolge, Schatzkarte, Elfmeter, Wissensfragen und Auswahl-Challenges.
- Godzilla-vs.-Kong-Abstimmung bleibt an den Videoclip und die vom Admin gespeicherte Gewinnerseite gebunden.
- Time Travel behält die vereinbarten Fußballstar-Clips und den Rückweg zum Event.
- Skibidi behält seine fünf Boss-Stufen.

### Admin Abuse und Power Hours
- Admin Abuse kann nur der Hauptadmin starten und stoppen.
- Zufällige Empfängerauswahl ist nur während Admin Abuse möglich; die Zufallsauswahl bestimmt den Empfänger, nicht Geschenk oder Token. Der Hauptadmin wählt die Belohnung.
- Legendary Comeback Gift kann nur während aktivem Admin Abuse an die aktuell online befindlichen Teilnehmer vergeben werden; jeder Teilnehmer erhält drei verdeckte Karten und wählt eine. Der Titel OG COMEBACK PLAYER und das kosmetische Cape bleiben erhalten.
- Power Hours: Sonntag–Freitag 15:00–17:00 Uhr, Samstag ganztägig. Normale Spieler erhalten mindestens 2× Glück; das globale Hauptadmin-Glück ist 1×–5×. Werte werden nicht miteinander multipliziert.

### Shop
- Dauerhafte Shop-Punkte und gespeicherter Kontostand.
- Admin kann Produkte hinzufügen, Preise und Beschreibungen ändern, aktivieren/deaktivieren und löschen.
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

## Noch nicht bestätigte Wahrscheinlichkeiten
- Die prozentuale Verteilung der seltenen Boxen, Diamond-Restchance, Event-Spawnraten und sämtliche nicht ausdrücklich bestätigten Token-Chancen müssen mit den Nutzerabsprachen abgeglichen werden. Vorhandene Zahlen im Code gelten nicht automatisch als freigegeben.

## Automatische Prüfungen
- JavaScript-Modul-Syntaxprüfung in GitHub Actions.
- Statische Invariantentests für Token-IDs, globalen Football-Token, Galaxy-Chance, Box-Anzahl, Öffnungsgrenze, gespeicherte Ocean-/Zombie-Lootdaten, 3D-LaserTag, Shop-Transaktionen und Mini-Game-Abdeckung.
- Letzte bestätigte CI-Prüfung: erfolgreich auf Commit `4d0d0550588cc43d7e952786f060ee5bbd743942`. Nachfolgende Dokumentationsänderungen sind separat eingecheckt.

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
