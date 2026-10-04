// Brain container, version 2 (specs/003-malecns-brain-extractor/contracts/snapshot-format.md).
// Pure: no DOM, no fetch. The browser and Node both parse through parseSnapshot.
// The rules and messages match extract/malecns_brain/container.py.

const MAGIC = 'MFBR';
const FORMAT_VERSION = 2;
const PREFIX = 12;
const ROLES = ['sensory', 'left', 'right'];
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

function reject(message) {
  throw new Error(message);
}

const align4 = (value) => (value + 3) & ~3;
const pad8 = (value) => (value + 7) & ~7;

// Absolute byte offsets and lengths of the four sections, in file order (same as the writer).
export function sectionTable(headerLength, neuronCount, edgeCount) {
  const lengths = {
    offsets: 4 * (neuronCount + 1),
    targets: 4 * edgeCount,
    weights: 4 * edgeCount,
    synapses: 2 * edgeCount,
  };
  const table = {};
  let cursor = PREFIX + headerLength;
  for (const name of ['offsets', 'targets', 'weights', 'synapses']) {
    table[name] = { byteOffset: cursor, byteLength: lengths[name] };
    cursor = align4(cursor + lengths[name]);
  }
  return { table, end: cursor };
}

function checkRoles(neurons, neuronCount) {
  let ok = Array.isArray(neurons) && neurons.length === neuronCount && neuronCount >= 3;
  if (ok) {
    for (let i = 0; i < neurons.length; i++) {
      if (!neurons[i] || neurons[i].index !== i) { ok = false; break; }
    }
  }
  if (ok) ok = ROLES.every((role, i) => neurons[i].role === role);
  if (!ok) reject('snapshot roles out of order: expected sensory, left, right');
}

// Optional per-neuron fields (contracts/snapshot-header-additions.md, rules 8 and 9). Missing or null is allowed.
const isPosition = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isInteger);

function checkPositions(neurons) {
  neurons.forEach((neuron, index) => {
    if (neuron.soma != null && !isPosition(neuron.soma)) {
      reject(`snapshot neuron ${index} has a malformed soma position`);
    }
    if (neuron.superclass != null && typeof neuron.superclass !== 'string') {
      reject(`snapshot neuron ${index} has a malformed superclass`);
    }
  });
}

export function parseSnapshot(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (!LITTLE_ENDIAN) reject('brain snapshots need a little-endian platform');
  if (bytes.length < PREFIX || String.fromCharCode(...bytes.subarray(0, 4)) !== MAGIC) {
    reject('not a brain snapshot');
  }

  const view = new DataView(arrayBuffer);
  const version = view.getUint32(4, true);
  if (version !== FORMAT_VERSION) {
    reject(`unsupported snapshot version ${version}; this build supports ${FORMAT_VERSION}`);
  }

  const headerLength = view.getUint32(8, true);
  if (headerLength % 8 !== 0 || PREFIX + headerLength > bytes.length) {
    reject('snapshot header is truncated');
  }

  let manifest;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(PREFIX, PREFIX + headerLength));
    manifest = JSON.parse(text);
  } catch {
    reject('snapshot header is not valid JSON');
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    reject('snapshot header is not valid JSON');
  }

  const { neuronCount, edgeCount, neurons, sections } = manifest;
  if (!Number.isInteger(neuronCount) || !Number.isInteger(edgeCount)) {
    reject('snapshot roles out of order: expected sensory, left, right');
  }
  checkRoles(neurons, neuronCount);
  checkPositions(neurons);

  const { table, end } = sectionTable(headerLength, neuronCount, edgeCount);
  if (!sections || typeof sections !== 'object') reject('snapshot section sections is out of bounds');
  for (const name of ['offsets', 'targets', 'weights', 'synapses']) {
    const section = sections[name];
    const expected = table[name];
    if (!section || section.byteOffset !== expected.byteOffset || section.byteLength !== expected.byteLength) {
      reject(`snapshot section ${name} is out of bounds`);
    }
    if (expected.byteOffset % 4 !== 0 || expected.byteOffset + expected.byteLength > bytes.length) {
      reject(`snapshot section ${name} is out of bounds`);
    }
  }
  if (bytes.length !== end) reject('snapshot section synapses is out of bounds');

  const offsets = new Uint32Array(arrayBuffer, table.offsets.byteOffset, neuronCount + 1);
  const targets = new Uint32Array(arrayBuffer, table.targets.byteOffset, edgeCount);
  const weights = new Float32Array(arrayBuffer, table.weights.byteOffset, edgeCount);
  const synapses = new Uint16Array(arrayBuffer, table.synapses.byteOffset, edgeCount);

  if (offsets[0] !== 0 || offsets[neuronCount] !== edgeCount) {
    reject('snapshot CSR is inconsistent: offsets must start at 0, not decrease and end at edgeCount');
  }
  for (let i = 0; i < neuronCount; i++) {
    if (offsets[i + 1] < offsets[i]) {
      reject('snapshot CSR is inconsistent: offsets must start at 0, not decrease and end at edgeCount');
    }
  }
  for (let k = 0; k < edgeCount; k++) {
    if (targets[k] >= neuronCount) reject('snapshot CSR is inconsistent: a target is outside neuronCount');
    if (synapses[k] < 1) reject('snapshot CSR is inconsistent: a synapse count is 0');
    if (!Number.isFinite(weights[k])) reject('snapshot CSR is inconsistent: a weight is not finite');
  }

  return { manifest, neuronCount, edgeCount, offsets, targets, weights, synapses };
}

// Size-matched random control (research R9): a toy brain with the snapshot's neuron count and its
// mean out-degree (edges ÷ neurons, rounded, kept between 1 and neuronCount − 1). Shared settings
// (motorSmoothing, telemetry, lif, inhibitoryFraction) come from base, and snapshot is dropped.
export function matchedRandomBrain(header, base = {}) {
  const { snapshot, neuronCount: _n, outDegree: _d, ...shared } = base;
  const n = header.neuronCount;
  const degree = Math.min(Math.max(Math.round(header.edgeCount / n), 1), n - 1);
  return { ...shared, neuronCount: n, outDegree: degree };
}
