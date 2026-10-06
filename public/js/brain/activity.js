// Fade envelope per neuron, driven by the wall-clock time since its last spike
// (specs/006-fly-status-panel/data-model.md, ActivityState; research R2). Pure: no DOM, no clock of its own.

export const ACTIVITY_DEFAULTS = Object.freeze({
  base: 0.05,
  riseMs: 120,
  fallMs: 2000,
  holdMs: 2000,
});

// Brightness at tMs after a spike: a short rise, then an exponential fall back to base.
// A neuron that never spiked has tMs = Infinity and stays at base.
export function envelope(tMs, { base = ACTIVITY_DEFAULTS.base, riseMs = ACTIVITY_DEFAULTS.riseMs, fallMs = ACTIVITY_DEFAULTS.fallMs, holdMs = ACTIVITY_DEFAULTS.holdMs, } = {}) {
  if (tMs === Infinity) return base;
  const t = Math.max(0, tMs);

  // Exponential fade
  //return base + (1 - base) * Math.min(1, t / riseMs) * Math.exp(-t / fallMs);

  // EaseIn
  const fall = t <= holdMs ? 1 : Math.exp(-(t - holdMs) / fallMs);
  return base + (1 - base) * Math.min(1, t / riseMs) * fall;
}

// Per-neuron spike times for one fly. recordTick is called once per accepted tick.
export function createActivity(neuronCount, options = {}) {
  const params = { ...ACTIVITY_DEFAULTS, ...options };
  const fadeWindowMs = 4 * params.fallMs;
  const lastSpikeAt = new Float64Array(neuronCount).fill(-Infinity);

  return {
    lastSpikeAt,

    recordTick(spikes, nowMs) {
      for (let k = 0; k < spikes.length; k++) lastSpikeAt[spikes[k]] = nowMs;
    },

    // Brightness of every neuron at nowMs. Pass out to reuse a buffer across frames.
    brightness(nowMs, out = new Float32Array(neuronCount)) {
      for (let n = 0; n < neuronCount; n++) out[n] = envelope(nowMs - lastSpikeAt[n], params);
      return out;
    },

    // True while some neuron spiked recently enough to still be visibly above base.
    isFading(nowMs) {
      for (let n = 0; n < neuronCount; n++) {
        if (nowMs - lastSpikeAt[n] < fadeWindowMs) return true;
      }
      return false;
    },
  };
}
