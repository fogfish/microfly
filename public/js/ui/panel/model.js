// The FlyStatusModel (specs/006-fly-status-panel/data-model.md): the plain input every section renders
// from. Pure: built from one fly record and a clock reading, so the sections can be tested without a DOM.

import { actionLabel, forageAction } from '../../fly/action.js';
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
    activeCount: counts ? activeCount(counts) : 0,
    // Points drawn: a snapshot brain draws only neurons with a soma (FR-030); the rest are left out and counted.
    coveredCount: record.positions ? record.positions.length / 3 : 0,
    leftOut: record.positions ? neuronCount - record.positions.length / 3 : 0,
    positions: record.positions ?? null,
    drawn: record.drawn ?? null,
    activity: record.activity ?? null,
    brightness: record.activity ? record.activity.brightness(nowMs) : null,
    // A forager entry has one value per declared input; a v0 entry has the single sensory value for every row.
    inputs: record.capabilities.channels.inputs.map((channel, k) => ({
      channel,
      value: !last ? 0 : last.inputs ? last.inputs[k] : last.sensory,
    })),
    outputs: outputs.map((channel, k) => ({
      channel,
      value: last ? last.outputs[k] : 0,
    })),
  };
}
