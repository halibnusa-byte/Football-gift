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
    random: () => 0.999999,
  });
  assert.notEqual(prize && prize.id, "football");
  assert.notEqual(prize && prize.id, "penalty");
});

test("a low roll can correctly produce a miss when all prize weights are tiny", () => {
  const prize = selectComebackPrize({
    settings: {},
    now: Date.UTC(2026, 10, 27, 10, 0),
    random: () => 0.5,
  });
  assert.equal(prize, null);
});
