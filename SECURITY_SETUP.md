# Sicherheits- und Livebetrieb-Checkliste

Diese Datei dokumentiert die Schritte, die vor einer öffentlichen Freigabe noch in Firebase erledigt und getestet werden müssen. **Sie ändert keine Firebase-Einstellungen und macht die App allein nicht sicher.**

## Important: current rules file is not safe to deploy as production rules

The checked-in `firebase-config.js` is a development draft, not a production security policy. In its current form, authenticated users can write broad data branches while the server is open. The client-writable `adminProof` plus readable code hash also means the code-hash proof is not a secure identity check. A malicious user could potentially impersonate an admin and alter player data, settings, events, or rewards.

**Do not deploy the current rules as a security fix.** The app must be migrated to server-verified Firebase Authentication custom claims and trusted Cloud Functions/Admin SDK operations for sensitive writes. Player-owned cosmetic/profile fields can then be allowed separately, while balances, inventory, tokens, global one-time rewards, event claims, shop purchases, and admin actions are validated on the server. Rules must be tested in the Firebase Emulator before deployment.

## 1. Hauptadmin sicher festlegen

Die aktuelle HTML-App enthält clientseitige Rollen-/Code-Logik. Alles, was im Browser ausgeliefert wird, kann von Nutzern eingesehen oder verändert werden. Ein geheimer Code oder Hash im JavaScript ist deshalb kein verlässlicher Berechtigungsnachweis.

Für den echten Hauptadmin ist erforderlich:

1. In Firebase Authentication den persönlichen Benutzer des Hauptadmins identifizieren.
2. Die Admin-Berechtigung ausschließlich serverseitig vergeben (Firebase Admin SDK / vertrauenswürdige Cloud Function), z. B. als Custom Claim `admin: true`.
3. Beim Login das ID-Token prüfen und die Rolle aus dem signierten Token ableiten.
4. Schreibzugriffe auf Admin-Funktionen zusätzlich in Realtime Database Rules oder Cloud Functions prüfen.
5. Halb-Admin, Viertel-Admin und Message Man erhalten getrennte, eng begrenzte Rechte. Sie dürfen niemals die Hauptadmin-Berechtigung setzen oder sich selbst vergeben.

Keine Passwörter oder Admin-Codes in dieses Repository eintragen.

## 2. Realtime Database absichern

Vor dem Erstellen der Regeln muss die komplette Datenstruktur geprüft werden. Die App verwendet unter anderem:

- `players/<uid>`
- `settings`
- `events`
- `messages`
- `messageReports`
- `announcements`
- `activity`

Die Regeln müssen pro Pfad festlegen, wer lesen und schreiben darf. Besonders wichtig:

- Ein Spieler darf nur seine eigenen privaten Spielerdaten ändern.
- Belohnungen, Guthaben, Token-Besitz, globale Einmal-Rewards und Admin-Einstellungen dürfen nicht beliebig vom Browser geschrieben werden.
- Admin-Aktionen müssen serverseitig autorisiert werden.
- Nachrichten müssen Länge, Absender-UID und Zeitstempel serverseitig validieren.
- LaserTag-Treffer, Leben, Rangliste und Diamond-Auszahlungen sind derzeit clientseitig beeinflussbar. Für fälschungssichere Ergebnisse muss der Spielzustand serverseitig validiert werden.
- Niemals pauschal `.read: true` und `.write: true` für die gesamte Datenbank setzen.

## 3. Multiplayer- und Belohnungstests

Vor Freigabe mit mindestens zwei getrennten Testkonten prüfen:

- Beitreten, Skin-Auswahl, Bewegung und Verlassen der LaserTag-Arena.
- Verbindungsabbruch und automatische Bereinigung des Spieler-Eintrags.
- Treffer, Leben, Ausscheiden und Zuschauer-Modus.
- Timer-Ende und Ende bei nur noch einem aktiven Spieler.
- Diamond-Auszahlung genau einmal pro Event-Runde.
- Chat senden, eigene Nachricht löschen und Nachricht melden.
- Shop-Punkte, Kauf, Verbrauch und zeitlich begrenzte Angebote.
- Sperren und Freigeben des Servers; bestehende Spielstände müssen erhalten bleiben.
- Rollenmatrix: Hauptadmin, Halb-Admin, Viertel-Admin, Message Man und normaler Spieler.

## 4. Freigabestatus

- JavaScript-Syntaxprüfung über GitHub Actions: vorhanden.
- Browser-Test auf Desktop und Android: noch erforderlich.
- Zwei-Konten-Multiplayer-Test: noch erforderlich.
- Firebase Rules Review und Deployment: noch erforderlich.
- Serverseitige Admin-Autorisierung und Reward-Validierung: noch erforderlich.

Die App sollte erst nach diesen Prüfungen aus dem Draft-Pull-Request in den Hauptbranch übernommen werden.
