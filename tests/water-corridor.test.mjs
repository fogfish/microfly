// A land crossing where the sketch's water divides the map (spec FR-011, SC-003, research.md R6). BUG-002: the water
// is the art pack's reference design (river from the north edge to the south edge, the lakes joined by a chain of
// swamp pools), and its swamp leaves no cell three tiles from water, so the crossing runs between the pools at
// heat ≤ 50% (one tile from water) instead of zero heat. MAX_CROSSING_HEAT records that finding; it is not a
// tuning knob (contracts/world-format-sketch-map.md §7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { heatField } from '../public/js/world/heat-field.js';
import { buildWaterField, cellWater } from '../public/js/world/water.js';

const MAX_CROSSING_HEAT = 0.5;

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const { catalog } = indexCatalog(JSON.parse(read('../public/assets/atlas/catalog.json')));

for (const file of ['world.json', 'world-forager-wide.json']) {
  test(`${file}: a walkable route at heat <= ${MAX_CROSSING_HEAT} exists between the areas the water divides (SC-003, FR-011, BUG-002)`, () => {
    const config = JSON.parse(read(`../public/world/${file}`));
    const logic = buildLogic(config, catalog);
    const { cols, rows } = logic;
    const heat = heatField({ water: logic.water, cols, rows });

    // Crossable: walkable (not blocked), at heat <= MAX_CROSSING_HEAT, and not edge forest —
    // excluding the border band forces the route through the actual gap between the lakes, not a detour
    // around the whole map (which would make this check vacuous for any two interior lakes).
    const crossable = (i) => logic.blocked[i] === 0 && heat.intensity[i] <= MAX_CROSSING_HEAT && logic.forestEdge[i] === 0;

    // West and east sides of the map interior, away from both lakes' x-span, must each have a crossable cell
    // to start from — if either side had none, "a route between the two areas" would be vacuous. The probe
    // columns sit one cell past the deeper of the two edge-forest bands (BUG-001: widened to WORLD-SPEC §7's
    // left/right widths, ~5/~4 cells) so they land just inside the walkable interior on both worlds.
    const west = Array.from({ length: rows }, (_, y) => y * cols + 6).find(crossable);
    const east = Array.from({ length: rows }, (_, y) => y * cols + (cols - 7)).find(crossable);
    assert.ok(west !== undefined, 'no crossable cell on the west side');
    assert.ok(east !== undefined, 'no crossable cell on the east side');

    // 4-connected BFS over crossable cells only (no detour through hotter land).
    const reached = new Uint8Array(cols * rows);
    const queue = [west];
    reached[west] = 1;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      const x = i % cols;
      const y = Math.floor(i / cols);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (!reached[j] && crossable(j)) {
          reached[j] = 1;
          queue.push(j);
        }
      }
    }
    assert.equal(reached[east], 1, `no walkable route at heat <= ${MAX_CROSSING_HEAT} connects the west and east sides`);
  });
}

test('world.json: the sketch map\'s river crosses the north and the south edge (WORLD-SPEC §1.7, BUG-002)', () => {
  const config = JSON.parse(read('../public/world/world.json'));
  const { water, cols, rows } = buildLogic(config, catalog);
  assert.ok(water.slice(0, cols).some((v) => v === 1), 'no water cell on the north edge');
  assert.ok(water.slice((rows - 1) * cols).some((v) => v === 1), 'no water cell on the south edge');
});

test('a river path point outside the grid does not throw and leaves far cells unaffected (BUG-001)', () => {
  const { cols, rows } = { cols: 20, rows: 20 };
  const bodies = [{ id: 'edge-river', outline: { river: { path: [[10, -5], [10, 5], [10, 25]], width: [1, 1] } } }];
  assert.doesNotThrow(() => buildWaterField({ cols, rows, seed: 1, bodies }));
  const field = buildWaterField({ cols, rows, seed: 1, bodies });
  const water = cellWater(field, cols, rows);
  assert.equal(water[0 * cols + 0], 0, 'a far corner cell must stay dry');
});
