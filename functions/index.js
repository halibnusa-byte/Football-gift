const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("node:crypto");

initializeApp();
const db = getDatabase();

const EVENT_TYPES = new Set([
  "galaxy", "diamond", "hacker", "unicorn", "robot", "cube", "skibidi",
  "godzilla", "time", "school", "lava", "alien", "blitz", "lasertag",
  "spiderman", "cocacola", "plants", "elephant", "ocean", "zombie",
  "multiverse", "football", "dinosaur", "candy", "castle", "space",
  "ghost", "winter", "egypt", "superhero", "racing", "dragon", "music",
  "mystery",
]);

function hashCode(value) {\n  return crypto.createHash("sha256").update(value, "utf8").digest("hex");\n}\n\nfunction requireAuth(request) {
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


// Verify a role code on the trusted server and issue Firebase custom claims.
// The client never receives stored hashes or decides its own role.
exports.redeemRoleCode = onCall({ region: "europe-west1" }, async (request) => {
  const auth = requireAuth(request);
  const code = request.data && typeof request.data.code === "string" ? request.data.code.trim() : "";
  if (code.length < 4 || code.length > 128) {
    throw new HttpsError("invalid-argument", "Ungültiger Zugangscode.");
  }
  const digest = hashCode(code);
  const [main, special, quarter, half, messageMen] = await Promise.all([
    db.ref("admin/codeHash").get(),
    db.ref("admin/special").get(),
    db.ref("admin/quarterAdmins/" + digest).get(),
    db.ref("admin/halfAdmins/" + digest).get(),
    db.ref("admin/messageManCodes/" + digest).get(),
  ]);

  let role = "normal";
  let roleName = "";
  if (main.exists() && main.val() === digest) {
    role = "mainAdmin";
  } else if (special.exists() && special.val().uid === auth.uid && special.val().codeHash === digest) {
    role = "special";
    roleName = String(special.val().name || "");
  } else if (quarter.exists()) {
    role = "quarterAdmin";
  } else if (half.exists()) {
    role = "halfAdmin";
  } else if (messageMen.exists() && messageMen.val().uid === auth.uid) {
    role = "messageMan";
    roleName = String(messageMen.val().name || "");
  } else {
    throw new HttpsError("permission-denied", "Dieser Code ist nicht vergeben oder stimmt nicht.");
  }

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
