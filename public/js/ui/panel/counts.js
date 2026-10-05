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
