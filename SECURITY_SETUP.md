# Sicherheits- und Livebetrieb-Checkliste

Diese Datei dokumentiert die Schritte, die vor einer öffentlichen Freigabe noch in Firebase erledigt und getestet werden müssen. **Sie ändert keine Firebase-Einstellungen und macht die App allein nicht sicher.**

## Emergency security change (2026-11-27)

`firebase-config.js` has now been changed to a **fail-closed policy**: root `.read` and `.write` are both `false`, with no permissive child rules. This prevents anonymous/authenticated clients from reading or writing any Realtime Database path if these rules are deployed. It also means the current game cannot operate against the database while this emergency policy is active. This is intentional: it closes the client-side privilege-escalation path instead of pretending the old client-writable `adminProof` is secure.

**Important:** editing this repository file does not deploy Firebase rules. The policy must still be published in the Firebase Realtime Database Rules console by the project owner. No Firebase project deployment credentials are connected to this repository workflow, so deployment has not been performed from here.

To restore gameplay safely, migrate sensitive writes to trusted Cloud Functions/Admin SDK operations and server-verified Firebase Authentication custom claims. Only after that migration should narrowly scoped read/write rules be reintroduced and tested in the Firebase Emulator. Player-owned cosmetics/profile fields, chat, and presence can be allowed separately after auditing their exact paths; balances, inventory, tokens, global one-time rewards, event claims, shop purchases, LaserTag results, and admin actions must be validated server-side. Rules must be tested in the Firebase Emulator before deployment.


## 0. Findings from the current app review (2026-11-27)

The current browser app calls Firebase `signInAnonymously(auth)` from its player-entry flow and also automatically signs in anonymously when there is no current user. This confirms that the current app uses Firebase Anonymous Authentication. Anonymous Authentication provides a Firebase UID for a session, but it does not prove a real-world identity or establish who owns the main-admin role.

The current client code also reads `admin/codeHash`, compares a typed code in the browser, and writes `adminProof/<uid>` from the client. Because the database rules allow authenticated clients to write their own `adminProof/<uid>` and the admin hash can be read while the server is open, this proof is not a trusted admin credential. The current rules also allow broad writes to major data branches while the server is open. Do not rely on this mechanism to protect admin controls, balances, tokens, shop purchases, or event rewards.

The app currently defines a fixed client-side gift-box expiry of `2026-11-28T14:30:00+01:00`. Gift boxes become disabled after that timestamp. Confirm that this is an intentional end date before release; it is not a secure server-side expiry because it is enforced in browser code.

### Required migration before public release

- Keep Anonymous Authentication for quick guest entry only if desired; do not use it as proof of the main-admin identity.
- Identify the intended main-admin Firebase UID through a trusted setup process and grant a signed Firebase Custom Claim from a trusted Admin SDK environment.
- Move sensitive mutations (admin settings, role assignment, player balances, token inventory, one-time Football Token ownership, gift claims, shop purchases, event rewards, LaserTag results, and lockdown changes) behind trusted Cloud Functions or another server-side authority.
- Update Realtime Database Rules to permit only the minimum client-owned profile/chat/online operations, and require verified claims for privileged reads/writes. Do not publish permissive rules as a workaround.
- Add Firebase Emulator tests for unauthenticated, anonymous normal player, half-admin, quarter-admin, Message Man, and main-admin access before deploying rules.
- Test account recovery expectations: anonymous users can lose their guest identity if app data is cleared or the anonymous account is otherwise lost. Consider account linking if persistent identity is required.

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
- Fail-closed Realtime Database Rules im Repository: erstellt; Firebase Console Deployment noch erforderlich.
- Serverseitige Admin-Autorisierung und Reward-Validierung: noch erforderlich; bis dahin bleibt die Datenbank absichtlich gesperrt.

Die App sollte erst nach diesen Prüfungen aus dem Draft-Pull-Request in den Hauptbranch übernommen werden.
