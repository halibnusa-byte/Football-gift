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
const GAME_EXPIRY_MS = Date.parse("2026-11-28T14:30:00+01:00");

const EVENT_TYPES = new Set([
  "galaxy", "diamond", "hacker", "unicorn", "robot", "cube", "skibidi",
  "godzilla", "time", "school", "lava", "alien", "blitz", "lasertag",
  "spiderman", "cocacola", "plants", "elephant", "ocean", "zombie",
  "multiverse", "football", "dinosaur", "candy", "castle", "space",
  "ghost", "winter", "egypt", "superhero", "racing", "dragon", "music",
  "mystery",
  "pirate", "carnival", "ninja", "toy", "crystal", "wildwest", "bakery", "comic", "safari", "cyber", "wizard", "moon", "arcade", "samurai", "stoneage", "masquerade", "science", "luxury", "rainbow", "timemachine", "madness", "secretgarden", "elephantparade",
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

async function assertMainAdminDuringLock(auth) {
  const locked = (await db.ref("serverControl/locked").get()).val() === true;
  if (locked && auth.token?.mainAdmin !== true) {
    throw new HttpsError("failed-precondition", "Während der Update-Sperre hat nur der Hauptadmin Zugriff.");
  }
}



// Server-authoritative gift rounds: 15 boxes, at most 3 opens, server RNG and atomic inventory update.
const ROUND_PRIZES = [
  { id: "deinewahl", chance: 0.0001 },
  { id: "revenge", chance: 0.00025 },
  { id: "comeback", chance: 0.0005 },
  { id: "doublegoal", chance: 0.0005 },
  { id: "selfretter", chance: 0.001 },
  { id: "freistoss", chance: 0.0015 },
  { id: "football", chance: 0.002 },
  { id: "penalty", chance: 0.003 },
  { id: "goal", chance: 0.01 },
  { id: "redcard", chance: 0.015 },
  { id: "keeper", chance: 0.02 },
  { id: "switch", chance: 0.025 },
];
const ROUND_RARITIES = [
  { id: "bronze", mult: 2, weight: 70 },
  { id: "silver", mult: 3, weight: 20 },
  { id: "gold", mult: 4, weight: 8 },
  { id: "diamond", mult: 5, weight: 2 },
];
function secureUnit() { return crypto.randomInt(0, 1_000_000_000) / 1_000_000_000; }
function securePick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = secureUnit() * total;
  for (let i = 0; i < items.length; i++) { roll -= weights[i]; if (roll < 0) return items[i]; }
  return items[items.length - 1];
}
function currentLuck(auth, player, settings) {
  const claims = auth.token || {};
  const now = new Date();
  const berlin = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const parts = Object.fromEntries(berlin.map((p) => [p.type, p.value]));
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const power = parts.weekday === "Sat" || (minute >= 900 && minute < 1020) ? 2 : 1;
  return Math.max(settings.luckEnabled ? Number(settings.luckMultiplier || 1) : 1,
    claims.special ? 2 : 1, power,
    claims.halfAdmin && !claims.mainAdmin ? Math.min(50, Number(settings.roleLuck?.[auth.uid] || 1)) : 1);
}
function pickRoundPrize(multiplier, eventType, settings, player) {
  if (eventType === "galaxy" && secureUnit() < 0.00001) {
    const choices = ["comeback", "revenge"];
    if (!settings.footballTokenOwner) choices.push("football");
    return { id: choices[crypto.randomInt(choices.length)], special: "galaxy" };
  }
  if (eventType === "elephant" && secureUnit() < Number(settings.elephantChestChance ?? 0.00001)) {
    return { id: secureUnit() < 0.5 ? "revenge" : "switch" };
  }
  if (eventType === "diamond" && secureUnit() < Number(settings.diamondChance ?? 0.1) / 100) {
    return { id: "diamondGift" };
  }
  let extra = 1;
  if (eventType === "blitz" && secureUnit() < Number(settings.blitzChance ?? 0.015)) extra = 10;
  if (eventType === "spiderman" && secureUnit() < Number(settings.spiderChance ?? 0.01)) extra = Number(settings.spiderLuck || 5);
  if (eventType === "cocacola" && secureUnit() < Number(settings.colaChance ?? 0.01)) extra = Number(settings.colaLuck || 5);
  if (eventType === "plants" && secureUnit() < Number(settings.vineChance ?? 0.01)) extra = Number(settings.plantLuck || 5);
  const unlocked = settings.completedEvents?.skibidi === true;
  const list = ROUND_PRIZES.filter((p) =>
    (unlocked || !["deinewahl", "doublegoal", "selfretter", "freistoss", "comeback"].includes(p.id)) &&
    !(p.id === "penalty" && Number(player.inventory?.penalty || 0) > 0) &&
    !(p.id === "football" && settings.footballTokenOwner)
  );
  const weights = list.map((p) => p.chance * multiplier * extra);
  const sum = weights.reduce((a, b) => a + b, 0);
  const capped = sum > 100 ? weights.map((w) => w * 100 / sum) : weights;
  const roll = secureUnit() * 100;
  let cursor = roll;
  for (let i = 0; i < list.length; i++) { cursor -= capped[i]; if (cursor < 0) return { id: list[i].id }; }
  return null;
}
exports.startPlayerRound = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  if (Date.now() > GAME_EXPIRY_MS) throw new HttpsError("failed-precondition", "Das Spiel ist seit dem 28.11.2026 um 14:30 Uhr beendet.");
  const activeEvent = (await db.ref("events/active").get()).val();
  const playerRef = db.ref("players/" + auth.uid);
  const tx = await playerRef.transaction((current) => {
    if (!current) return;
    const existing = current.roundState;
    if (existing && Array.isArray(existing.boxes) && existing.boxes.length === 15 && Number(existing.openedCount || 0) < 3) return current;
    const boxes = Array.from({ length: 15 }, (_, id) => ({ id, opened: false, rare: false, galaxy: false, blitz: false }));
    let rareType = null;
    if (secureUnit() < 0.01) {
      rareType = securePick(ROUND_RARITIES, ROUND_RARITIES.map((r) => r.weight));
      boxes[crypto.randomInt(15)].rare = true;
    }
    let pendingBlitz = Math.max(0, Number(current.pendingBlitz) || 0);
    if (pendingBlitz > 0) { boxes[crypto.randomInt(15)].blitz = true; pendingBlitz--; }
    let pendingGalaxy = Math.max(0, Number(current.pendingGalaxy) || 0);
    if (activeEvent === "galaxy" && pendingGalaxy > 0) {
      const candidates = boxes.map((b, i) => b.rare ? -1 : i).filter((i) => i >= 0);
      if (candidates.length) { boxes[candidates[crypto.randomInt(candidates.length)]].galaxy = true; pendingGalaxy--; }
    }
    const roundId = crypto.randomUUID();
    const roundState = { roundId, boxes, openedCount: 0, rareType: rareType?.id || null, createdAt: Date.now() };
    return { ...current, pendingBlitz, pendingGalaxy, roundState,
      lastBoxes: boxes.map((b) => ({ ...b })), lastRareType: roundState.rareType, opensThisRound: 0, roundUpdated: Date.now() };
  });
  if (!tx.committed) throw new HttpsError("failed-precondition", "Deine Runde konnte nicht erstellt werden.");
  return { round: tx.snapshot.val().roundState };
});
exports.openPlayerGift = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  if (Date.now() > GAME_EXPIRY_MS) throw new HttpsError("failed-precondition", "Das Spiel ist seit dem 28.11.2026 um 14:30 Uhr beendet.");
  const index = Number(request.data?.index);
  const roundId = String(request.data?.roundId || "");
  if (!Number.isInteger(index) || index < 0 || index >= 15 || !roundId) throw new HttpsError("invalid-argument", "Ungültige Geschenkbox.");
  const settings = (await db.ref("settings").get()).val() || {};
  const events = (await db.ref("events").get()).val() || {};
  const playerRef = db.ref("players/" + auth.uid);
  const snapshot = await playerRef.get();
  const current = snapshot.val();
  if (!current) throw new HttpsError("not-found", "Spielerprofil nicht gefunden.");
  const round = current.roundState;
  if (!round || round.roundId !== roundId || !Array.isArray(round.boxes) || round.boxes.length !== 15) throw new HttpsError("failed-precondition", "Diese Runde ist nicht mehr aktuell.");
  if (round.openedCount >= 3) throw new HttpsError("failed-precondition", "Du hast bereits 3 Geschenke geöffnet.");
  if (round.boxes[index]?.opened) throw new HttpsError("already-exists", "Diese Geschenkbox wurde bereits geöffnet.");
  const box = round.boxes[index];
  const rarity = ROUND_RARITIES.find((r) => r.id === round.rareType);
  const mult = (box.rare && rarity ? rarity.mult : 1) * (box.blitz ? 10 : 1);
  const reward = box.galaxy
    ? { id: (["comeback", "revenge", ...(!settings.footballTokenOwner ? ["football"] : [])])[crypto.randomInt(settings.footballTokenOwner ? 2 : 3)], special: "galaxy" }
    : pickRoundPrize(currentLuck(auth, current, settings) * mult, events.active, settings, current);
  let reservedFootball = false;
  if (reward?.id === "football") {
    const owner = await db.ref("settings/footballTokenOwner").transaction((v) => v == null ? auth.uid : undefined);
    if (!owner.committed) throw new HttpsError("already-exists", "Der Football Token wurde bereits vergeben.");
    reservedFootball = true;
  }
  try {
    const tx = await playerRef.transaction((latest) => {
      if (!latest || latest.roundState?.roundId !== roundId || latest.roundState.openedCount >= 3 || latest.roundState.boxes?.[index]?.opened) return;
      const boxes = latest.roundState.boxes.map((b, i) => i === index ? { ...b, opened: true } : b);
      const inventory = { ...(latest.inventory || {}) };
      const firstWon = { ...(latest.firstWon || {}) };
      if (reward) {
        if (reward.id === "football" && Number(inventory.football || 0) > 0) return;
        inventory[reward.id] = (Number(inventory[reward.id]) || 0) + 1;
        if (!firstWon[reward.id]) firstWon[reward.id] = Date.now();
      }
      const updatedRound = { ...latest.roundState, boxes, openedCount: latest.roundState.openedCount + 1 };
      return { ...latest, inventory, firstWon, totalWins: (Number(latest.totalWins) || 0) + (reward ? 1 : 0),
        roundState: updatedRound, lastBoxes: boxes, opensThisRound: updatedRound.openedCount, shopPoints: Math.max(0, Number(latest.shopPoints) || 0) + 1, roundUpdated: Date.now() };
    });
    if (!tx.committed) throw new HttpsError("aborted", "Die Geschenkbox konnte nicht sicher geöffnet werden. Bitte aktualisieren.");
    return { reward: reward?.id || null, openedCount: tx.snapshot.val().roundState.openedCount,
      round: tx.snapshot.val().roundState, blitz: !!box.blitz, galaxy: !!box.galaxy };
  } catch (error) {
    if (reservedFootball) await db.ref("settings/footballTokenOwner").transaction((v) => v === auth.uid ? null : undefined);
    throw error;
  }
});

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
  await assertMainAdminDuringLock(auth);
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
  let roleMap = {};
  const storedCodes = (await db.ref("admin/roleCodes").get()).val() || {};
  const storedEntry = storedCodes[digest];
  if (storedEntry) roleMap[digest] = storedEntry;
  if (!storedEntry) {
    try { roleMap = JSON.parse(roleCodeMapSecret.value()); }
    catch { roleMap = {}; }
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

  if (entry.role === "mainAdmin" && entry.uid !== auth.uid) {
    throw new HttpsError("permission-denied", "Dieser Hauptadmin-Code ist an ein anderes Konto gebunden.");
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
  if (scope !== "single" && scope !== "global" && scope !== "random") {
    throw new HttpsError("invalid-argument", "Ungültiger Vergabebereich.");
  }
  if (prizeId === "football" && ((scope === "global") || amount !== 1)) {
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
  } else if (scope === "random") {
    const candidates = Object.keys(players);
    if (!candidates.length) throw new HttpsError("failed-precondition", "Es gibt keine Spieler.");
    targets = [candidates[crypto.randomInt(candidates.length)]];
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
  await assertMainAdminDuringLock(auth);
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
    targets = Object.keys(players);
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


// Queue Galaxy gifts without trusting client-side inventory writes.
exports.spawnGalaxyGifts = onCall({ region: "europe-west1" }, async (request) => {
  requireRole(request, ["mainAdmin"]);
  const data = request.data || {};
  const activeEvent = (await db.ref("events/active").get()).val();
  if (activeEvent !== "galaxy") throw new HttpsError("failed-precondition", "Galaxy-Geschenke können nur während des Galaxy-Events gespawnt werden.");
  const scope = data.scope;
  const amount = Number(data.amount);
  const targetName = typeof data.targetName === "string" ? data.targetName.trim().slice(0, 24) : "";
  if (scope !== "single" && scope !== "global") {
    throw new HttpsError("invalid-argument", "Ungültiger Empfängerbereich.");
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    throw new HttpsError("invalid-argument", "Die Menge muss zwischen 1 und 100 liegen.");
  }
  const players = (await db.ref("players").get()).val() || {};
  let targets;
  if (scope === "global") {
    targets = Object.keys(players);
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
    targets = [found[0]];
  }
  let queued = 0;
  for (const targetUid of targets) {
    const tx = await db.ref("players/" + targetUid).transaction((current) => {
      if (!current) return;
      return { ...current, pendingGalaxy: (Number(current.pendingGalaxy) || 0) + amount };
    });
    if (tx.committed) queued += 1;
  }
  if (queued === 0) throw new HttpsError("failed-precondition", "Es konnten keine Galaxy-Geschenke vorgemerkt werden.");
  if (data.public === true) {
    await db.ref("activity").push({ name: "OWNER", text: "Owner hat Galaxy-Truhen gespawnt.", at: Date.now() }).catch(() => {});
  }
  return { queued, amount };
});

// Player resets are restricted to the verified main-admin claim.
exports.resetPlayerData = onCall({ region: "europe-west1" }, async (request) => {
  requireRole(request, ["mainAdmin"]);
  const data = request.data || {};
  const scope = data.scope;
  const targetName = typeof data.targetName === "string" ? data.targetName.trim().slice(0, 24) : "";
  if (data.confirm !== true) throw new HttpsError("failed-precondition", "Zurücksetzen wurde nicht bestätigt.");
  if (scope !== "single" && scope !== "global") {
    throw new HttpsError("invalid-argument", "Ungültiger Zurücksetzungsbereich.");
  }
  const players = (await db.ref("players").get()).val() || {};
  let targets;
  if (scope === "global") {
    targets = Object.keys(players);
    if (targets.length > 500) {
      throw new HttpsError("failed-precondition", "Zu viele Spieler für einen globalen Reset.");
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
  let reset = 0;
  for (const targetUid of targets) {
    const tx = await db.ref("players/" + targetUid).transaction((current) => {
      if (!current) return;
      return {
        ...current,
        inventory: {},
        firstWon: {},
        totalWins: 0,
        lastBoxes: [],
        opensThisRound: 0,
        pendingGalaxy: 0,
        eventClaims: {},
      };
    });
    if (tx.committed) reset += 1;
  }
  if (scope === "global") {
    await db.ref("settings").update({ footballTokenOwner: null, completedEvents: {} });
  } else if (targets[0] && (await db.ref("settings/footballTokenOwner").get()).val() === targets[0]) {
    await db.ref("settings/footballTokenOwner").remove();
  }
  return { reset, scope };
});


// Announcement delivery is performed by the trusted backend.
exports.sendAnnouncement = onCall({ region: "europe-west1" }, async (request) => {
  await assertMainAdminDuringLock(auth);
  const auth = requireRole(request, ["mainAdmin", "halfAdmin", "quarterAdmin"]);
  const data = request.data || {};
  const message = typeof data.text === "string" ? data.text.trim() : "";
  const scope = data.scope;
  const targetName = typeof data.targetName === "string" ? data.targetName.trim().slice(0, 24) : "";
  const isPublic = data.public === true;
  if (!message || message.length > 240) {
    throw new HttpsError("invalid-argument", "Die Nachricht muss 1 bis 240 Zeichen lang sein.");
  }
  if (scope !== "single" && scope !== "global") {
    throw new HttpsError("invalid-argument", "Ungültiger Empfängerbereich.");
  }
  const players = (await db.ref("players").get()).val() || {};
  let targets;
  if (scope === "global") {
    targets = Object.keys(players);
    if (targets.length > 200) {
      throw new HttpsError("failed-precondition", "Zu viele Spieler für eine globale Ankündigung.");
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
  if (targets.length === 0) throw new HttpsError("failed-precondition", "Es gibt keine Empfänger.");
  const roleName = auth.token && auth.token.roleName;
  const sender = auth.token && auth.token.mainAdmin === true ? "OWNER" :
    String(roleName || (auth.token && auth.token.halfAdmin ? "HALB-ADMIN" : "VIERTEL-ADMIN")).slice(0, 40);
  const announcement = { text: message, at: Date.now(), sender };
  if (scope === "global") {
    await db.ref("announcements/global").set(announcement);
  } else {
    const targetUid = targets[0];
    await db.ref("announcements/users/" + targetUid).set({ ...announcement, targetUid });
  }
  if (isPublic) {
    await db.ref("activity").push({
      name: sender,
      text: sender + " hat eine Ankündigung gesendet.",
      at: Date.now(),
    });
  }
  return { delivered: targets.length, scope };
});


// Live chat writes are server-authoritative. The database client is read-only
// for messages once the matching rules are deployed.
async function assertGameUnlocked() {
  const snapshot = await db.ref("serverControl/locked").get();
  if (snapshot.val() === true) {
    throw new HttpsError("failed-precondition", "Das Spiel ist gerade gesperrt.");
  }
}

function validMessageId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

exports.sendChatMessage = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const text = typeof request.data?.text === "string" ? request.data.text.trim() : "";
  if (!text || text.length > 240) {
    throw new HttpsError("invalid-argument", "Eine Nachricht darf 1 bis 240 Zeichen lang sein.");
  }
  const playerSnapshot = await db.ref("players/" + auth.uid).get();
  if (!playerSnapshot.exists()) {
    throw new HttpsError("failed-precondition", "Dein Spielerprofil wurde nicht gefunden.");
  }
  const player = playerSnapshot.val() || {};
  const name = String(player.name || "Spieler").trim().slice(0, 24) || "Spieler";
  const rateRef = db.ref("chatRateLimit/" + auth.uid);
  const now = Date.now();
  const rate = await rateRef.transaction((lastAt) => {
    if (Number(lastAt) && now - Number(lastAt) < 1500) return;
    return now;
  });
  if (!rate.committed) {
    throw new HttpsError("resource-exhausted", "Bitte warte kurz vor deiner nächsten Nachricht.");
  }
  const messageRef = db.ref("messages").push();
  await messageRef.set({
    uid: auth.uid,
    name,
    text,
    at: now,
  });
  return { messageId: messageRef.key };
});

exports.deleteChatMessage = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const messageId = request.data?.messageId;
  if (!validMessageId(messageId)) {
    throw new HttpsError("invalid-argument", "Ungültige Nachricht.");
  }
  const ref = db.ref("messages/" + messageId);
  const snapshot = await ref.get();
  if (!snapshot.exists()) throw new HttpsError("not-found", "Nachricht nicht gefunden.");
  const message = snapshot.val() || {};
  if (message.uid !== auth.uid && auth.token?.mainAdmin !== true) {
    throw new HttpsError("permission-denied", "Du kannst nur deine eigenen Nachrichten löschen.");
  }
  await ref.remove();
  return { deleted: true };
});

exports.reportChatMessage = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const messageId = request.data?.messageId;
  const reason = typeof request.data?.reason === "string" ? request.data.reason.trim().slice(0, 120) : "";
  if (!validMessageId(messageId)) {
    throw new HttpsError("invalid-argument", "Ungültige Nachricht.");
  }
  const snapshot = await db.ref("messages/" + messageId).get();
  if (!snapshot.exists()) throw new HttpsError("not-found", "Nachricht nicht gefunden.");
  if ((snapshot.val() || {}).uid === auth.uid) {
    throw new HttpsError("failed-precondition", "Du kannst deine eigene Nachricht nicht melden.");
  }
  const reportRef = db.ref("messageReports/" + messageId + "/" + auth.uid);
  const tx = await reportRef.transaction((current) => current || {
    uid: auth.uid,
    reason,
    at: Date.now(),
  });
  if (!tx.committed) {
    throw new HttpsError("already-exists", "Du hast diese Nachricht bereits gemeldet.");
  }
  return { reported: true };
});

exports.moderateChatMessage = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  await assertMainAdminDuringLock(auth);
  const messageId = request.data?.messageId;
  const action = request.data?.action;
  if (!validMessageId(messageId) || !["hide", "restore", "delete"].includes(action)) {
    throw new HttpsError("invalid-argument", "Ungültige Moderationsaktion.");
  }
  const ref = db.ref("messages/" + messageId);
  const snapshot = await ref.get();
  if (!snapshot.exists()) throw new HttpsError("not-found", "Nachricht nicht gefunden.");
  if (action === "delete") {
    await ref.remove();
  } else {
    await ref.update({
      hidden: action === "hide",
      moderatedAt: Date.now(),
      moderatedBy: auth.uid,
    });
  }
  return { action };
});


