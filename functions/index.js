const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getAuth } = require("firebase-admin/auth");
const { defineSecret } = require("firebase-functions/params");
const crypto = require("node:crypto");

// Server-only role map stored in Google Secret Manager.
const roleCodeMapSecret = defineSecret("ROLE_CODE_MAP");

initializeApp({ databaseURL: "https://football-gift-challange-default-rtdb.europe-west1.firebasedatabase.app" });
const db = getDatabase();

const EVENT_TYPES = new Set([
  "galaxy", "diamond", "hacker", "unicorn", "robot", "cube", "skibidi",
  "godzilla", "time", "school", "lava", "alien", "blitz", "lasertag",
  "spiderman", "cocacola", "plants", "elephant", "ocean", "zombie",
  "multiverse", "football", "dinosaur", "candy", "castle", "space",
  "ghost", "winter", "egypt", "superhero", "racing", "dragon", "music",
  "mystery",
]);

function hashCode(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Bitte zuerst anmelden.");
  return request.auth;
}
function requireRole(request, roles) {
  const auth = requireAuth(request);
  const claims = auth.token || {};
  if (!roles.some((role) => claims[role] === true)) {
    throw new HttpsError("permission-denied", "Keine Berechtigung.");
  }
  return auth;
}

// Deliberately disabled until box openings and event claims are tracked
// authoritatively on the server. A callable that lets a client request a
// fresh random reward without a server-verified game action would be exploitable.
exports.rollAndAward = onCall({ region: "europe-west1" }, async () => {
  throw new HttpsError(
    "failed-precondition",
    "Belohnungen sind noch nicht freigeschaltet. Die serverseitige Rundenprüfung fehlt."
  );
});

exports.setActiveEvent = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin", "halfAdmin", "quarterAdmin"]);
  const type = request.data && request.data.type;
  const claims = auth.token || {};
  if (type !== null && !EVENT_TYPES.has(type)) {
    throw new HttpsError("invalid-argument", "Unbekanntes Event.");
  }
  if (type === null && claims.quarterAdmin && !claims.mainAdmin) {
    throw new HttpsError("permission-denied", "Viertel-Admins dürfen Events nicht beenden.");
  }
  if (claims.quarterAdmin && !claims.mainAdmin &&
      !["hacker", "unicorn", "galaxy", "diamond", "robot"].includes(type)) {
    throw new HttpsError("permission-denied", "Dieses Event ist für Viertel-Admins nicht freigegeben.");
  }
  if (claims.halfAdmin && !claims.mainAdmin &&
      !["cube", "hacker", "unicorn", "galaxy", "diamond", "robot", "school"].includes(type)) {
    throw new HttpsError("permission-denied", "Dieses Event ist für Halb-Admins nicht freigegeben.");
  }

  const currentEvent = await db.ref("events/active").get();
  if (type === null && currentEvent.val() === "skibidi") {
    await db.ref("settings/completedEvents/skibidi").set(true);
  }
  const now = Date.now();
  await db.ref("events").update({ active: type, startedAt: now, runId: String(now) });
  if (type === "skibidi") {
    await db.ref("settings/completedEvents/skibidi").set(true);
  }
  return { active: type, startedAt: now };
});


