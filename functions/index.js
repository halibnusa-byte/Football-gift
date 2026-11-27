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
  await db.ref("events").set({ active: type, startedAt: now, runId: String(now) });
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