// Admin-controlled game settings are validated and written only by the backend.
exports.saveGameSettings = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  const claims = auth.token || {};
  const data = request.data || {};
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(data, "roleLuck")) {
    if (claims.halfAdmin !== true || claims.mainAdmin === true) {
      throw new HttpsError("permission-denied", "Diese Einstellung ist nur für Halb-Admins verfügbar.");
    }
    const value = Number(data.roleLuck);
    if (!Number.isFinite(value) || value < 1 || value > 50) {
      throw new HttpsError("invalid-argument", "Der persönliche Multiplikator muss zwischen 1× und 50× liegen.");
    }
    const locked = (await db.ref("serverControl/locked").get()).val() === true;
    if (locked) throw new HttpsError("failed-precondition", "Während der Sperre darf nur der Hauptadmin Einstellungen ändern.");
    await db.ref("settings/roleLuck/" + auth.uid).set(value);
    return { saved: true, roleLuck: value };
  }
  requireRole(request, ["mainAdmin"]);
  const locked = (await db.ref("serverControl/locked").get()).val() === true;
  if (locked !== true && data.luckMultiplier !== undefined) {
    const value = Number(data.luckMultiplier);
    if (!Number.isFinite(value) || value < 1 || value > 1000000 || typeof data.luckEnabled !== "boolean") {
      throw new HttpsError("invalid-argument", "Ungültige Glücks-Einstellungen.");
    }
    patch.luckMultiplier = value;
    patch.luckEnabled = data.luckEnabled;
  } else if (data.luckMultiplier !== undefined) {
    throw new HttpsError("failed-precondition", "Die Server-Sperre verhindert diese Änderung.");
  }
  const decimalOdds = ["blitzChance", "spiderChance", "colaChance", "vineChance", "elephantChestChance"];
  for (const key of decimalOdds) {
    if (data[key] === undefined) continue;
    const value = Number(data[key]);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new HttpsError("invalid-argument", "Ungültige Event-Chance: " + key);
    }
    patch[key] = value;
  }
  for (const key of ["spiderLuck", "colaLuck", "plantLuck"]) {
    if (data[key] === undefined) continue;
    const value = Number(data[key]);
    if (!Number.isFinite(value) || value < 1 || value > 1000000) {
      throw new HttpsError("invalid-argument", "Ungültiger Multiplikator: " + key);
    }
    patch[key] = value;
  }
  if (data.diamondChance !== undefined) {
    const value = Number(data.diamondChance);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new HttpsError("invalid-argument", "Die Diamond-Chance muss zwischen 0 und 100 liegen.");
    }
    patch.diamondChance = value;
  }
  if (Object.keys(patch).length === 0) {
    throw new HttpsError("invalid-argument", "Keine gültigen Einstellungen übergeben.");
  }
  await db.ref("settings").update(patch);
  return { saved: true, fields: Object.keys(patch) };
});


