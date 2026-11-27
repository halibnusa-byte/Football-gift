const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const crypto = require("node:crypto");

initializeApp();
const db = getDatabase();

const PRIZES = [
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
const EVENT_TYPES = new Set([
  "galaxy", "diamond", "hacker", "unicorn", "robot", "cube", "skibidi",
  "godzilla", "time", "school", "lava", "alien", "blitz", "lasertag",
  "spiderman", "cocacola", "plants", "elephant", "ocean", "zombie",
  "multiverse", "football", "dinosaur", "candy", "castle", "space",
  "ghost", "winter", "egypt", "superhero", "racing", "dragon", "music",
  "mystery",
]);

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
function validUid(uid) {
  return typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
}
function pickPrize() {
  const total = PRIZES.reduce((sum, p) => sum + p.chance, 0);
  let roll = crypto.randomInt(0, 1_000_000) / 1_000_000 * total;
  for (const prize of PRIZES) {
    roll -= prize.chance;
    if (roll < 0) return prize.id;
  }
  return null;
}

// This callable is the first server-side reward path. The client must be migrated
// to call it instead of writing player inventory or token ownership itself.
exports.rollAndAward = onCall({ region: "europe-west1", enforceAppCheck: false }, async (request) => {
  const auth = requireAuth(request);
  const targetUid = request.data && request.data.targetUid ? request.data.targetUid : auth.uid;
  if (!validUid(targetUid)) throw new HttpsError("invalid-argument", "Ungültiger Spieler.");
  if (targetUid !== auth.uid) {
    requireRole(request, ["mainAdmin"]);
  }

  const prizeId = pickPrize();
  if (!prizeId) return { prizeId: null };

  if (prizeId === "football") {
    const ownerRef = db.ref("settings/footballTokenOwner");
    const ownerTx = await ownerRef.transaction((current) => current == null ? targetUid : undefined);
    if (!ownerTx.committed) return { prizeId: null, reason: "already-awarded" };
  }

  const playerRef = db.ref("players/" + targetUid);
  const playerTx = await playerRef.transaction((current) => {
    if (!current || typeof current !== "object") return;
    const inventory = { ...(current.inventory || {}) };
    if (prizeId === "football" && Number(inventory.football || 0) > 0) return;
    inventory[prizeId] = (Number(inventory[prizeId]) || 0) + 1;
    const firstWon = { ...(current.firstWon || {}) };
    if (!firstWon[prizeId]) firstWon[prizeId] = Date.now();
    return { ...current, inventory, firstWon, totalWins: (Number(current.totalWins) || 0) + 1 };
  });

  if (!playerTx.committed) {
    if (prizeId === "football") {
      await db.ref("settings/footballTokenOwner").transaction((current) => current === targetUid ? null : undefined);
    }
    throw new HttpsError("failed-precondition", "Spieler nicht gefunden oder Belohnung konnte nicht vergeben werden.");
  }
  return { prizeId };
});

exports.setActiveEvent = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireRole(request, ["mainAdmin", "halfAdmin", "quarterAdmin"]);
  const type = request.data && request.data.type;
  const claims = auth.token || {};
  if (type !== null && !EVENT_TYPES.has(type)) {
    throw new HttpsError("invalid-argument", "Unbekanntes Event.");
  }
  if (claims.quarterAdmin && !claims.mainAdmin &&
      !["hacker", "unicorn", "galaxy", "diamond", "robot"].includes(type)) {
    throw new HttpsError("permission-denied", "Dieses Event ist für Viertel-Admins nicht freigegeben.");
  }
  if (claims.halfAdmin && !claims.mainAdmin &&
      !["cube", "hacker", "unicorn", "galaxy", "diamond", "robot", "school"].includes(type)) {
    throw new HttpsError("permission-denied", "Dieses Event ist für Halb-Admins nicht freigegeben.");
  }

  const now = Date.now();
  await db.ref("events").set({ active: type, startedAt: now, runId: String(now) });
  if (type === "skibidi") {
    await db.ref("settings/completedEvents/skibidi").set(true);
  }
  return { active: type, startedAt: now };
});
