"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { comebackLuck, selectComebackPrize } = require("./comeback");

test("Comeback gift uses the existing global luck setting", () => {
  assert.equal(comebackLuck({
    settings: { luckEnabled: true, luckMultiplier: 8 },
    now: Date.UTC(2026, 10, 27, 10, 0),
  }), 8);
});

test("special-player and power-hour multipliers are included", () => {
  assert.equal(comebackLuck({
    claims: { special: true },
    now: Date.UTC(2026, 10, 28, 10, 0),
  }), 2);
});

test("new token prizes stay locked until the Skibidi completion flag is true", () => {
  const prize = selectComebackPrize({
    settings: {},
    now: Date.UTC(2026, 10, 27, 10, 0),
    random: () => 0,
  });
  assert.notEqual(prize && prize.id, "comeback");
});

test("a globally-owned Football Token and an already-owned Penalty Token are excluded", () => {
  const prize = selectComebackPrize({
    settings: { footballTokenOwner: "another-user", completedEvents: { skibidi: true } },
    player: { inventory: { penalty: 1 } },
    now: Date.UTC(2026, 10, 27, 10, 0),
    random: () => 0.000045,
  });
  assert.equal(prize && prize.id, "goal");
});

test("a low roll can correctly produce a miss when all prize weights are tiny", () => {
  const prize = selectComebackPrize({
    settings: {},
    now: Date.UTC(2026, 10, 27, 10, 0),
    random: () => 0.5,
  });
  assert.equal(prize, null);
});

test("Galaxy event keeps its rare Comeback gift outcome", () => {
  const rolls = [0, 0.5];
  const prize = selectComebackPrize({
    settings: { completedEvents: { skibidi: true } },
    eventState: { active: "galaxy" },
    now: Date.UTC(2026, 10, 27, 10, 0),
    random: () => rolls.shift() ?? 0,
  });
  assert.equal(prize && prize.id, "revenge");
});

test("Diamond event keeps its separate Diamond gift outcome", () => {
  const prize = selectComebackPrize({
    settings: { diamondChance: 100 },
    eventState: { active: "diamond" },
    now: Date.UTC(2026, 10, 27, 10, 0),
    random: () => 0,
  });
  assert.equal(prize && prize.id, "diamondGift");
});

test("Blitz event modifier is applied to the Comeback draw", () => {
  const rolls = [0, 0.00002];
  const prize = selectComebackPrize({
    settings: { blitzChance: 1 },
    eventState: { active: "blitz" },
    now: Date.UTC(2026, 10, 27, 10, 0),
    random: () => rolls.shift() ?? 0,
  });
  assert.equal(prize && prize.id, "revenge");
});

test("half-admin luck uses the configured per-user multiplier, capped at 50", () => {
  assert.equal(comebackLuck({
    settings: { roleLuck: { "test-user": 80 } },
    claims: { halfAdmin: true },
    uid: "test-user",
    now: Date.UTC(2026, 10, 27, 10, 0),
  }), 50);
});
