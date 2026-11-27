"use strict";

const PRIZES = [
  { id: "deinewahl", name: "Deine-Wahl-Token", emoji: "👑", chance: 0.0001 },
  { id: "revenge", name: "Revenge Token", emoji: "🔥", chance: 0.00025 },
  { id: "comeback", name: "Comeback-Token", emoji: "🔁", chance: 0.0005 },
  { id: "doublegoal", name: "Double Goal Token", emoji: "⚽", chance: 0.0005 },
  { id: "selfretter", name: "Selbst-Retter-Token", emoji: "🧤", chance: 0.001 },
  { id: "freistoss", name: "Freistoß-Token", emoji: "🟥", chance: 0.0015 },
  { id: "football", name: "Football Token", emoji: "🏆", chance: 0.002 },
  { id: "penalty", name: "Penalty Token", emoji: "🥅", chance: 0.003 },
  { id: "goal", name: "Ein-Tor-Vorsprung", emoji: "⚽", chance: 0.01 },
  { id: "redcard", name: "Rotkarten-Entferner", emoji: "🟥", chance: 0.015 },
  { id: "keeper", name: "Anstoß- & Torwart-Bonus", emoji: "🧤", chance: 0.02 },
  { id: "switch", name: "Torwart-Switch-Token", emoji: "🔄", chance: 0.025 },
];

function isPowerHour(now) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const minute = Number(values.hour) * 60 + Number(values.minute);
  return values.weekday === "Sat" || (minute >= 900 && minute < 1020);
}

function comebackLuck({ settings = {}, claims = {}, uid = "", now = Date.now() }) {
  const values = [
    settings.luckEnabled ? Number(settings.luckMultiplier || 1) : 1,
    claims.special === true ? 2 : 1,
    isPowerHour(now) ? 2 : 1,
    claims.halfAdmin === true
      ? Math.min(50, Number(settings.roleLuck && settings.roleLuck[uid] || 1))
      : 1,
  ];
  return Math.max(...values.map((value) => Number.isFinite(value) && value > 0 ? value : 1));
}

function selectComebackPrize({
  settings = {},
  player = {},
  claims = {},
  uid = "",
  now = Date.now(),
  random = Math.random,
}) {
  const unlocked = settings.completedEvents && settings.completedEvents.skibidi === true;
  const inventory = player.inventory || {};
  const prizes = PRIZES.filter((prize) => {
    if (!unlocked && ["deinewahl", "doublegoal", "selfretter", "freistoss", "comeback"].includes(prize.id)) return false;
    if (prize.id === "penalty" && Number(inventory.penalty || 0) > 0) return false;
    if (prize.id === "football" && (settings.footballTokenOwner || Number(inventory.football || 0) > 0)) return false;
    return true;
  });
  const multiplier = comebackLuck({ settings, claims, uid, now });
  let weights = prizes.map((prize) => prize.chance * multiplier);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  if (sum > 100) weights = weights.map((weight) => weight * 100 / sum);
  let roll = random() * 100;
  for (let index = 0; index < prizes.length; index += 1) {
    roll -= weights[index];
    if (roll < 0) return prizes[index];
  }
  return null;
}

module.exports = { PRIZES, isPowerHour, comebackLuck, selectComebackPrize };