// Player profile creation/update and initial presence are performed by the backend.
exports.joinGame = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const name = typeof request.data?.name === "string" ? request.data.name.trim().slice(0, 24) : "";
  if (name.length < 2 || [".", "#", "$", "/", "[", "]"].some((char) => name.includes(char))) {
    throw new HttpsError("invalid-argument", "Der Spielername muss 2 bis 24 Zeichen lang sein und darf keine Firebase-Sonderzeichen enthalten.");
  }
  const playerRef = db.ref("players/" + auth.uid);
  const tx = await playerRef.transaction((current) => ({
    ...(current || {}),
    name,
    inventory: current?.inventory || {},
    firstWon: current?.firstWon || {},
    totalWins: Number(current?.totalWins) || 0,
    created: Number(current?.created) || Date.now(),
  }));
  if (!tx.committed) throw new HttpsError("aborted", "Dein Spielerprofil konnte nicht gespeichert werden.");
  await db.ref("online/" + auth.uid).set({ name, at: Date.now() });
  const comeback = (await db.ref("events/comebackAdminAbuse").get()).val() || {};
  if (comeback.active === true) await db.ref("events/comebackAdminAbuse/participants/" + auth.uid).set({ joinedAt: Date.now() });
  return { player: tx.snapshot.val() };
});


