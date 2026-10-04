// Worker protocol, version 1 (contracts/worker-protocol.md). Pure: builders and validators only.
// Host → worker: init, sense, stop. Worker → host: ready, motor, error.

export const PROTOCOL_VERSION = 1;

const TO_WORKER = ['init', 'sense', 'stop'];
const TO_HOST = ['ready', 'motor', 'error'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isTick = (v) => Number.isInteger(v) && v >= 0;

export const init = ({ flyId, seed, brain }) => ({ v: PROTOCOL_VERSION, type: 'init', flyId, seed, brain });
export const sense = ({ tick, sensory }) => ({ v: PROTOCOL_VERSION, type: 'sense', tick, sensory });
export const stop = () => ({ v: PROTOCOL_VERSION, type: 'stop' });

export const ready = ({ flyId, neuronCount }) => ({ v: PROTOCOL_VERSION, type: 'ready', flyId, neuronCount });
export const motor = ({ tick, sensory, left, right, selected }) => ({
  v: PROTOCOL_VERSION, type: 'motor', tick, sensory, left, right, selected,
});
export const error = ({ flyId, tick = null, message }) => ({
  v: PROTOCOL_VERSION, type: 'error', flyId, tick, message,
});

// Buffers to transfer instead of copy. Only motor carries one.
export function transferables(msg) {
  return msg.type === 'motor' ? [msg.selected.buffer] : [];
}

// Returns null when the message is valid, otherwise a short error string.
// direction is 'toWorker' or 'toHost'.
export function validateMessage(msg, direction) {
  if (!isObject(msg)) return 'message must be an object';
  if (msg.v === undefined) return 'missing protocol version "v"';
  if (msg.v !== PROTOCOL_VERSION) return `unsupported protocol version ${msg.v}; this build supports ${PROTOCOL_VERSION}`;

  const allowed = direction === 'toWorker' ? TO_WORKER : TO_HOST;
  if (!allowed.includes(msg.type)) return `unknown message type "${msg.type}" for ${direction}`;

  switch (msg.type) {
    case 'init':
      if (!isObject(msg.brain)) return 'init.brain must be an object';
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
      if (!(msg.selected instanceof Uint8Array)) return 'motor.selected must be a Uint8Array';
      return null;
    default:
      return null;
  }
}
