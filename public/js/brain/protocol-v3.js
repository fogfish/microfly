// Worker protocol, version 3 (contracts/worker-protocol-v3.md; amends worker-protocol-v2). Pure: builders and
// validators only. Used by v1 (forager) flies. protocol.js (version 2) stays for mock and v0 flies.
// Host → worker: init, sense, stop. Worker → host: ready, motor, error.

export const PROTOCOL_VERSION_V3 = 3;

const TO_WORKER = ['init', 'sense', 'stop'];
const TO_HOST = ['ready', 'motor', 'error'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isTick = (v) => Number.isInteger(v) && v >= 0;

export const init = ({ flyId, seed, brain }) => ({ v: PROTOCOL_VERSION_V3, type: 'init', flyId, seed, brain });
export const sense = ({ tick, inputs, state }) => ({ v: PROTOCOL_VERSION_V3, type: 'sense', tick, inputs, state });
export const stop = () => ({ v: PROTOCOL_VERSION_V3, type: 'stop' });

export const ready = ({ flyId, neuronCount, capabilities }) => ({
  v: PROTOCOL_VERSION_V3, type: 'ready', flyId, neuronCount, capabilities,
});
// inputs is echoed for the panel. It is a copy, so the sense message's array is not detached.
export const motor = ({ tick, inputs, outputs, spikes }) => ({
  v: PROTOCOL_VERSION_V3, type: 'motor', tick, inputs: inputs.slice(), outputs, spikes,
});
export const error = ({ flyId, tick = null, message }) => ({
  v: PROTOCOL_VERSION_V3, type: 'error', flyId, tick, message,
});

// Buffers to transfer instead of copy. Only motor carries them, and inputs are copied (see motor).
export function transferables(msg) {
  return msg.type === 'motor' ? [msg.outputs.buffer, msg.spikes.buffer] : [];
}

// Returns null when the message is valid, otherwise a short error string.
// direction is 'toWorker' or 'toHost'. The content of sense and motor is checked by validateSenseV3 and
// validateMotorV3, which need the brain's declaration.
export function validateMessage(msg, direction) {
  if (!isObject(msg)) return 'message must be an object';
  if (msg.v === undefined) return 'missing protocol version "v"';
  if (msg.v !== PROTOCOL_VERSION_V3) {
    return `unsupported protocol version ${msg.v}; this build supports ${PROTOCOL_VERSION_V3} here`;
  }

  const allowed = direction === 'toWorker' ? TO_WORKER : TO_HOST;
  if (!allowed.includes(msg.type)) return `unknown message type "${msg.type}" for ${direction}`;

  switch (msg.type) {
    case 'init':
      if (!isObject(msg.brain)) return 'init.brain must be an object';
      if (!(Number.isInteger(msg.seed) && msg.seed >= 0 && msg.seed <= 4294967295)) {
        return 'init.seed must be an integer from 0 to 4294967295';
      }
      return null;
    case 'sense':
      if (!isTick(msg.tick)) return 'sense.tick must be an integer of 0 or more';
      if (!(msg.inputs instanceof Float32Array)) return 'sense.inputs must be a Float32Array';
      if (!(isObject(msg.state) && Number.isFinite(msg.state.hunger) && msg.state.hunger >= 0 && msg.state.hunger <= 1)) {
        return 'sense.state.hunger must be a finite number from 0 to 1';
      }
      return null;
    case 'motor':
      if (!isTick(msg.tick)) return 'motor.tick must be an integer of 0 or more';
      if (!(msg.outputs instanceof Float32Array)) return 'motor.outputs must be a Float32Array';
      if (!(msg.spikes instanceof Uint32Array)) return 'motor.spikes must be a Uint32Array';
      return null;
    default:
      return null;
  }
}

// Content check for a sense message: one input value per declared input (decl.inputCount).
export function validateSenseV3(msg, decl) {
  if (msg.inputs.length !== decl.inputCount) {
    return `sense.inputs must have ${decl.inputCount} entries, one per declared input`;
  }
  return null;
}

// Content check for a motor message, in order: outputs has one entry per declared output; spikes are ascending
// and below neuronCount; a forager brain sends no left or right fields (they are drives by name, not positions).
// decl: { neuronCount, outputCount }. Returns null or an error string.
export function validateMotorV3(msg, decl) {
  for (const key of ['left', 'right']) {
    if (key in msg) return `motor.${key} is not part of protocol 3 forager messages`;
  }
  if (msg.outputs.length !== decl.outputCount) {
    return `motor.outputs must have ${decl.outputCount} entries, one per declared output`;
  }
  const { spikes } = msg;
  for (let i = 0; i < spikes.length; i++) {
    if (spikes[i] >= decl.neuronCount) return `motor.spikes ${spikes[i]} is not below neuronCount ${decl.neuronCount}`;
    if (i > 0 && spikes[i] <= spikes[i - 1]) return 'motor.spikes must be strictly ascending';
  }
  return null;
}