// Persistent admin-configured shop. Prices are intentionally unset until the main admin configures them.
const SHOP_PRODUCTS = ["hackerScanner", "robotScanner", "magicRemix", "goldenReportCard", "lavaShield", "alienRadar", "pearlRadar"];
exports.saveShopConfig = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  await assertMainAdminDuringLock(auth);
  const products = request.data?.products;
  if (!products || typeof products !== "object" || Array.isArray(products)) {
    throw new HttpsError("invalid-argument", "Ungültige Shop-Konfiguration.");
  }
  const clean = {};
  for (const id of SHOP_PRODUCTS) {
    const item = products[id];
    if (!item) continue;
    const price = Number(item.price);
    if (!Number.isSafeInteger(price) || price < 1 || price > 1000000) {
      throw new HttpsError("invalid-argument", "Jeder Shop-Preis muss eine ganze Zahl zwischen 1 und 1.000.000 sein.");
    }
    clean[id] = { price, enabled: item.enabled !== false };
  }
  await db.ref("shop/products").set(clean);
  await db.ref("shop/audit").push({ action: "config", by: auth.uid, at: Date.now(), productIds: Object.keys(clean) });
  return { saved: Object.keys(clean).length };
});
exports.redeemShopItem = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const id = String(request.data?.productId || "");
  if (!SHOP_PRODUCTS.includes(id)) throw new HttpsError("invalid-argument", "Unbekanntes Shop-Produkt.");
  const product = (await db.ref("shop/products/" + id).get()).val();
  if (!product || product.enabled !== true || !Number.isSafeInteger(Number(product.price)) || Number(product.price) < 1) {
    throw new HttpsError("failed-precondition", "Dieses Produkt ist aktuell nicht im Shop verfügbar.");
  }
  const playerRef = db.ref("players/" + auth.uid);
  const tx = await playerRef.transaction((player) => {
    if (!player) return;
    const points = Math.max(0, Number(player.shopPoints) || 0);
    if (points < product.price) return;
    const inventory = { ...(player.shopInventory || {}) };
    inventory[id] = (Number(inventory[id]) || 0) + 1;
    return { ...player, shopPoints: points - product.price, shopInventory: inventory };
  });
  if (!tx.committed) throw new HttpsError("failed-precondition", "Nicht genug Punkte oder Spielerprofil fehlt.");
  await db.ref("shop/purchases").push({ uid: auth.uid, productId: id, price: product.price, at: Date.now() });
  return { productId: id, price: product.price, balance: tx.snapshot.val().shopPoints, quantity: tx.snapshot.val().shopInventory[id] };
});