// Verify a role code against a Secret Manager-backed map and issue custom claims.
// Never fall back to client-writable Realtime Database paths for authorization.
exports.redeemRoleCode = onCall({ region: "europe-west1", secrets: [roleCodeMapSecret] }, async (request) => {
  const auth = requireAuth(request);
  const code = request.data && typeof request.data.code === "string" ? request.data.code.trim() : "";
  if (code.length < 4 || code.length > 128) {
    throw new HttpsError("invalid-argument", "Ungültiger Zugangscode.");
  }
  let roleMap;
  try {
    roleMap = JSON.parse(roleCodeMapSecret.value());
  } catch {
    throw new HttpsError("failed-precondition", "Die sichere Rollen-Konfiguration fehlt oder ist ungültig.");
  }
  if (!roleMap || typeof roleMap !== "object" || Array.isArray(roleMap)) {
    throw new HttpsError("failed-precondition", "Die sichere Rollen-Konfiguration ist ungültig.");
  }

  const digest = hashCode(code);
  const entry = roleMap[digest];
  const allowedRoles = new Set(["mainAdmin", "halfAdmin", "quarterAdmin", "special", "messageMan"]);
  if (!entry || !allowedRoles.has(entry.role)) {
    throw new HttpsError("permission-denied", "Dieser Code ist nicht vergeben oder stimmt nicht.");
  }
  if ((entry.role === "special" || entry.role === "messageMan") &&
      (typeof entry.uid !== "string" || entry.uid !== auth.uid)) {
    throw new HttpsError("permission-denied", "Dieser Code ist an ein anderes Konto gebunden.");
  }

  const role = entry.role;
  const roleName = role === "special" || role === "messageMan"
    ? String(entry.name || "").slice(0, 40)
    : "";
  const user = await getAuth().getUser(auth.uid);
  const claims = { ...(user.customClaims || {}) };
  for (const key of ["mainAdmin", "halfAdmin", "quarterAdmin", "special", "messageMan"]) delete claims[key];
  if (role !== "normal") claims[role] = true;
  if (roleName) claims.roleName = roleName;
  else delete claims.roleName;
  await getAuth().setCustomUserClaims(auth.uid, claims);
  return { role, roleName };
});

exports.setServerControl = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  const locked = request.data && request.data.locked;
  if (typeof locked !== "boolean") {
    throw new HttpsError("invalid-argument", "Serverstatus muss true oder false sein.");
  }
  const user = await getAuth().getUser(auth.uid);
  await db.ref("serverControl").set({
    locked,
    updatedAt: Date.now(),
    updatedBy: String((request.data && request.data.updatedBy) || "Hauptadmin").slice(0, 40),
    updatedByUid: auth.uid,
  });
  return { locked, updatedBy: user.uid };
});


