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