// Role codes are hashed and stored server-side; clients never write role-control paths.
exports.saveRoleCodes = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  await assertMainAdminDuringLock(auth);
  const kind = request.data?.kind;
  const entries = request.data?.entries;
  const role = kind === "half" ? "halfAdmin" : kind === "quarter" ? "quarterAdmin" : null;
  if (!role || !Array.isArray(entries) || entries.length < 1 || entries.length > (kind === "half" ? 2 : 1)) {
    throw new HttpsError("invalid-argument", "Ungültige Rollen-Codes.");
  }
  const next = {};
  for (const item of entries) {
    const code = String(item?.code || "").trim();
    if (code.length < 4 || code.length > 128) throw new HttpsError("invalid-argument", "Codes müssen 4 bis 128 Zeichen lang sein.");
    const digest = hashCode(code);
    if (next[digest]) throw new HttpsError("invalid-argument", "Jeder Code muss einzigartig sein.");
    next[digest] = { role, createdBy: auth.uid, createdAt: Date.now() };
  }
  const existing = (await db.ref("admin/roleCodes").get()).val() || {};
  for (const digest of Object.keys(next)) if (existing[digest]) throw new HttpsError("already-exists", "Dieser Code wird bereits verwendet.");
  const old = Object.fromEntries(Object.entries(existing).filter(([,v]) => v.role !== role));
  await db.ref("admin/roleCodes").set({ ...old, ...next });
  return { saved: Object.keys(next).length };
});
exports.saveNamedRoleCodes = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  await assertMainAdminDuringLock(auth);
  const kind = request.data?.kind;
  const entries = request.data?.entries;
  const role = kind === "special" ? "special" : kind === "messageMan" ? "messageMan" : null;
  const max = kind === "messageMan" ? 2 : 1;
  if (!role || !Array.isArray(entries) || entries.length > max) throw new HttpsError("invalid-argument", "Ungültige Rollen-Zuweisung.");
  const players = (await db.ref("players").get()).val() || {};
  const codes = {};
  const usedUids = new Set();
  for (const item of entries) {
    const name = String(item?.name || "").trim().slice(0, 40);
    const code = String(item?.code || "").trim();
    if (!name || code.length < 4 || code.length > 128) throw new HttpsError("invalid-argument", "Name und Code (mindestens 4 Zeichen) sind erforderlich.");
    const found = Object.entries(players).find(([,p]) => String(p?.name || "").trim().toLowerCase() === name.toLowerCase());
    if (!found) throw new HttpsError("not-found", "Spieler nicht gefunden: " + name);
    if (usedUids.has(found[0])) throw new HttpsError("invalid-argument", "Ein Spieler kann nicht doppelt eingetragen werden.");
    usedUids.add(found[0]);
    const digest = hashCode(code);
    if (codes[digest]) throw new HttpsError("invalid-argument", "Codes müssen einzigartig sein.");
    codes[digest] = { role, uid: found[0], name, createdBy: auth.uid, createdAt: Date.now() };
  }
  const existing = (await db.ref("admin/roleCodes").get()).val() || {};
  const retained = Object.fromEntries(Object.entries(existing).filter(([,v]) => v.role !== role));
  for (const digest of Object.keys(codes)) if (existing[digest] && existing[digest].role !== role) throw new HttpsError("already-exists", "Dieser Code wird bereits für eine andere Rolle verwendet.");
  await db.ref("admin/roleCodes").set({ ...retained, ...codes });
  return { saved: Object.keys(codes).length };
});
exports.saveGodzillaSettings = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  await assertMainAdminDuringLock(auth);
  const data = request.data || {};
  const url = String(data.url || "").trim();
  const id = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
  const pause = Number(data.pause), end = Number(data.end), winner = data.winner;
  if (!id || !Number.isInteger(pause) || pause < 5 || pause > 600 || !Number.isInteger(end) || end <= pause || end > 1200 || !["godzilla","kong"].includes(winner)) {
    throw new HttpsError("invalid-argument", "Ungültige Godzilla-Videoeinstellungen.");
  }
  await db.ref("settings/godzillaVideo").set({ url, pause, end, winner });
  return { saved: true };
});
exports.recordEventClaim = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const eventId = String(request.data?.eventId || "");
  if (!EVENT_TYPES.has(eventId)) throw new HttpsError("invalid-argument", "Unbekanntes Event.");
  const events = (await db.ref("events").get()).val() || {};
  if (events.active !== eventId) throw new HttpsError("failed-precondition", "Dieses Event ist nicht aktiv.");
  const runId = String(events.runId || events.startedAt || "");
  if (!runId) throw new HttpsError("failed-precondition", "Event-Runde fehlt.");
  const ref = db.ref("players/" + auth.uid);
  const tx = await ref.transaction((p) => {
    if (!p) return;
    const claims = { ...(p.eventClaims || {}) };
    if (claims[eventId + ":" + runId]) return;
    claims[eventId + ":" + runId] = { at: Date.now(), status: "claimed" };
    return { ...p, eventClaims: claims };
  });
  if (!tx.committed) throw new HttpsError("already-exists", "Du hast bei diesem Event bereits mitgemacht.");
  return { claimed: true, runId };
});
exports.addPlayerActivity = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  const text = String(request.data?.text || "").trim().slice(0, 120);
  if (!text) throw new HttpsError("invalid-argument", "Aktivität fehlt.");
  const player = (await db.ref("players/" + auth.uid + "/name").get()).val() || "Spieler";
  await db.ref("activity").push({ name: String(player).slice(0, 24), text, at: Date.now(), uid: auth.uid });
  return { saved: true };
});
exports.updatePlayerPresence = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  const remove = request.data?.remove === true;
  if (remove) { await db.ref("online/" + auth.uid).remove(); return { online: false }; }
  const name = String((await db.ref("players/" + auth.uid + "/name").get()).val() || "Spieler").slice(0, 24);
  await db.ref("online/" + auth.uid).set({ name, at: Date.now() });
  return { online: true };
});
exports.saveGodzillaVote = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const side = request.data?.side;
  const events = (await db.ref("events").get()).val() || {};
  if (events.active !== "godzilla" || !["godzilla","kong"].includes(side)) throw new HttpsError("failed-precondition", "Godzilla-Abstimmung ist nicht aktiv.");
  const runId = String(events.runId || events.startedAt || "");
  const ref = db.ref("players/" + auth.uid);
  const tx = await ref.transaction((p) => {
    if (!p) return;
    const votes = { ...(p.godzillaVotes || {}) };
    if (votes[runId]) return;
    votes[runId] = side;
    return { ...p, godzillaVotes: votes };
  });
  if (!tx.committed) throw new HttpsError("already-exists", "Du hast bereits abgestimmt.");
  await db.ref("events/godzillaVotes/" + auth.uid).set({ side, at: Date.now(), runId });
  return { saved: true };
});

