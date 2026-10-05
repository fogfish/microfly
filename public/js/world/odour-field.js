// The odour field for the odour layer (specs/007-odor-layer/contracts/odour-layer.md §3). Pure: no DOM.
//
// The field is sampled at scene-pixel centres with the same falloff the flies sense (fly/stimulus.js),
// so the layer shows exactly what a fly at that point would receive (FR-004). Flowers never move, so the
// field is built once and never changes during a run.

import { falloff } from '../fly/stimulus.js';

// points: [{x, y}] in cells. stimulus: { radius, gain, max } from flies.stimulus.
// Returns { width, height, samplesPerCell, values } where values[k] is the intensity in [0, 1].
export function odourField({ points, stimulus, cols, rows, samplesPerCell }) {
  const width = cols * samplesPerCell;
  const height = rows * samplesPerCell;
  const values = new Float32Array(width * height);
  const { radius, gain, max } = stimulus;
  if (!(max > 0) || !(radius > 0) || points.length === 0) {
    return { width, height, samplesPerCell, values };
  }

  // Sample (i, j) sits at ((i + 0.5) / n, (j + 0.5) / n) in cells. Each point visits only its bounding box.
  const n = samplesPerCell;
  for (const p of points) {
    const i0 = Math.max(0, Math.floor((p.x - radius) * n));
    const i1 = Math.min(width - 1, Math.ceil((p.x + radius) * n));
    const j0 = Math.max(0, Math.floor((p.y - radius) * n));
    const j1 = Math.min(height - 1, Math.ceil((p.y + radius) * n));
    for (let j = j0; j <= j1; j++) {
      const dy = p.y - (j + 0.5) / n;
      for (let i = i0; i <= i1; i++) {
        values[j * width + i] += falloff(Math.hypot(p.x - (i + 0.5) / n, dy), radius);
      }
    }
  }

  for (let k = 0; k < values.length; k++) {
    values[k] = Math.min(1, (gain * values[k]) / max);
  }
  return { width, height, samplesPerCell, values };
}
