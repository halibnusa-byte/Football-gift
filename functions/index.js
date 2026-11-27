const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

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