exports.awardEventReward = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const eventId = String(request.data?.eventId || "");
  if (!EVENT_TYPES.has(eventId)) throw new HttpsError("invalid-argument", "Unbekanntes Event.");
  const settings = (await db.ref("settings").get()).val() || {};
  const events = (await db.ref("events").get()).val() || {};
  if (events.active !== eventId) throw new HttpsError("failed-precondition", "Event nicht aktiv.");
  const runId = String(events.runId || events.startedAt || "");
  const ref = db.ref("players/" + auth.uid);
  const before = (await ref.get()).val();
  const claimKey = eventId + ":" + runId;
  if (!before?.eventClaims?.[claimKey]) throw new HttpsError("failed-precondition", "Event-Teilnahme fehlt.");
  if (before.eventClaims[claimKey].rewarded) throw new HttpsError("already-exists", "Belohnung bereits abgeholt.");
  const reward = pickRoundPrize(currentLuck(auth, before, settings), eventId, settings, before);
  let reserved = false;
  if (reward?.id === "football") {
    const txOwner = await db.ref("settings/footballTokenOwner").transaction((v) => v == null ? auth.uid : undefined);
    if (!txOwner.committed) throw new HttpsError("already-exists", "Football Token bereits vergeben.");
    reserved = true;
  }
  try {
    const tx = await ref.transaction((p) => {
      if (!p || p.eventClaims?.[claimKey]?.rewarded) return;
      const inventory = { ...(p.inventory || {}) };
      const firstWon = { ...(p.firstWon || {}) };
      if (reward) {
        if (reward.id === "football" && Number(inventory.football || 0) > 0) return;
        inventory[reward.id] = (Number(inventory[reward.id]) || 0) + 1;
        if (!firstWon[reward.id]) firstWon[reward.id] = Date.now();
      }
      const claims = { ...(p.eventClaims || {}) };
      claims[claimKey] = { ...claims[claimKey], rewarded: true, rewardId: reward?.id || null, rewardedAt: Date.now() };
      return { ...p, inventory, firstWon, eventClaims: claims, totalWins: (Number(p.totalWins) || 0) + (reward ? 1 : 0) };
    });
    if (!tx.committed) throw new HttpsError("aborted", "Belohnung konnte nicht sicher vergeben werden.");
    return { reward: reward?.id || null };
  } catch (e) {
    if (reserved) await db.ref("settings/footballTokenOwner").transaction((v) => v === auth.uid ? null : undefined);
    throw e;
  }
});

