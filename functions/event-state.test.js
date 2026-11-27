const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldMarkSkibidiCompleted } = require("./event-state");

test("does not mark Skibidi complete when it starts", () => {
  assert.equal(shouldMarkSkibidiCompleted(null, "skibidi"), false);
});

test("marks Skibidi complete when it stops", () => {
  assert.equal(shouldMarkSkibidiCompleted("skibidi", null), true);
});

test("does not mark another event complete when it stops", () => {
  assert.equal(shouldMarkSkibidiCompleted("galaxy", null), false);
});

test("does not mark Skibidi complete when switching to another event", () => {
  assert.equal(shouldMarkSkibidiCompleted("skibidi", "galaxy"), false);
});