// Main-admin manual token grants are performed by the trusted backend.
exports.grantAdminTokens = onCall({ region: "europe-west1" }, async (request) => {
  requireRole(request, ["mainAdmin"]);
  const data = request.data || {};
  const prizeId = typeof data.prizeId === "string" ? data.prizeId : "";
  const scope = data.scope;
  const amount = Number(data.amount);
  const targetName = typeof data.targetName === "string" ? data.targetName.trim().slice(0, 24) : "";
  const isPublic = data.public === true;
  const allowedIds = new Set(["deinewahl", "revenge", "comeback", "doublegoal", "selfretter", "freistoss", "football", "penalty", "goal", "redcard", "keeper", "switch", "diamondGift"]);

  if (!allowedIds.has(prizeId)) {
    throw new HttpsError("invalid-argument", "Dieses Geschenk ist nicht verfügbar.");
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 50) {
    throw new HttpsError("invalid-argument", "Die Menge muss zwischen 1 und 50 liegen.");
  }
  if (scope !== "single" && scope !== "global") {
    throw new HttpsError("invalid-argument", "Ungültiger Vergabebereich.");
  }
  if (prizeId === "football" && (scope !== "single" || amount !== 1)) {
    throw new HttpsError("failed-precondition", "Der Football Token kann nur einmal an einen einzelnen Spieler vergeben werden.");
  }

  const playersSnapshot = await db.ref("players").get();
  const players = playersSnapshot.val() || {};
  let targets;
  if (scope === "global") {
    targets = Object.keys(players);
    if (targets.length > 200) {
      throw new HttpsError("failed-precondition", "Zu viele Spieler für eine globale Aktion. Bitte in kleinere Gruppen aufteilen.");
    }
  } else {
    if (!targetName) throw new HttpsError("invalid-argument", "Bitte einen Spielernamen eingeben.");
    const normalized = targetName.toLowerCase();
    const found = Object.entries(players).find(([, player]) =>
      String(player && player.name || "").trim().toLowerCase() === normalized
    );
    if (!found) throw new HttpsError("not-found", "Spieler nicht gefunden.");
    targets = [found[0]];
  }

  let footballReserved = false;
  const targetUid = targets[0];
  if (prizeId === "football") {
    const ownerTx = await db.ref("settings/footballTokenOwner").transaction((current) => {
      if (current !== null && current !== undefined) return;
      return targetUid;
    });
    if (!ownerTx.committed) {
      throw new HttpsError("already-exists", "Der Football Token wurde bereits im gesamten Spiel vergeben.");
    }
    footballReserved = true;
  }

  let granted = 0;
  try {
    for (const uid of targets) {
      const playerRef = db.ref("players/" + uid);
      const tx = await playerRef.transaction((current) => {
        if (!current) return;
        const inventory = { ...(current.inventory || {}) };
        if (prizeId === "football" && Number(inventory.football || 0) > 0) return;
        inventory[prizeId] = (Number(inventory[prizeId]) || 0) + amount;
        const firstWon = { ...(current.firstWon || {}) };
        if (!firstWon[prizeId]) firstWon[prizeId] = Date.now();
        return {
          ...current,
          inventory,
          firstWon,
          totalWins: (Number(current.totalWins) || 0) + amount,
        };
      });
      if (tx.committed) granted += 1;
      else if (prizeId === "football") throw new Error("Der Spieler besitzt den Football Token bereits.");
    }
  } catch (error) {
    if (footballReserved) {
      await db.ref("settings/footballTokenOwner").transaction((current) => current === targetUid ? null : undefined);
    }
    throw new HttpsError("aborted", error.message || "Die Token-Vergabe ist fehlgeschlagen.");
  }

  if (isPublic) {
    await db.ref("activity").push({
      name: "OWNER",
      text: "Owner hat Tokens vergeben.",
      at: Date.now(),
    }).catch(() => {});
  }
  return { granted, prizeId, amount };
});