exports.saveMainAdminCode = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  await assertMainAdminDuringLock(auth);
  const code = String(request.data?.code || "").trim();
  if (code.length < 8 || code.length > 128) throw new HttpsError("invalid-argument", "Der Hauptadmin-Code muss mindestens 8 Zeichen haben.");
  const digest = hashCode(code);
  const all = (await db.ref("admin/roleCodes").get()).val() || {};
  if (all[digest] && all[digest].role !== "mainAdmin") throw new HttpsError("already-exists", "Dieser Code wird bereits verwendet.");
  all[digest] = { role: "mainAdmin", uid: auth.uid, createdAt: Date.now() };
  await db.ref("admin/roleCodes").set(all);
  await db.ref("admin/codeHash").set(digest);
  await db.ref("adminProof/" + auth.uid).set(digest);
  return { saved: true };
});
exports.queueBlitz = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  await assertMainAdminDuringLock(auth);
  const scope = request.data?.scope;
  const targetName = String(request.data?.targetName || "").trim().slice(0, 24);
  const players = (await db.ref("players").get()).val() || {};
  let targets;
  if (scope === "self") targets = [auth.uid];
  else if (scope === "global") targets = Object.keys(players);
  else if (scope === "single") {
    const found = Object.entries(players).find(([,p]) => String(p?.name || "").trim().toLowerCase() === targetName.toLowerCase());
    if (!found) throw new HttpsError("not-found", "Spieler nicht gefunden.");
    targets = [found[0]];
  } else throw new HttpsError("invalid-argument", "Ungültiger Blitz-Bereich.");
  if (!targets.length || targets.length > 200) throw new HttpsError("failed-precondition", "Ungültige Anzahl Spieler.");
  let queued = 0;
  for (const id of targets) {
    const tx = await db.ref("players/" + id).transaction((p) => p ? { ...p, pendingBlitz: Math.max(0, Number(p.pendingBlitz) || 0) + 1 } : undefined);
    if (tx.committed) queued++;
  }
  return { queued };
});
exports.joinLaserTag = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const skin = Number(request.data?.skin);
  if (!Number.isInteger(skin) || skin < 0 || skin > 4) throw new HttpsError("invalid-argument", "Ungültiger LaserTag-Skin.");
  const events = (await db.ref("events").get()).val() || {};
  if (events.active !== "lasertag") throw new HttpsError("failed-precondition", "LaserTag ist nicht aktiv.");
  const elapsed = Date.now() - Number(events.startedAt || Date.now());
  if (elapsed < 0 || elapsed > 30000) throw new HttpsError("deadline-exceeded", "Die Skin-Auswahl ist beendet.");
  const name = String((await db.ref("players/" + auth.uid + "/name").get()).val() || "Spieler").slice(0,24);
  await db.ref("events/laserPlayers/" + auth.uid).set({ name, skin, score: 0, joinedAt: Date.now(), spectator: false, lastShotAt: 0 });
  return { joined: true };
});
exports.scoreLaserTag = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const events = (await db.ref("events").get()).val() || {};
  if (events.active !== "lasertag") throw new HttpsError("failed-precondition", "LaserTag ist nicht aktiv.");
  const elapsed = Date.now() - Number(events.startedAt || Date.now());
  if (elapsed < 30000 || elapsed >= 330000) throw new HttpsError("deadline-exceeded", "LaserTag-Punkte können gerade nicht gesammelt werden.");
  const ref = db.ref("events/laserPlayers/" + auth.uid);
  const tx = await ref.transaction((p) => {
    if (!p || p.spectator) return;
    const now = Date.now();
    if (now - Number(p.lastShotAt || 0) < 900) return;
    return { ...p, score: Math.max(0, Number(p.score) || 0) + 1, lastShotAt: now };
  });
  if (!tx.committed) throw new HttpsError("resource-exhausted", "Bitte warte kurz vor dem nächsten Schuss.");
  return { score: tx.snapshot.val().score };
});

