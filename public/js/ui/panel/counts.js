// Spike counts over the most recent ticks of one fly (specs/006-fly-status-panel/data-model.md). Pure.

export const WINDOW_TICKS = 20;

// Spike count per neuron over the last windowTicks entries of history.
export function windowCounts(history, neuronCount, windowTicks = WINDOW_TICKS) {
  const counts = new Uint32Array(neuronCount);
  for (let i = Math.max(0, history.length - windowTicks); i < history.length; i++) {
    for (const neuron of history[i].spikes) counts[neuron]++;
  }
  return counts;
}

// The number of neurons with at least one spike in the window.
export function activeCount(counts) {
  let active = 0;
  for (let n = 0; n < counts.length; n++) if (counts[n] > 0) active++;
  return active;
}

// L10's region taxonomy, in the fixed display order the region-activity section uses.
export const REGIONS = ['input', 'output', 'al', 'vnc', 'dn', 'central'];

// Per-region activity (ADR 006 L10): the same windowCounts/activeCount computation as the global activeCount
// above, grouped by each neuron's declared region. groups: one region name per neuron (capabilities.groups).
// Returns one entry per region that has at least one neuron, in REGIONS order.
export function regionActivity(counts, groups) {
  const total = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  const active = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  for (let n = 0; n < groups.length; n++) {
    const region = groups[n];
    if (!(region in total)) continue;
    total[region]++;
    if (counts[n] > 0) active[region]++;
  }
  return REGIONS.filter((r) => total[r] > 0)
    .map((region) => ({ region, active: active[region], total: total[region], fraction: active[region] / total[region] }));
}
