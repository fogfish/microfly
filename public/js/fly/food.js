// Flower stock (ADR 003 W2; contracts/world-config-forager.md, flies.food). Pure: no DOM.
// Each stimulus cell (a flower) holds a stock in [0, full]. Eating lowers it. A flower that is not being eaten
// regrows toward full. An empty flower gives no taste and no odour (its fraction is 0).
// Capacity model (spec 018, contracts/world-config-food-feeding.md, data-model.md): when flies.food.capacity is set,
// a flower starts with its kind's capacity (small 1, medium 2, large 3 units). Eating drains it continuously, by the
// same consumeRate × dt as the legacy model, and it does not regrow while partly eaten. Once it reaches 0 it stays
// empty for flies.food.recovery seconds, then returns to full. Selected once per world, never mixed on one cell.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// world: from buildWorld (stimulusCells). config: the resolved flies section (food.stock, food.regrowth, and the
// optional food.capacity / food.recovery of the capacity model). sharers: how many flies call regrow() on this table
// each tick. Every fly calls regrow once per tick, so each call advances the flowers by 1/sharers of a tick; without
// it, regrowth and recovery run sharers times too fast (6 flies: a 30 s recovery took 5 s). Default 1: one caller.
export function createFood(world, config, { sharers = 1 } = {}) {
  const full = config.food.stock;
  const { regrowth } = config.food;
  const { capacity: capacityOf } = config.food;
  const capacityModel = capacityOf !== undefined;
  // Legacy continuous model: one stock per flower. Empty in a capacity-model world.
  const stock = new Map(capacityModel ? [] : [...world.stimulusCells.keys()].map((idx) => [idx, full]));
  // Capacity model: one record per flower. recoveryLeft is the seconds left until an empty flower is full, or null.
  const units = new Map(capacityModel ? [...world.stimulusCells].map(([idx, { kind }]) => [idx, {
    capacity: capacityOf[kind], remaining: capacityOf[kind], recoveryLeft: null,
  }]) : []);
  const indexOf = (cx, cy) => cy * world.width + cx;
  // The flower's level in [0, 1]: remaining over capacity, or stock over full. Zero for a cell that is not a flower.
  const levelOf = (idx) => {
    if (!capacityModel) return (stock.get(idx) ?? 0) / full;
    const u = units.get(idx);
    return u ? u.remaining / u.capacity : 0;
  };
  // Bumped on every change to any flower's level, so the odour overlay (main.js) repaints only when the field moved.
  let version = 0;

  return {
    full,
    // A counter that moves whenever a flower's level changes. Read it, never write it.
    get version() {
      return version;
    },
    // The flower's stock as the eating rule reads it: remaining units in the capacity model, else the continuous stock.
    stockAt(cx, cy) {
      const idx = indexOf(cx, cy);
      return capacityModel ? (units.get(idx)?.remaining ?? 0) : (stock.get(idx) ?? 0);
    },
    // The stock over the full stock, in [0, 1]. Zero for a cell that is not a flower.
    fraction(cx, cy) {
      return levelOf(indexOf(cx, cy));
    },
    // Lowers the stock of a flower by amount, never below 0. A capacity-model flower that reaches 0 starts its
    // recovery countdown (flies.food.recovery, default 30 s).
    consume(cx, cy, amount) {
      const idx = indexOf(cx, cy);
      if (capacityModel) {
        const u = units.get(idx);
        if (!u || u.remaining === 0) return;
        u.remaining = clamp(u.remaining - amount, 0, u.capacity);
        if (u.remaining === 0) u.recoveryLeft = config.food.recovery ?? 30;
        version++;
        return;
      }
      if (!stock.has(idx)) return;
      stock.set(idx, clamp(stock.get(idx) - amount, 0, full));
      version++;
    },
    // Raises every flower by regrowth × seconds, up to full. The flower in exceptCell is not raised (it is being eaten).
    // Capacity-model flowers do not regrow while partly eaten: their recovery countdown advances, and at zero they are
    // full again.
    regrow(seconds, exceptCell = null) {
      const share = seconds / sharers;
      for (const [idx, value] of stock) {
        if (idx === exceptCell) continue;
        const next = clamp(value + regrowth * share, 0, full);
        if (next !== value) version++;
        stock.set(idx, next);
      }
      for (const u of units.values()) {
        if (u.recoveryLeft === null) continue;
        u.recoveryLeft -= share;
        // 1 ns of slack: summing dt/sharers over many calls drifts by float rounding, which must not add a tick.
        if (u.recoveryLeft <= 1e-9) {
          u.remaining = u.capacity;
          u.recoveryLeft = null;
          version++;
        }
      }
    },
    // The stimulus points for the odour sampler: cell centres in tiles, with their reach and stock fraction.
    points() {
      return [...world.stimulusCells.keys()].map((idx) => ({
        x: (idx % world.width) + 0.5,
        y: Math.floor(idx / world.width) + 0.5,
        reach: world.stimulusCells.get(idx)?.reach,
        fraction: levelOf(idx),
      }));
    },
    // Cell index of a tile, for the eating cell of the bout and regrowth.
    cellOf: (cx, cy) => indexOf(cx, cy),
  };
}
