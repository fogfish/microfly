// Flower stock (ADR 003 W2; contracts/world-config-forager.md, flies.food). Pure: no DOM.
// Each stimulus cell (a flower) holds a stock in [0, full]. Eating lowers it. A flower that is not being eaten
// regrows toward full. An empty flower gives no taste and no odour (its fraction is 0).

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// world: from buildWorld (stimulusCells). config: the resolved flies section (food.stock, food.regrowth).
export function createFood(world, config) {
  const full = config.food.stock;
  const { regrowth } = config.food;
  const stock = new Map([...world.stimulusCells.keys()].map((idx) => [idx, full]));
  const indexOf = (cx, cy) => cy * world.width + cx;

  return {
    full,
    stockAt(cx, cy) {
      return stock.get(indexOf(cx, cy)) ?? 0;
    },
    // The stock over the full stock, in [0, 1]. Zero for a cell that is not a flower.
    fraction(cx, cy) {
      return (stock.get(indexOf(cx, cy)) ?? 0) / full;
    },
    // Lowers the stock of a flower by amount, never below 0.
    consume(cx, cy, amount) {
      const idx = indexOf(cx, cy);
      if (!stock.has(idx)) return;
      stock.set(idx, clamp(stock.get(idx) - amount, 0, full));
    },
    // Raises every flower by regrowth × seconds, up to full. The flower in exceptCell is not raised (it is being eaten).
    regrow(seconds, exceptCell = null) {
      for (const [idx, value] of stock) {
        if (idx === exceptCell) continue;
        stock.set(idx, clamp(value + regrowth * seconds, 0, full));
      }
    },
    // The stimulus points for the odour sampler: cell centres in tiles, with their stock fraction.
    points() {
      return [...stock].map(([idx, value]) => ({
        x: (idx % world.width) + 0.5,
        y: Math.floor(idx / world.width) + 0.5,
        fraction: value / full,
      }));
    },
    // Cell index of a tile, for the eating cell of the bout and regrowth.
    cellOf: (cx, cy) => indexOf(cx, cy),
  };
}
