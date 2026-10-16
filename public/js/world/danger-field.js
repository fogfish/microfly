// Danger odour field: a tile-step distance ring from the edge forest (contracts/world-format-sketch-map.md §3,
// research.md R2). Pure: no DOM. Only the edge forest casts danger odour (spec FR-008) — forestEdge is already
// the mask of edge-forest cells only (interior tree placements are not part of it, by construction, research R5).

// 8-connected multi-source BFS tile-step distance from every true cell of mask, capped at 3 ("3 or more steps").
// Shared with heat-field.js, whose ring shape is identical (only the source mask differs).
export function stepDistance(mask, cols, rows) {
  const count = cols * rows;
  const distance = new Uint8Array(count).fill(3);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;
  const seen = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (mask[i]) {
      distance[i] = 0;
      seen[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = distance[i];
    if (d >= 3) continue;
    const x = i % cols;
    const y = (i / cols) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= rows) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= cols) continue;
        const j = ny * cols + nx;
        if (seen[j]) continue;
        seen[j] = 1;
        distance[j] = d + 1;
        queue[tail++] = j;
      }
    }
  }
  return distance;
}

export const RING_INTENSITY = [1, 0.5, 0.25, 0];

// forestEdge: Uint8Array(cols × rows), 1 where the cell is edge forest (world/layout.js buildLogic).
// Returns { cols, rows, distance: Uint8Array, intensity: Float32Array }.
export function dangerField({ forestEdge, cols, rows }) {
  const distance = stepDistance(forestEdge, cols, rows);
  const intensity = new Float32Array(distance.length);
  for (let i = 0; i < distance.length; i++) intensity[i] = RING_INTENSITY[distance[i]];
  return { cols, rows, distance, intensity };
}
