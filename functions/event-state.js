function shouldMarkSkibidiCompleted(currentEvent, nextEvent) {
  return nextEvent === null && currentEvent === "skibidi";
}

module.exports = { shouldMarkSkibidiCompleted };
