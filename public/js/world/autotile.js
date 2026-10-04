// Tile groups (autotile) for terrain edges. Pure: no DOM, no canvas.
//
// A group is drawn as an overlay on the opaque base terrain. Each edge tile
// has transparent pixels on the sides where a neighbour is NOT in the group,
// so the base shows through there. The edge tile is picked from the cell's
// neighbours, so a tile from a group is only used where its open sides face
// other terrain.
//
// Mask bits: N = 1, E = 2, S = 4, W = 8. A bit is set when that neighbour has a
// different terrain (an "open" side).

const BIT = { N: 1, E: 2, S: 4, W: 8 };

// Edge keys used in world.json `groups[terrain].edges`
export const EDGE_BITS = { N: 1, E: 2, S: 4, W: 8, NE: 3, NW: 9, SE: 6, SW: 12, NS: 5, EW: 10, NESW: 15 };
const KEY_BY_MASK = Object.fromEntries(Object.entries(EDGE_BITS).map(([key, bits]) => [bits, key]));

// Masks with no tile of their own in the rock set. Each maps to the closest
// supported mask with fewer open sides, so the tile never shows transparency
// on a side that faces the same group.
export const FALLBACK = { 7: 5, 11: 10, 13: 9, 14: 10 };

// Open-side mask of cell (x, y). Outside the world counts as not open.
export function openMask(grid, width, height, x, y) {
  const terrain = grid[y * width + x];
  let mask = 0;
  const check = (dx, dy, bit) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
    if (grid[ny * width + nx] !== terrain) mask |= bit;
  };
  check(0, -1, BIT.N);
  check(1, 0, BIT.E);
  check(0, 1, BIT.S);
  check(-1, 0, BIT.W);
  return mask;
}

// Sprite id for a group and an open-side mask. Falls back to the fill sprite.
export function pickEdge(group, mask) {
  if (mask === 0) return group.fill;
  const bits = FALLBACK[mask] ?? mask;
  const key = KEY_BY_MASK[bits];
  return (key && group.edges?.[key]) || group.fill;
}