exports.setComebackAdminAbuse = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  await assertMainAdminDuringLock(auth);
  const active = request.data?.active;
  if (typeof active !== "boolean") throw new HttpsError("invalid-argument", "Ungültiger Event-Status.");
  if (active) await db.ref("events/comebackAdminAbuse").set({ active: true, startedAt: Date.now(), participants: {} });
  else await db.ref("events/comebackAdminAbuse/active").set(false);
  return { active };
});
exports.joinComebackAdminAbuse = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  const ref = db.ref("events/comebackAdminAbuse");
  const event = (await ref.get()).val() || {};
  if (event.active !== true) throw new HttpsError("failed-precondition", "Comeback Admin Abuse ist nicht aktiv.");
  await ref.child("participants/" + auth.uid).set({ joinedAt: Date.now() });
  return { joined: true };
});
exports.grantComebackRewards = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin"]);
  await assertMainAdminDuringLock(auth);
  const ref = db.ref("events/comebackAdminAbuse");
  const event = (await ref.get()).val() || {};
  if (event.active !== true) throw new HttpsError("failed-precondition", "Comeback Admin Abuse ist nicht aktiv.");
  await ref.child("active").set(false);
  const participants = Object.keys(event.participants || {});
  if (!participants.length) throw new HttpsError("failed-precondition", "Es gibt keine registrierten Teilnehmer.");
  let granted = 0, skipped = 0;
  for (const id of participants) {
    const tx = await db.ref("players/" + id).transaction((p) => {
      if (!p || p.comebackGift) return;
      return { ...p, comebackGift: "ready", title: "OG COMEBACK PLAYER" };
    });
    if (tx.committed) granted++; else skipped++;
  }
  return { granted, skipped, participants: participants.length };
});
exports.openComebackGift = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  await assertMainAdminDuringLock(auth);
  const ref = db.ref("players/" + auth.uid);
  const before = (await ref.get()).val();
  if (before?.comebackGift !== "ready") throw new HttpsError("failed-precondition", "Kein Comeback Gift verfügbar.");
  const settings = (await db.ref("settings").get()).val() || {};
  const reward = pickRoundPrize(currentLuck(auth, before, settings), null, settings, before);
  let reserved = false;
  if (reward?.id === "football") {
    const own = await db.ref("settings/footballTokenOwner").transaction((v) => v == null ? auth.uid : undefined);
    if (!own.committed) throw new HttpsError("already-exists", "Football Token bereits vergeben.");
    reserved = true;
  }
  try {
    const tx = await ref.transaction((p) => {
      if (!p || p.comebackGift !== "ready") return;
      const inventory = { ...(p.inventory || {}) }, firstWon = { ...(p.firstWon || {}) };
      if (reward) { if (reward.id === "football" && Number(inventory.football || 0) > 0) return; inventory[reward.id] = (Number(inventory[reward.id]) || 0) + 1; if (!firstWon[reward.id]) firstWon[reward.id] = Date.now(); }
      return { ...p, comebackGift: "opened", inventory, firstWon, totalWins: (Number(p.totalWins) || 0) + (reward ? 1 : 0) };
    });
    if (!tx.committed) throw new HttpsError("aborted", "Comeback Gift konnte nicht geöffnet werden.");
    return { reward: reward?.id || null };
  } catch (e) {
    if (reserved) await db.ref("settings/footballTokenOwner").transaction((v) => v === auth.uid ? null : undefined);
    throw e;
  }
});
