// The FlyStatusModel (specs/006-fly-status-panel/data-model.md): the plain input every section renders
// from. Pure: built from one fly record and a clock reading, so the sections can be tested without a DOM.

import { actionLabel, forageAction } from '../../fly/action.js';
import { pairOf } from '../../fly/decoder.js';
import { activeCount, windowCounts } from './counts.js';

// The width of a 0–100% bar for a value in [0, 1], as a CSS percentage (FR-031). Out-of-range values are clamped.
export function barWidth(value) {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

// Action, counts, brightness and channel values of the selected fly at time nowMs.
export function buildStatusModel(record, nowMs) {
  const last = record.history.at(-1) ?? null;
  const neuronCount = record.neuronCount ?? 0;
  const counts = record.activity ? windowCounts(record.history, neuronCount) : null;
  const outputs = record.capabilities.channels.outputs;
  // A forager entry carries named drives and energy (ADR 003 W1–W4); a v0 or tank entry carries left and right.
  const forager = last?.drives !== undefined;
  const action = !last ? null
    : last.eating ? 'Eat'
      : forager ? forageAction(last.drives)
        : actionLabel(last.left, last.right);

  return {
    flyId: record.state.id,
    brainLabel: record.brainLabel,
    action,
    energy: last?.energy ?? null,
    hunger: last?.hunger ?? null,
    eating: last?.eating ?? false,
    // The drives behind the action, for a forager fly (FR-034): why it does or does not stop on food.
    diagnostic: forager
      ? {
        speed: last.speed,
        feed: last.drives.feed ?? 0,
        forward: last.drives.forward ?? 0,
        backward: last.drives.backward ?? 0,
        eating: last.eating,
      }
      : null,
    neuronCount,
    capabilities: record.capabilities,
    // Gated on the derived signal, not on whether the header happens to have the key (panel-provenance-signals.md).
    provenance: record.capabilities.signals?.includes('provenance') ? record.provenance : undefined,
    fidelity: record.capabilities.signals?.includes('fidelity') ? record.fidelity : undefined,
    // D31: the decoded readout (decoder.js's per-tick decode) plus each declared sense's pool size, from the
    // decoder-v1 file itself (contracts/decoder-v1.md) — gated on the 'decoder' signal fly-host.js adds for a
    // v3 fly, same convention as provenance/fidelity above.
    decoded: record.capabilities.signals?.includes('decoder') ? last?.decoded : undefined,
    decoderPools: record.capabilities.signals?.includes('decoder') ? record.decoderFile?.pools : undefined,
    // W17 (ADR 012 R12): read off the fly state body-layer.js maintains, not out of `decoded` (decoded.named
    // is the raw per-tick readout; singing is the integrator's own state, which outlasts a single tick).
    singing: record.capabilities.signals?.includes('decoder') ? Boolean(record.state.singing) : undefined,
    // ADR 011 (Phase 8, contracts/worker-protocol-v3-learning.md): the latest motor.learning, kept by
    // fly-host.js. null (not undefined) when plasticity is off, so the learning section can show "learning
    // off" rather than stale or zero numbers; undefined (section does not mount) for a non-decoder fly.
    learning: record.capabilities.signals?.includes('decoder') ? (record.learning ?? null) : undefined,
    // ADR 011 (contracts/world-config-v3-learning.md "events"): senses this world drives from a world event
    // rather than the connectome, for the "injected" tag.
    injectedSenses: record.injectedSenses ?? [],
    // ADR 012 R9 (contracts/world-config-v3-social.md): "female" reads as "female (male connectome)" — the
    // tag changes only emission, never the brain, so the panel says so rather than letting a reader assume a
    // female-specific brain exists. undefined on a world with no sex tags at all (every pre-social world).
    sexLabel: record.state.sex === 'female' ? 'female (male connectome)'
      : record.state.sex === 'male' ? 'male' : undefined,
    // ADR 012 (contracts/world-config-v3-social.md "Telemetry"): the other fly's id this fly's front-leg
    // contact is currently reading, or null; undefined on a world with no contact:pheromone sense at all.
    contactWith: record.state.contactWith,
    activeCount: counts ? activeCount(counts) : 0,
    // Points drawn: a snapshot brain draws only neurons with a soma (FR-030); the rest are left out and counted.
    coveredCount: record.positions ? record.positions.length / 3 : 0,
    leftOut: record.positions ? neuronCount - record.positions.length / 3 : 0,
    positions: record.positions ?? null,
    drawn: record.drawn ?? null,
    // Per-neuron identity in the same (original) index order as positions/drawn; null for a toy/baseline brain.
    neurons: record.neurons ?? null,
    activity: record.activity ?? null,
    brightness: record.activity ? record.activity.brightness(nowMs) : null,
    // A forager entry has one value per declared input; a v0 entry has the single sensory value for every row.
    // ADR 012 R7: a decoded sense's declared valence is appended to its label (e.g. "Conspecific odour left
    // (none)"), the same information the decoder section already shows per pair, generically for every sense
    // that has one — not special-cased to the two social pairs.
    inputs: record.capabilities.channels.inputs.map((channel, k) => {
      const valence = last?.decoded?.senses?.[pairOf(channel.id)]?.valence;
      return {
        channel: valence === undefined ? channel : { ...channel, label: `${channel.label} (${valence})` },
        value: !last ? 0 : last.inputs ? last.inputs[k] : last.sensory,
      };
    }),
    outputs: outputs.map((channel, k) => ({
      channel,
      value: last ? last.outputs[k] : 0,
    })),
  };
}
