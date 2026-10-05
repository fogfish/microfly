// Brain container, versions 3 and 4. Pure: no DOM, no fetch. The browser and Node both parse through parseSnapshot.
// Version 3 is specs/006-fly-status-panel/contracts/snapshot-format-v3.md (the small brain). Version 4 is
// specs/008-hungry-forager-brain/contracts/container-v4.md (the forager brain). Both share the section code.
// The rules and messages match extract/malecns_brain/container.py.

import { validateCapabilities, validateCapabilitiesV4 } from './capabilities.js';

const MAGIC = 'MFBR';
const FORMAT_VERSIONS = [3, 4];
const PREFIX = 12;
const ROLES = ['sensory', 'left', 'right'];
const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const SIGNS = [-1, 0, 1];
const WEIGHT_TOLERANCE = 1e-6;
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

// The brain version a world asks for must match the container version of its snapshot (spec FR-003).
// v0 reads version 3, v1 reads version 4. mock has no snapshot, so it is not checked.
export function checkBrainVersion(brainVersion, containerVersion, path = 'snapshot') {
  const expected = { v0: 3, v1: 4 }[brainVersion];
  if (expected === undefined || expected === containerVersion) return;
  reject(`flies.brain.version "${brainVersion}" needs a version ${expected} snapshot; ${path} is version ${containerVersion}`);
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

// Version 4 neuron rules N1, N2 and N4 (container-v4.md). The roles follow the declaration: input pool neurons
// first (in channel order), then output pool neurons, then interneurons.
function checkForagerNeurons(neurons, capabilities, neuronCount) {
  const inputs = capabilities.channels.inputs;
  const outputs = capabilities.channels.outputs;
  const pools = { input: new Map(), output: new Map() };
  for (const ch of inputs) for (const n of ch.neurons) pools.input.set(n, ch.id);
  for (const ch of outputs) for (const n of ch.neurons) pools.output.set(n, ch.id);
  const nIn = inputs.reduce((sum, ch) => sum + ch.neurons.length, 0);
  const nOut = outputs.reduce((sum, ch) => sum + ch.neurons.length, 0);
  const roleAt = (i) => (i < nIn ? 'input' : i < nIn + nOut ? 'output' : 'interneuron');

  if (!Array.isArray(neurons) || neurons.length !== neuronCount) reject('snapshot roles out of order: expected inputs, outputs, then interneurons');
  neurons.forEach((neuron, i) => {
    if (!neuron || neuron.index !== i) reject(`snapshot neuron index ${neuron?.index} is not its position ${i}`);
    if (neuron.role !== roleAt(i)) reject('snapshot roles out of order: expected inputs, outputs, then interneurons');
    const pool = neuron.role === 'input' ? pools.input : neuron.role === 'output' ? pools.output : null;
    if (pool ? pool.get(i) !== neuron.channel : neuron.channel !== null) {
      reject(`snapshot neuron ${i} is not in channel ${neuron.channel}`);
    }
    if (!SIGNS.includes(neuron.sign)) reject(`snapshot neuron ${i} has sign ${neuron.sign}; expected -1, 0 or 1`);
    if (neuron.sign === 0 && neuron.role !== 'output') reject(`snapshot neuron ${i} has sign 0 but is not an output`);
  });
  checkPositions(neurons);
}

// Version 4 modulator rules M1–M3 (container-v4.md).
function checkModulators(modulators, inputIds) {
  if (!Array.isArray(modulators)) reject('snapshot modulators are malformed');
  const earlier = new Set();
  for (const mod of modulators) {
    const id = mod?.id;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) reject(`snapshot modulator ${id} has a malformed id`);
    if (!(typeof mod.label === 'string' && [...mod.label].length > 0 && [...mod.label].length <= 40)) {
      reject(`snapshot modulator ${id} has a malformed label`);
    }
    if (!Array.isArray(mod.targets) || mod.targets.length === 0) reject(`snapshot modulator ${id} has no targets`);
    for (const target of mod.targets) {
      if (!inputIds.has(target)) reject(`snapshot modulator ${id} targets an undeclared input ${target}`);
    }
    const gainOk = Array.isArray(mod.gain) && mod.gain.length === 2 && mod.gain.every((g) => Number.isFinite(g) && g >= 0);
    if (!gainOk) reject(`snapshot modulator ${id} has a gain that is not two numbers of 0 or more`);
    const fromRange = mod.range !== undefined;
    const fromSource = mod.source !== undefined;
    if (fromRange === fromSource) reject(`snapshot modulator ${id} needs either range or source`);
    if (fromRange && !(Array.isArray(mod.range) && mod.range[0] === 0 && mod.range[1] === 1)) {
      reject(`snapshot modulator ${id} has a range that is not [0, 1]`);
    }
    if (fromSource && !earlier.has(mod.source)) reject(`snapshot modulator ${id} has source ${mod.source} that is not an earlier modulator`);
    earlier.add(id);
  }
}

