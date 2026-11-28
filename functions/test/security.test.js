
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
  assert.match(source, /setCustomUserClaims\(auth\.uid, claims\)/);
});

test("event changes are whitelisted and role-gated", () => {
  assert.match(source, /const EVENT_TYPES = new Set/);
  assert.match(source, /exports\.setActiveEvent\s*=\s*onCall/);
  assert.match(source, /requireRole\(request, \["mainAdmin", "halfAdmin", "quarterAdmin"\]\)/);
});

test("server lock is main-admin-only", () => {
  assert.match(source, /exports\.setServerControl\s*=\s*onCall/);
  assert.match(source, /requireRole\(request, \["mainAdmin"\]\)/);
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
  assert.match(source, /entry\.role === "special" \|\| entry\.role === "messageMan"/);
  assert.match(source, /entry\.uid !== auth\.uid/);
});

test("role redemption clears stale privileged claims before assigning the new role", () => {
  assert.match(source, /for \(const key of \["mainAdmin"/);
  assert.match(source, /setCustomUserClaims\(auth\.uid, claims\)/);
});

test("role redemption fails closed when the private role map is missing or malformed", () => {
  assert.match(source, /failed-precondition/);
  assert.match(source, /JSON\.parse\(roleCodeMapSecret\.value\(\)\)/);
  assert.match(source, /Array\.isArray\(roleMap\)/);
});


test("event updates preserve unrelated event configuration", () => {
  assert.match(source, /db\.ref\(["']events["']\)\.update\(/);
  assert.doesNotMatch(source, /db\.ref\(["']events["']\)\.set\(/);
});



test("gift transfers are authenticated and restricted to main admins or special players", () => {
  assert.match(source, /exports\.sendGift\s*=\s*onCall/);
  assert.match(source, /claims\.mainAdmin === true/);
  assert.match(source, /claims\.special === true/);
  assert.match(source, /amount > 20/);
  assert.match(source, /settings\/footballTokenOwner/);
});

test("Galaxy queue and player reset actions are main-admin-only callables", () => {
  assert.match(source, /exports\.spawnGalaxyGifts\s*=\s*onCall/);
  assert.match(source, /exports\.resetPlayerData\s*=\s*onCall/);
  assert.match(source, /data\.confirm !== true/);
});

test("browser gift transfer, Galaxy queue and reset use server callables", () => {
  const gift = client.slice(client.indexOf("async function sendGift"), client.indexOf("async function grantTokens"));
  const galaxy = client.slice(client.indexOf("async function spawnGalaxy"), client.indexOf("async function resetData"));
  const reset = client.slice(client.indexOf("async function resetData"), client.indexOf("async function renderEventChallenge"));
  assert.match(gift, /httpsCallable\(functions,'sendGift'\)/);
  assert.doesNotMatch(gift, /update\(path\('players\//);
  assert.match(galaxy, /httpsCallable\(functions,'spawnGalaxyGifts'\)/);
  assert.doesNotMatch(galaxy, /update\(path\('players\//);
  assert.match(reset, /httpsCallable\(functions,'resetPlayerData'\)/);
  assert.doesNotMatch(reset, /update\(path\('players\//);
});


test("announcements are sent through a role-checked backend callable", () => {
  assert.ok(source.includes("exports.sendAnnouncement = onCall"));
  assert.ok(source.includes('requireRole(request, ["mainAdmin", "halfAdmin", "quarterAdmin"])'));
  assert.ok(source.includes("message.length > 240"));
  assert.ok(source.includes('"announcements/global"'));
  assert.ok(source.includes('"announcements/users/"'));
});

test("browser announcement UI uses the trusted callable instead of direct database writes", () => {
  const section = client.slice(client.indexOf("async function adminAnnouncement"), client.indexOf("async function spawnGalaxy"));
  assert.ok(section.includes("httpsCallable(functions,'sendAnnouncement')"));
  assert.ok(!section.includes("set(path('announcements"));
});

test("live chat mutations are server-authoritative and role-checked", () => {
  assert.ok(source.includes("exports.sendChatMessage = onCall"));
  assert.ok(source.includes("exports.deleteChatMessage = onCall"));
  assert.ok(source.includes("exports.reportChatMessage = onCall"));
  assert.ok(source.includes("exports.moderateChatMessage = onCall"));
  assert.ok(source.includes('requireRole(request, ["mainAdmin"])'));
  assert.ok(source.includes("messageReports/"));
  assert.ok(source.includes("chatRateLimit/"));
});

test("browser live chat uses callable mutations and renders text safely", () => {
  assert.ok(client.includes("httpsCallable(functions,'sendChatMessage')"));
  assert.ok(client.includes("httpsCallable(functions,'deleteChatMessage')"));
  assert.ok(client.includes("httpsCallable(functions,'reportChatMessage')"));
  assert.ok(client.includes("httpsCallable(functions,'moderateChatMessage')"));
  assert.ok(client.includes("body.textContent=String(m.text)"));
  assert.ok(client.includes('id="liveChatPanel"'));
});

test("Message Man uses the same server-authoritative live chat endpoint", () => {
  const section = client.slice(client.indexOf("$('messageManSend').onclick"), client.indexOf("$('logoutBtn').onclick"));
  assert.ok(section.includes("httpsCallable(functions,'sendChatMessage')"));
  assert.ok(!section.includes("push(path('messages')"));
});

test("admin game settings are validated and written by a trusted callable", () => {
  assert.ok(source.includes("exports.saveGameSettings = onCall"));
  assert.ok(source.includes('requireRole(request, ["mainAdmin"])'));
  assert.ok(source.includes('claims.halfAdmin !== true'));
  assert.ok(source.includes("settings/roleLuck/"));
  assert.ok(source.includes("blitzChance"));
  assert.ok(source.includes("diamondChance"));
});

test("browser admin settings no longer write directly to settings", () => {
  for (const id of ["saveLuck", "saveEventOdds", "saveDiamondChance"]) {
    const at = client.indexOf("$('" + id + "').onclick=");
    assert.notEqual(at, -1);
    const section = client.slice(at, at + 1400);
    assert.ok(section.includes("httpsCallable(functions,'saveGameSettings')"));
  }
});

test("admin live chat exposes report moderation controls", () => {
  assert.ok(client.includes('id="chatReportsPanel"'));
  assert.ok(client.includes("onValue(path('messageReports')"));
  assert.ok(client.includes("function renderChatReports"));
  assert.ok(client.includes("['Wiederherstellen','restore']"));
});

test("main admin random recipient grant selects a player server-side without randomizing reward", () => {
  const section = source.slice(source.indexOf("exports.grantAdminTokens"), source.indexOf("// Gift transfers"));
  assert.ok(section.includes('scope !== "random"'));
  assert.ok(section.includes("crypto.randomInt(candidates.length)"));
  assert.ok(section.includes("const prizeId ="));
  assert.ok(client.includes('id="awardRandom"'));
  assert.ok(client.includes("grantTokens(true)"));
  assert.ok(client.includes("prizeId:$('awardPrize').value"));
});

test("update lockdown rejects non-main-admin event, gift, announcement and chat actions", () => {
  assert.ok(source.includes("async function assertMainAdminDuringLock(auth)"));
  assert.ok(source.includes("Während der Update-Sperre hat nur der Hauptadmin Zugriff."));
  for (const fn of ["setActiveEvent", "sendGift", "sendAnnouncement", "sendChatMessage", "deleteChatMessage", "reportChatMessage"]) {
    const at = source.indexOf("exports." + fn + " = onCall");
    assert.notEqual(at, -1);
    const section = source.slice(at, at + 700);
    assert.ok(section.includes("assertMainAdminDuringLock(auth)"), fn + " should enforce update lockdown");
  }
});

test("joining the game checks server lockdown and preserves the existing player profile", () => {
  assert.ok(source.includes("exports.joinGame = onCall"));
  const join = source.slice(source.indexOf("exports.joinGame"));
  assert.ok(join.includes("assertMainAdminDuringLock(auth)"));
  assert.ok(join.includes("...(current || {})"));
  assert.ok(join.includes("current?.inventory || {}"));
});

test("browser join uses the server callable instead of direct profile and presence writes", () => {
  const enter = client.slice(client.indexOf("async function enter"), client.indexOf("function subscribe"));
  assert.ok(enter.includes("httpsCallable(functions,'joinGame')"));
  assert.ok(!enter.includes("update(path('players/'"));
  assert.ok(!enter.includes("set(path('online/'"));
});


test("gift rounds are created and opened only through server-authoritative callables", () => {
  assert.match(source, /exports\.startPlayerRound\s*=\s*onCall/);
  assert.match(source, /exports\.openPlayerGift\s*=\s*onCall/);
  assert.match(source, /Array\.from\(\{ length: 15 \}/);
  assert.match(source, /round\.openedCount >= 3/);
  assert.match(source, /crypto\.randomInt/);
  assert.match(source, /roundState/);
  assert.match(source, /inventory,\s*firstWon/);
  assert.match(client, /httpsCallable\(functions,'startPlayerRound'\)/);
  assert.match(client, /httpsCallable\(functions,'openPlayerGift'\)/);
  assert.doesNotMatch(client, /async function saveRound\(\)\{if\(!uid\)return;await update\(path\('players\/'\+uid\)/);
  const openBox = client.slice(client.indexOf("async function openBox(i)"), client.indexOf("async function enter"));
  assert.doesNotMatch(openBox, /rollAndAward/);
});


test("all browser database mutations have been migrated to trusted callables", () => {
  const mutations = client.split("\n").filter((line) => /\b(set|update|remove|push|runTransaction)\((?:path\(|ref\(db|db\.ref\()/.test(line));
  assert.deepEqual(mutations, []);
  for (const fn of ["saveRoleCodes","saveNamedRoleCodes","saveGodzillaSettings","recordEventClaim","awardEventReward","saveGodzillaVote","addPlayerActivity","updatePlayerPresence","saveMainAdminCode","queueBlitz","joinLaserTag","scoreLaserTag","saveShopConfig","redeemShopItem","setComebackAdminAbuse","joinComebackAdminAbuse","grantComebackRewards","openComebackGift"]) {
    assert.ok(source.includes("exports." + fn + " = onCall"));
  }
});
test("shop points are credited per server-confirmed gift opening and redemption is atomic", () => {
  assert.ok(source.includes("shopPoints: Math.max(0, Number(latest.shopPoints) || 0) + 1"));
  assert.ok(source.includes("exports.saveShopConfig = onCall"));
  assert.ok(source.includes("exports.redeemShopItem = onCall"));
  assert.ok(source.includes("shopPoints: points - product.price"));
});
test("Comeback gifts are restricted to registered participants", () => {
  assert.ok(source.includes("exports.setComebackAdminAbuse = onCall"));
  assert.ok(source.includes("exports.joinComebackAdminAbuse = onCall"));
  assert.ok(source.includes("exports.grantComebackRewards = onCall"));
  assert.ok(source.includes("events/comebackAdminAbuse/participants"));
  assert.ok(client.includes("httpsCallable(functions,'openComebackGift')"));
});

test("the 50 planned event IDs exist in the browser catalog and trusted backend allowlist", () => {
  const ids = [
    "galaxy","unicorn","hacker","robot","cube","diamond","time","school","lava","alien",
    "lasertag","ocean","zombie","multiverse","football","dinosaur","candy","castle","space",
    "ghost","winter","egypt","superhero","racing","dragon","music","mystery","madness",
    "secretgarden","elephantparade","pirate","carnival","ninja","toy","crystal","wildwest",
    "bakery","comic","safari","cyber","wizard","moon","arcade","samurai","stoneage",
    "masquerade","science","luxury","rainbow","timemachine"
  ];
  for (const id of ids) {
    assert.ok(client.includes(id + ":["), "missing browser catalog entry: " + id);
    assert.ok(source.includes('"' + id + '"'), "missing backend event allowlist entry: " + id);
  }
  assert.ok(client.includes('id="madnessOn"'));
  assert.ok(client.includes('id="secretgardenOn"'));
  assert.ok(client.includes('id="elephantparadeOn"'));
});

test("Galaxy gifts can only be queued or assigned to a round during the Galaxy event", () => {
  const spawn = source.slice(source.indexOf("exports.spawnGalaxyGifts"), source.indexOf("exports.resetPlayerData"));
  assert.match(spawn, /activeEvent !== "galaxy"/);
  const round = source.slice(source.indexOf("exports.startPlayerRound"), source.indexOf("exports.openPlayerGift"));
  assert.match(round, /activeEvent === "galaxy" && pendingGalaxy > 0/);
  assert.match(source, /eventType === "galaxy" && secureUnit\(\) < 0\.00001/);
});

test("Unicorn piñata does not use an invented 50-percent reward chance", () => {
  const section = client.slice(client.indexOf("if(type==='unicorn')"), client.indexOf("}else if(type==='cube')"));
  assert.match(section, /await win\('Die Piñata spuckt aus'\)/);
  assert.doesNotMatch(section, /Math\.random\(\)\s*<\s*\.5/);
});

test("Power Hours do not use invented weekday or clock schedules", () => {
  assert.match(source, /Keine erfundenen Power-Hours-Zeiten/);
  assert.doesNotMatch(source, /parts\.weekday === ["']Sat["']/);
  assert.doesNotMatch(source, /minute >= 900 && minute < 1020/);
  assert.match(client, /const isPower=\(\)=>false/);
});

test("event mini-games are implemented for every planned event from 15 through 50", () => {
  for (const id of ["football","dinosaur","candy","castle","space","ghost","winter","egypt","superhero","racing","dragon","music","mystery","madness","secretgarden","elephantparade","pirate","carnival","ninja","toy","crystal","wildwest","bakery","comic","safari","cyber","wizard","moon","arcade","samurai","stoneage","masquerade","science","luxury","rainbow","timemachine"]) {
    assert.ok(client.includes(id + ":{title:"), "missing playable mini-game spec: " + id);
  }
  assert.ok(client.includes("renderPlannedMiniGame(type,body,result,status,claim,win)"));
  assert.doesNotMatch(client, /Eine interaktive Challenge wird erst aktiviert/);
});

test("shop items are consumed by a trusted server transaction", () => {
  assert.match(source, /exports\.consumeShopItem\s*=\s*onCall/);
  assert.match(source, /const allowed = new Set\(\["hackerScanner","robotScanner","magicRemix","goldenReportCard","lavaShield","alienRadar","pearlRadar"\]\)/);
  assert.match(source, /shopInventory\[productId\] = remaining/);
  assert.match(client, /httpsCallable\(functions,'consumeShopItem'\)/);
});

test("LaserTag uses ten-second skin selection, three lives, eliminations and top-three Diamond Gifts", () => {
  const join = source.slice(source.indexOf("exports.joinLaserTag"), source.indexOf("exports.scoreLaserTag"));
  const hit = source.slice(source.indexOf("exports.laserHit"), source.indexOf("exports.finishLaserTag"));
  const finish = source.slice(source.indexOf("exports.finishLaserTag"), source.indexOf("exports.setComebackAdminAbuse"));
  assert.match(join, /elapsed > 10000/);
  assert.match(join, /lives: 3/);
  assert.match(hit, /Number\(p\.lives \?\? 3\) - 1/);
  assert.match(hit, /spectator: lives === 0/);
  const finalizer = source.slice(source.indexOf("async function finalizeLaserTagIfComplete"), source.indexOf("exports.joinLaserTag"));
  assert.match(finalizer, /slice\(0,3\)/);
  assert.match(finalizer, /inventory\.diamondGift/);
  assert.match(client, /httpsCallable\(functions,'laserHit'\)/);
  assert.match(client, /Letzter Spieler mit Leben gewinnt/);
});

test("LaserTag ends on last player standing and has no invented five-minute timeout", () => {
  assert.match(source, /async function finalizeLaserTagIfComplete\(\)/);
  assert.match(source, /alive\.length > 1/);
  const hit = source.slice(source.indexOf("exports.laserHit"), source.indexOf("exports.finishLaserTag"));
  assert.match(hit, /finalizeLaserTagIfComplete\(\)/);
  assert.doesNotMatch(hit, /310000/);
  assert.match(client, /Letzter Spieler mit Leben gewinnt/);
});

test("Zombie vials are server-selected and reward requires a completed two-player rescue", () => {
  const choose = source.slice(source.indexOf("exports.chooseZombieVial"), source.indexOf("exports.submitZombieRescue"));
  const rescue = source.slice(source.indexOf("exports.submitZombieRescue"), source.indexOf("exports.awardEventReward"));
  const awardStart = source.indexOf("exports.awardEventReward");
  const award = source.slice(awardStart, source.indexOf("exports.", awardStart + 10));
  assert.match(choose, /crypto\.randomInt\(5\)/);
  assert.match(choose, /safe\.size < 3/);
  assert.match(rescue, /Object\.keys\(votes\)\.length >= 2/);
  assert.match(award, /rescue\.completed !== true/);
  assert.match(award, /rescue\.ownerUid !== auth\.uid/);
  assert.match(award, /rescue\.votes\?\.\[auth\.uid\] !== true/);
  assert.match(client, /submitZombieRescue/);
  assert.match(client, /chooseZombieVial/);
});

test("Ocean Golden Shark uses only the admin-configured chance and one chest per player", () => {
  const open = source.slice(source.indexOf("exports.openOceanChest"), source.indexOf("exports.awardEventReward"));
  const settings = source.slice(source.indexOf("exports.saveGameSettings"), source.indexOf("exports.saveShopConfig"));
  assert.match(open, /oceanGoldenSharkChance/);
  assert.match(open, /secureUnit\(\) < chance/);
  assert.match(open, /events\/oceanChests/);
  assert.match(settings, /oceanGoldenSharkChance/);
  assert.match(client, /openOceanChest/);
  assert.match(client, /oceanSharkChance/);
});

test("Ocean reward requires a recorded chest opening", () => {
  const start = source.indexOf("exports.awardEventReward");
  const award = source.slice(start, source.indexOf("exports.", start + 10));
  assert.match(award, /eventId === "ocean"/);
  assert.match(award, /events\/oceanChests/);
  assert.match(award, /Öffne zuerst eine Schatztruhe/);
});

test("Magic Cube uses three separately configured chances and server-stored outcomes", () => {
  const open = source.slice(source.indexOf("exports.openMagicCube"), source.indexOf("exports.awardEventReward"));
  const start = source.indexOf("exports.awardEventReward");
  const award = source.slice(start, source.indexOf("exports.", start + 10));
  const settings = source.slice(source.indexOf("exports.saveGameSettings"), source.indexOf("exports.saveShopConfig"));
  assert.match(open, /magicCubeAChance/);
  assert.match(open, /magicCubeBChance/);
  assert.match(open, /magicCubeCChance/);
  assert.match(open, /secureUnit\(\) < Number\(chances\[cube\]\)/);
  assert.match(award, /events\/magicCubes/);
  assert.match(award, /magicCubeOutcome\.rewardId/);
  assert.match(settings, /magicCubeAChance/);
  assert.match(client, /openMagicCube/);
  assert.match(client, /magicCubeAChance/);
});

test("Golden Cup is a randomized penalty challenge rather than a fixed-answer quiz", () => {
  assert.match(client, /football:\{title:'GOLDEN CUP · ELFMETER',mode:'penalty'/);
  assert.match(client, /const keeper=Math\.floor\(Math\.random\(\)\*3\)/);
  assert.match(client, /if\(i===keeper\)fail/);
});