// Gift transfers are authorized and applied by the trusted backend.
exports.sendGift = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  const claims = auth.token || {};
  const isMainAdmin = claims.mainAdmin === true;
  const isSpecial = claims.special === true;
  if (!isMainAdmin && !isSpecial) {
    throw new HttpsError("permission-denied", "Nur der Hauptadmin oder besondere Spieler dürfen Geschenke senden.");
  }

  const data = request.data || {};
  const prizeId = typeof data.prizeId === "string" ? data.prizeId : "";
  const scope = data.scope;
  const amount = Number(data.amount);
  const targetName = typeof data.targetName === "string" ? data.targetName.trim().slice(0, 24) : "";
  const isPublic = data.public === true;
  const allowedIds = new Set(["deinewahl", "revenge", "comeback", "doublegoal", "selfretter", "freistoss", "football", "penalty", "goal", "redcard", "keeper", "switch", "diamondGift"]);

  if (!allowedIds.has(prizeId)) throw new HttpsError("invalid-argument", "Dieses Geschenk ist nicht verfügbar.");
  if (!Number.isInteger(amount) || amount < 1 || amount > 20) {
    throw new HttpsError("invalid-argument", "Die Menge muss zwischen 1 und 20 liegen.");
  }
  if (scope !== "single" && scope !== "global") {
    throw new HttpsError("invalid-argument", "Ungültiger Empfängerbereich.");
  }
  if (isSpecial && scope !== "single") {
    throw new HttpsError("permission-denied", "Besondere Spieler dürfen nur an einen einzelnen Spieler senden.");
  }
  if (prizeId === "football" && (scope !== "single" || amount !== 1)) {
    throw new HttpsError("failed-precondition", "Der Football Token kann nur einmal an einen einzelnen Spieler gesendet werden.");
  }

  const playersSnapshot = await db.ref("players").get();
  const players = playersSnapshot.val() || {};
  let targets;
  if (scope === "global") {
    targets = Object.keys(players).filter((id) => id !== auth.uid);
    if (targets.length > 200) {
      throw new HttpsError("failed-precondition", "Zu viele Spieler für eine globale Aktion.");
    }
  } else {
    if (!targetName) throw new HttpsError("invalid-argument", "Bitte einen Spielernamen eingeben.");
    const normalized = targetName.toLowerCase();
    const found = Object.entries(players).find(([, player]) =>
      String(player && player.name || "").trim().toLowerCase() === normalized
    );
    if (!found) throw new HttpsError("not-found", "Spieler nicht gefunden.");
    if (found[0] === auth.uid) throw new HttpsError("failed-precondition", "Du kannst dir selbst kein Geschenk senden.");
    targets = [found[0]];
  }
  if (targets.length === 0) throw new HttpsError("failed-precondition", "Es gibt keine gültigen Empfänger.");

  let footballReserved = false;
  const targetUid = targets[0];
  if (prizeId === "football") {
    const ownerTx = await db.ref("settings/footballTokenOwner").transaction((current) => {
      if (current !== null && current !== undefined) return;
      return targetUid;
    });
    if (!ownerTx.committed) {
      throw new HttpsError("already-exists", "Der Football Token wurde bereits im gesamten Spiel vergeben.");
    }
    footballReserved = true;
  }

  let senderDeducted = false;
  try {
    if (isSpecial) {
      const senderRef = db.ref("players/" + auth.uid);
      const senderTx = await senderRef.transaction((current) => {
        if (!current) return;
        const inventory = { ...(current.inventory || {}) };
        const owned = Number(inventory[prizeId] || 0);
        if (!Number.isFinite(owned) || owned < amount) return;
        inventory[prizeId] = owned - amount;
        return { ...current, inventory };
      });
      if (!senderTx.committed) {
        throw new HttpsError("failed-precondition", "Du besitzt nicht genug davon.");
      }
      senderDeducted = true;
    }

    let delivered = 0;
    for (const recipientUid of targets) {
      const recipientRef = db.ref("players/" + recipientUid);
      const tx = await recipientRef.transaction((current) => {
        if (!current) return;
        const inventory = { ...(current.inventory || {}) };
        if (prizeId === "football" && Number(inventory.football || 0) > 0) return;
        inventory[prizeId] = (Number(inventory[prizeId]) || 0) + amount;
        const firstWon = { ...(current.firstWon || {}) };
        if (!firstWon[prizeId]) firstWon[prizeId] = Date.now();
        return {
          ...current,
          inventory,
          firstWon,
          totalWins: (Number(current.totalWins) || 0) + amount,
        };
      });
      if (!tx.committed) {
        if (prizeId === "football") throw new Error("Der Empfänger besitzt den Football Token bereits.");
        continue;
      }
      delivered += 1;
    }
    if (delivered === 0) throw new Error("Das Geschenk konnte keinem Spieler zugestellt werden.");

    if (isPublic && isMainAdmin) {
      await db.ref("activity").push({
        name: "OWNER",
        text: "Owner hat Geschenke verteilt.",
        at: Date.now(),
      }).catch(() => {});
    }
    return { delivered, prizeId, amount };
  } catch (error) {
    if (senderDeducted) {
      await db.ref("players/" + auth.uid).transaction((current) => {
        if (!current) return;
        const inventory = { ...(current.inventory || {}) };
        inventory[prizeId] = (Number(inventory[prizeId]) || 0) + amount;
        return { ...current, inventory };
      }).catch(() => {});
    }
    if (footballReserved) {
      await db.ref("settings/footballTokenOwner").transaction((current) => current === targetUid ? null : undefined);
    }
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("aborted", error.message || "Das Geschenk konnte nicht gesendet werden.");
  }
});
