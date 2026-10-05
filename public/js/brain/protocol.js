// Worker protocol, version 2 (specs/006-fly-status-panel/contracts/worker-protocol-v2.md; amends
// specs/002 worker-protocol). Pure: builders and validators only.
// Host → worker: init, sense, stop. Worker → host: ready, motor, error.

export const PROTOCOL_VERSION = 2;

const TO_WORKER = ['init', 'sense', 'stop'];
const TO_HOST = ['ready', 'motor', 'error'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isTick = (v) => Number.isInteger(v) && v >= 0;

export const init = ({ flyId, seed, brain }) => ({ v: PROTOCOL_VERSION, type: 'init', flyId, seed, brain });
export const sense = ({ tick, sensory }) => ({ v: PROTOCOL_VERSION, type: 'sense', tick, sensory });
export const stop = () => ({ v: PROTOCOL_VERSION, type: 'stop' });

export const ready = ({ flyId, neuronCount, capabilities }) => ({
  v: PROTOCOL_VERSION, type: 'ready', flyId, neuronCount, capabilities,
});
export const motor = ({ tick, sensory, left, right, outputs, spikes }) => ({
  v: PROTOCOL_VERSION, type: 'motor', tick, sensory, left, right, outputs, spikes,
});
export const error = ({ flyId, tick = null, message }) => ({
  v: PROTOCOL_VERSION, type: 'error', flyId, tick, message,
});

// Buffers to transfer instead of copy. Only motor carries them.
export function transferables(msg) {
  return msg.type === 'motor' ? [msg.outputs.buffer, msg.spikes.buffer] : [];
}

// Returns null when the message is valid, otherwise a short error string.
// direction is 'toWorker' or 'toHost'. The content of a motor message is checked by validateMotor,
// which needs the brain's declaration.
export function validateMessage(msg, direction) {
  if (!isObject(msg)) return 'message must be an object';
  if (msg.v === undefined) return 'missing protocol version "v"';
  if (msg.v !== PROTOCOL_VERSION) return `unsupported protocol version ${msg.v}; this build supports ${PROTOCOL_VERSION}`;

  const allowed = direction === 'toWorker' ? TO_WORKER : TO_HOST;
  if (!allowed.includes(msg.type)) return `unknown message type "${msg.type}" for ${direction}`;

  switch (msg.type) {
    case 'init':
      if (!isObject(msg.brain)) return 'init.brain must be an object';
      if (msg.brain.telemetry !== undefined) return 'init.brain.telemetry is removed in protocol 2';
      if (!isTick(msg.seed) || msg.seed > 4294967295) return 'init.seed must be an integer from 0 to 4294967295';
      // A snapshot is a URL on the way in. The worker shell replaces it with the parsed container.
      if (msg.brain.snapshot !== undefined && !(typeof msg.brain.snapshot === 'string' ? msg.brain.snapshot !== '' : isObject(msg.brain.snapshot))) {
        return 'init.brain.snapshot must be a non-empty URL or a parsed snapshot';
      }
      return null;
    case 'sense':
      if (!isTick(msg.tick)) return 'sense.tick must be an integer of 0 or more';
      if (!(Number.isFinite(msg.sensory) && msg.sensory >= 0)) return 'sense.sensory must be a finite number of 0 or more';
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

// Content checks for a motor message, in order (protocol v2, Validation):
//   outputs has one entry per declared output; spikes are ascending and below neuronCount;
//   left and right equal the outputs at the drive positions, after rounding to float32.
// decl: { neuronCount, outputCount, leftIndex, rightIndex }. Returns null or an error string.
export function validateMotor(msg, decl) {
  if (msg.outputs.length !== decl.outputCount) {
    return `motor.outputs must have ${decl.outputCount} entries, one per declared output`;
  }
  const { spikes } = msg;
  for (let i = 0; i < spikes.length; i++) {
    if (spikes[i] >= decl.neuronCount) return `motor.spikes ${spikes[i]} is not below neuronCount ${decl.neuronCount}`;
    if (i > 0 && spikes[i] <= spikes[i - 1]) return 'motor.spikes must be strictly ascending';
  }
  if (Math.fround(msg.left) !== msg.outputs[decl.leftIndex]) {
    return 'motor.left does not match the outputs entry of the left drive';
  }
  if (Math.fround(msg.right) !== msg.outputs[decl.rightIndex]) {
    return 'motor.right does not match the outputs entry of the right drive';
  }
  return null;
}
