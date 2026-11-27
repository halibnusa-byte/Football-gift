const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

test("reward endpoint stays disabled until server-authoritative claims exist", () => {
  assert.match(source, /exports\.rollAndAward\s*=\s*onCall/);
  assert.match(source, /Belohnungen sind noch nicht freigeschaltet/);
});

test("callables require Firebase Authentication", () => {
  assert.match(source, /function requireAuth\(request\)/);
  assert.match(source, /if \(!request\.auth\)/);
  assert.match(source, /function requireRole\(request, roles\)/);
});

test("role codes are checked on the server and custom claims are assigned server-side", () => {
  assert.match(source, /exports\.redeemRoleCode\s*=\s*onCall/);
  assert.match(source, /crypto\.createHash\(["']sha256["']\)/);
  assert.match(source, /defineSecret\(["']ROLE_CODE_MAP["']\)/);
  assert.match(source, /roleCodeMapSecret\.value\(\)/);
  assert.doesNotMatch(source, /db\.ref\(["']admin\//);
  assert.match(source, /setCustomUserClaims\(auth\.uid, claims\)/);
});

test("event changes are whitelisted and role-gated", () => {
  assert.match(source, /const EVENT_TYPES = new Set/);
  assert.match(source, /exports\.setActiveEvent\s*=\s*onCall/);
  assert.match(source, /requireRole\(request, \[["']mainAdmin["'], ["']halfAdmin["'], ["']quarterAdmin["']\]\)/);
});

test("server lock is main-admin-only", () => {
  assert.match(source, /exports\.setServerControl\s*=\s*onCall/);
  assert.match(source, /requireRole\(request, \[["']mainAdmin["']\]\)/);
});

const client = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");

test("browser role login uses the trusted callable, not database role hashes", () => {
  const roleSection = client.slice(client.indexOf("async function roleCheck"), client.indexOf("function applyRolePanelPermissions"));
  assert.match(roleSection, /httpsCallable\(functions,["']redeemRoleCode["']\)/);
  assert.doesNotMatch(roleSection, /get\(path\(["']admin\//);
  assert.doesNotMatch(roleSection, /adminProof/);
});

test("browser event and server-lock controls call trusted backend endpoints", () => {
  assert.match(client, /httpsCallable\(functions,["']setActiveEvent["']\)/);
  assert.match(client, /httpsCallable\(functions,["']setServerControl["']\)/);
  assert.doesNotMatch(client, /set\(path\(["']serverControl["']/);
});


test("role redemption validates code length and uses a strict role allowlist", () => {
  assert.match(source, /code\.length < 4 \|\| code\.length > 128/);
  assert.match(source, /new Set\(\["mainAdmin", "halfAdmin", "quarterAdmin", "special", "messageMan"\]\)/);
});

test("special and message-man codes are bound to the authenticated UID", () => {
  assert.match(source, /entry\.uid !== auth\.uid/);
  assert.match(source, /\["special", "messageMan"\]/);
});

test("role redemption clears stale privileged claims before assigning the new role", () => {
  assert.match(source, /for \(const key of \["mainAdmin", "halfAdmin", "quarterAdmin", "special", "messageMan"\]\) delete claims\[key\]/);
  assert.match(source, /setCustomUserClaims\(auth\.uid, claims\)/);
});

test("role redemption fails closed when the private role map is missing or malformed", () => {
  assert.match(source, /failed-precondition/);
  assert.match(source, /JSON\.parse\(roleCodeMapSecret\.value\(\)\)/);
  assert.match(source, /Array\.isArray\(roleMap\)/);
});