// Version 4 header rules: kind, weight rule, synapse cap, roles, the forager declaration and modulators.
function checkForager(manifest, neuronCount) {
  if (manifest.kind !== 'forager') reject(`snapshot kind "${manifest.kind}" is not supported`);
  if (manifest.weightRule !== 'postFraction') reject(`snapshot weight rule "${manifest.weightRule}" is not supported`);
  if (!(Number.isInteger(manifest.synapseCap) && manifest.synapseCap >= 1 && manifest.synapseCap <= 65535)) {
    reject('snapshot synapseCap must be an integer from 1 to 65535');
  }
  const [capabilityError] = validateCapabilitiesV4(manifest.capabilities, neuronCount, 'forager');
  if (capabilityError) reject(capabilityError);
  checkForagerNeurons(manifest.neurons, manifest.capabilities, neuronCount);
  const inputIds = new Set(manifest.capabilities.channels.inputs.map((ch) => ch.id));
  checkModulators(manifest.modulators, inputIds);
}

export function parseSnapshot(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (!LITTLE_ENDIAN) reject('brain snapshots need a little-endian platform');
  if (bytes.length < PREFIX || String.fromCharCode(...bytes.subarray(0, 4)) !== MAGIC) {
    reject('not a brain snapshot');
  }

  const view = new DataView(arrayBuffer);
  const version = view.getUint32(4, true);
  if (!FORMAT_VERSIONS.includes(version)) {
    reject(`unsupported snapshot version ${version}; this build supports ${FORMAT_VERSIONS.join(' and ')}`);
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
  if (version === 3) {
    checkRoles(neurons, neuronCount);
    checkPositions(neurons);
    const [capabilityError] = validateCapabilities(manifest.capabilities, neuronCount);
    if (capabilityError) reject(capabilityError);
  } else {
    checkForager(manifest, neuronCount);
  }

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
  // Version 4 weights are postFraction (ADR 003 D4): the absolute input weights of a neuron sum to at most 1.
  if (version === 4) {
    const inflow = new Float64Array(neuronCount);
    for (let k = 0; k < edgeCount; k++) inflow[targets[k]] += Math.abs(weights[k]);
    if (inflow.some((sum) => sum > 1 + WEIGHT_TOLERANCE)) {
      reject('snapshot CSR is inconsistent: input weights into a neuron exceed 1 in absolute sum');
    }
  }

  return version === 3
    ? {
      version, kind: null, modulators: [], manifest, neuronCount, edgeCount, offsets, targets, weights, synapses,
      capabilities: manifest.capabilities,
    }
    : {
      version, kind: manifest.kind, modulators: manifest.modulators, manifest, neuronCount, edgeCount,
      offsets, targets, weights, synapses, capabilities: manifest.capabilities,
    };
}

// Size-matched random control (research R9): a toy brain with the snapshot's neuron count and its
// mean out-degree (edges ÷ neurons, rounded, kept between 1 and neuronCount − 1). Shared settings
// (motorSmoothing, lif, inhibitoryFraction) come from base, and snapshot is dropped.
export function matchedRandomBrain(header, base = {}) {
  const { snapshot, neuronCount: _n, outDegree: _d, ...shared } = base;
  const n = header.neuronCount;
  const degree = Math.min(Math.max(Math.round(header.edgeCount / n), 1), n - 1);
  return { ...shared, neuronCount: n, outDegree: degree };
}
