// Energy, hunger and eating bouts (ADR 003 W1–W2; contracts/world-config-forager.md). Pure: no DOM.
// The body loses metabolism × dt each tick, gains intake × dt while eating, and its hunger is 1 − energy.
// A bout is a run of consecutive eating ticks on one flower. It ends on the first tick without eating, and records why.

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function metabolise(energy, dt, metabolism) {
  return clamp01(energy - metabolism * dt);
}

export function eat(energy, dt, intake) {
  return clamp01(energy + intake * dt);
}

// W2: a fly eats only on a flower (stock > 0), when it is slow enough and its feed output is above threshold.
export function canEat({ stock, speed, feed }, cfg) {
  return stock > 0 && speed < cfg.eatSpeed && feed > cfg.feedThreshold;
}

export function hunger(energy) {
  return 1 - energy;
}

// A bout opens on the first eating tick. ticks counts eating ticks.
export function startBout(cell) {
  return { cell, ticks: 0 };
}

export function updateBout(bout) {
  return { ...bout, ticks: bout.ticks + 1 };
}

// Closes a bout and says how it ended: 'empty' when the flower is empty; 'sated' when energy has reached food.sated and
// the feed output is at or below threshold; 'walked' otherwise (the fly left before the flower was empty).
export function closeBout(bout, { stock, energy, feed }, cfg) {
  let endedBy = 'walked';
  if (stock <= 0) endedBy = 'empty';
  else if (energy >= cfg.sated && feed <= cfg.feedThreshold) endedBy = 'sated';
  return { cell: bout.cell, ticks: bout.ticks, endedBy };
}
