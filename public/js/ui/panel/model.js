// The FlyStatusModel (specs/006-fly-status-panel/data-model.md): the plain input every section renders
// from. Pure: built from one fly record and a clock reading, so the sections can be tested without a DOM.

import { actionLabel } from '../../fly/action.js';
import { activeCount, windowCounts } from './counts.js';

// Action, counts, brightness and channel values of the selected fly at time nowMs.
export function buildStatusModel(record, nowMs) {
  const last = record.history.at(-1) ?? null;
  const neuronCount = record.neuronCount ?? 0;
  const counts = record.activity ? windowCounts(record.history, neuronCount) : null;
  const outputs = record.capabilities.channels.outputs;

  return {
    flyId: record.state.id,
    brainLabel: record.brainLabel,
    action: last ? actionLabel(last.left, last.right) : null,
    neuronCount,
    capabilities: record.capabilities,
    activeCount: counts ? activeCount(counts) : 0,
    coveredCount: record.positions ? record.positions.length / 3 : 0,
    positions: record.positions ?? null,
    activity: record.activity ?? null,
    brightness: record.activity ? record.activity.brightness(nowMs) : null,
    inputs: record.capabilities.channels.inputs.map((channel) => ({
      channel,
      value: last ? last.sensory : 0,
    })),
    outputs: outputs.map((channel, k) => ({
      channel,
      value: last ? last.outputs[k] : 0,
    })),
  };
}
