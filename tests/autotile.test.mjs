import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openMask, pickEdge, EDGE_BITS, FALLBACK } from '../public/js/world/autotile.js';
import { generateTerrain } from '../public/js/world/generate.js';

const shipped = JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));

// Sprite ids stand in for real tiles here, one per edge key
const group = {
  fill: 'fill',
  edges: Object.fromEntries(Object.keys(EDGE_BITS).map((k) => [k, `edge-${k}`])),
};

test('openMask: a cell surrounded by its own terrain has no open sides', () => {
  const grid = new Uint16Array(9).fill(1);
  assert.equal(openMask(grid, 3, 3, 1, 1), 0);
});

test('openMask: a different neighbour opens exactly that side', () => {
  // 3×3, centre is 1, north neighbour is 0
  const grid = new Uint16Array([0, 0, 0, 1, 1, 1, 1, 1, 1]);
  assert.equal(openMask(grid, 3, 3, 1, 1), 1); // N
  // East neighbour differs
  const grid2 = new Uint16Array([1, 1, 1, 1, 1, 0, 1, 1, 1]);
  assert.equal(openMask(grid2, 3, 3, 1, 1), 2); // E
});

test('openMask: outside the world is not open', () => {
  const grid = new Uint16Array(4).fill(1);
  assert.equal(openMask(grid, 2, 2, 0, 0), 0);
});

test('pickEdge: mask 0 gives the fill, every supported mask gives its own edge', () => {
  assert.equal(pickEdge(group, 0), 'fill');
  for (const [key, bits] of Object.entries(EDGE_BITS)) {
    assert.equal(pickEdge(group, bits), `edge-${key}`, key);
  }
});

test('pickEdge: unsupported masks fall back to a supported mask with fewer open sides', () => {
  for (const [mask, fallback] of Object.entries(FALLBACK)) {
    assert.equal((fallback & ~Number(mask)), 0, `fallback ${fallback} must be a subset of ${mask}`);
    assert.ok(Object.values(EDGE_BITS).includes(fallback));
  }
});

test('pickEdge: a group without an edge for the mask uses its fill', () => {
  const partial = { fill: 'fill', edges: { N: 'edge-N' } };
  assert.equal(pickEdge(partial, 2), 'fill'); // E is not in the group
});

test('no edge is transparent towards a neighbour of the same group (shipped rock group)', () => {
  // Transparent sides of the chosen edge must face a different terrain.
  // With the fallbacks, the chosen tile's open sides are a subset of the real open sides.
  const c = shipped;
  const grid = generateTerrain(c);
  const { width, height } = c.world;
  const rockIdx = c.terrain.findIndex((t) => t.id === 'rock');
  const rockGroup = { fill: c.groups.rock.fill, edges: c.groups.rock.edges };
  let checked = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y * width + x] !== rockIdx) continue;
      const mask = openMask(grid, width, height, x, y);
      const key = Object.entries(EDGE_BITS).find(([, bits]) => bits === (FALLBACK[mask] ?? mask));
      const sprite = pickEdge(rockGroup, mask);
      const chosenBits = key && rockGroup.edges[key[0]] === sprite ? EDGE_BITS[key[0]] : 0;
      assert.equal(chosenBits & ~mask, 0, `rock cell ${x},${y} is transparent towards its own group`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'the shipped world has rock cells to check');
});

test('the same grid gives the same edge for every cell on two runs', () => {
  const c = shipped;
  const grid = generateTerrain(c);
  const pick = () => {
    const out = [];
    for (let y = 0; y < c.world.height; y++) {
      for (let x = 0; x < c.world.width; x++) {
        out.push(pickEdge(group, openMask(grid, c.world.width, c.world.height, x, y)));
      }
    }
    return out.join('|');
  };
  assert.equal(pick(), pick());
});
