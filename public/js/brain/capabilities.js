// Channel and signal declaration (specs/006-fly-status-panel/contracts/snapshot-format-v3.md, rules 11–18).
// Pure: the declarations of the toy and baseline brains, and the validator the snapshot reader and the
// boot check share. extract/malecns_brain/capabilities.py applies the same rules with the same messages.

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const SIDES = ['L', 'R', 'both'];
const DRIVES = ['left', 'right'];
const DECLARATION_FIELDS = ['id', 'label', 'side', 'neuron', 'range', 'drive'];
const INPUT_FIELDS = ['id', 'label', 'side', 'neuron', 'range'];
const LABEL_MAX = 40;
const DEFAULT_RANGE = [0, 1];

// The toy brain: a food-odour input on the sensory neuron, and the two motor outputs that drive the body.
export const TOY_CAPABILITIES = Object.freeze({
  signals: ['spikes'],
  channels: {
    inputs: [{ id: 'food-odour', label: 'Food odour', side: 'both', neuron: 0, range: [0, 1] }],
    outputs: [
      { id: 'left-motor', label: 'Left motor', side: 'L', neuron: 1, range: [0, 1], drive: 'left' },
      { id: 'right-motor', label: 'Right motor', side: 'R', neuron: 2, range: [0, 1], drive: 'right' },
    ],
  },
});

// The baseline fly has no brain: the same two motor outputs, and no signal.
export const BASELINE_CAPABILITIES = Object.freeze({
  signals: [],
  channels: {
    inputs: [],
    outputs: [
      { id: 'left-motor', label: 'Left motor', side: 'L', neuron: 1, range: [0, 1], drive: 'left' },
      { id: 'right-motor', label: 'Right motor', side: 'R', neuron: 2, range: [0, 1], drive: 'right' },
    ],
  },
});

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const nameOf = (ch) => (isObject(ch) ? ch.id : undefined);

// Checks rules 11–18 in rule order and returns [] when valid, or [message] with the first error.
// subject is the leading word of each message: 'snapshot' for a file, 'brain' for a toy override.
export function validateCapabilities(decl, neuronCount, subject = 'snapshot') {
  const fail = (message) => [message];

  // Rule 11: present and an object.
  if (!isObject(decl)) return fail(`${subject} capabilities are missing`);

  // Rule 12: signals are unique strings. Unknown ids are kept (rule 18).
  const { signals, channels } = decl;
  if (!Array.isArray(signals) || !signals.every((s) => typeof s === 'string') || new Set(signals).size !== signals.length) {
    return fail(`${subject} signals are malformed`);
  }
  if (!isObject(channels) || !Array.isArray(channels.inputs) || !Array.isArray(channels.outputs)) {
    return fail(`${subject} channels are malformed`);
  }
  const inputs = channels.inputs;
  const outputs = channels.outputs;
  const everything = [...inputs.map((ch) => ({ ch, kind: 'input' })), ...outputs.map((ch) => ({ ch, kind: 'output' }))];

  // Rule 13: ids match the pattern and are unique across inputs and outputs.
  const seen = new Set();
  for (const { ch } of everything) {
    const id = nameOf(ch);
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return fail(`${subject} channel ${id} has a malformed id`);
    if (seen.has(id)) return fail(`duplicate id ${id}`);
    seen.add(id);
  }

  // Rule 14: label, side, neuron (integer) and range (two finite numbers, min < max; default [0, 1]).
  for (const { ch } of everything) {
    const { id, label, side, neuron } = ch;
    if (!(typeof label === 'string' && [...label].length > 0 && [...label].length <= LABEL_MAX)) {
      return fail(`${subject} channel ${id} is malformed: label`);
    }
    if (!SIDES.includes(side)) return fail(`${subject} channel ${id} is malformed: side`);
    if (!isInt(neuron)) return fail(`${subject} channel ${id} is malformed: neuron`);
    const range = 'range' in ch ? ch.range : DEFAULT_RANGE;
    if (!(Array.isArray(range) && range.length === 2 && range.every(isFiniteNumber) && range[0] < range[1])) {
      return fail(`${subject} channel ${id} is malformed: range`);
    }
  }

  // Rule 15: each input reads neuron 0.
  for (const ch of inputs) {
    if (ch.neuron !== 0) return fail(`${subject} input channel ${ch.id} must read neuron 0`);
  }

  // Rule 16: each output reads a neuron below neuronCount.
  for (const ch of outputs) {
    if (!(ch.neuron >= 0 && ch.neuron < neuronCount)) {
      return fail(`${subject} output channel ${ch.id} references neuron ${ch.neuron} outside neuronCount`);
    }
  }

  // Rule 17: drive is absent, "left" or "right", and the drives are exactly one of each.
  const drives = [];
  for (const ch of outputs) {
    if (!('drive' in ch)) continue;
    if (!DRIVES.includes(ch.drive)) return fail(`${subject} outputs must have exactly one left and one right drive`);
    drives.push(ch.drive);
  }
  if (drives.length !== 2 || !DRIVES.every((d) => drives.includes(d))) {
    return fail(`${subject} outputs must have exactly one left and one right drive`);
  }

  // Rule 18: no fields beyond the declaration (inputs take no drive).
  for (const { ch, kind } of everything) {
    const allowed = kind === 'input' ? INPUT_FIELDS : DECLARATION_FIELDS;
    for (const key of Object.keys(ch)) {
      if (!allowed.includes(key)) return fail(`${subject} channel ${ch.id} has unknown field ${key}`);
    }
  }

  return [];
}
