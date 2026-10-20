// learning-v1 reader and group resolver (contracts/learning-v1.md, ADR 011). Pure: no DOM, no worker code. Used
// by the worker (worker-core.js, protocol-v3.js) and by Node scripts (mb-*-probe.mjs). Applies only to
// flies.brain.version: "v3".

const ROLES = ['approach', 'avoid'];

// Fetches and parses the learning-v1 sidecar named by flies.brain.learning. path: as given in world config,
// resolved against root exactly like flies.brain.snapshot/decoder. snapshot: { sha256 } of the already-loaded
// .brain file.
export async function loadLearning(path, root, snapshot) {
  const url = new URL(path, root);
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw new Error(`learning ${path} could not be loaded (network error: ${e.message})`);
  }
  if (!response.ok) throw new Error(`learning ${path} could not be loaded (HTTP ${response.status})`);
  let file;
  try {
    file = await response.json();
  } catch (e) {
    throw new Error(`learning ${path} is not valid JSON: ${e.message}`);
  }
  return parseLearning(file, path, snapshot);
}

// Pure: validates an already-parsed learning-v1 object against the reader rules, in order
// (contracts/learning-v1.md "Reader rules", codes E-LEARN-FORMAT/E-LEARN-SNAPSHOT/E-LEARN-ROLE/E-LEARN-CITE).
// Throws naming the file path and the group or type. Returns the file unchanged, for resolveLearningGroups.
export function parseLearning(file, path, snapshot) {
  if (file.format !== 'learning' || file.version !== 1) {
    throw new Error(`E-LEARN-FORMAT: ${path} must have format "learning" and version 1`);
  }
  if (file.snapshot?.sha256 !== snapshot.sha256) {
    throw new Error(
      `E-LEARN-SNAPSHOT: ${path} was built for a different snapshot (expected ${snapshot.sha256}, got ${file.snapshot?.sha256})`,
    );
  }
  const seenTypes = new Set();
  for (const entry of file.mbon ?? []) {
    if (!ROLES.includes(entry.role)) {
      throw new Error(`E-LEARN-ROLE: ${path} mbon "${entry.type}" has an invalid role "${entry.role}"`);
    }
    if (seenTypes.has(entry.type)) {
      throw new Error(`E-LEARN-ROLE: ${path} repeats mbon type "${entry.type}"`);
    }
    seenTypes.add(entry.type);
    if (typeof entry.cite !== 'string' || entry.cite.length === 0) {
      throw new Error(`E-LEARN-CITE: ${path} mbon "${entry.type}" has no citation`);
    }
  }
  return file;
}

// A group selector matches the manifest's class and (if declared) type, by exact membership (`types`) or by
// prefix (`typePrefixes`). Absent both: every neuron of the class matches (contracts/learning-v1.md "Shape":
// groups.kc declares only `class`).
function matchesSelector(neuron, selector) {
  if (neuron.class !== selector.class) return false;
  if (selector.types !== undefined) return selector.types.includes(neuron.type);
  if (selector.typePrefixes !== undefined) {
    return selector.typePrefixes.some((prefix) => (neuron.type ?? '').startsWith(prefix));
  }
  return true;
}

function resolveGroup(name, selector, manifestNeurons, path) {
  const indices = [];
  manifestNeurons.forEach((neuron, index) => {
    if (matchesSelector(neuron, selector)) indices.push(index);
  });
  if (indices.length === 0) throw new Error(`E-LEARN-GROUP-EMPTY: ${path ?? 'learning'} group "${name}" resolves to no neuron`);
  // manifestNeurons is walked in ascending index order, so indices is already ascending; bodyId ties cannot
  // occur (every index is a distinct neuron), matching the AGENTS.md Python sort rule by construction.
  return Uint32Array.from(indices);
}

// Pure and deterministic: resolveLearningGroups(file, manifestNeurons) -> { kc, reward, punish, approach, avoid,
// unlisted } (contracts/learning-v1.md "Resolution"). `file` must already have passed parseLearning.
// manifestNeurons: snapshot.manifest.neurons (or the host's passthrough of the same shape), in index order.
// Throws E-LEARN-GROUP-EMPTY naming the group when kc/reward/punish/approach/avoid resolves to no neuron.
export function resolveLearningGroups(file, manifestNeurons, path) {
  const kc = resolveGroup('kc', file.groups.kc, manifestNeurons, path);
  const reward = resolveGroup('reward', file.groups.reward, manifestNeurons, path);
  const punish = resolveGroup('punish', file.groups.punish, manifestNeurons, path);

  const approachTypes = [];
  const avoidTypes = [];
  for (const entry of file.mbon ?? []) (entry.role === 'approach' ? approachTypes : avoidTypes).push(entry.type);

  const approach = resolveGroup('approach', { class: 'MBON', types: approachTypes }, manifestNeurons, path);
  const avoid = resolveGroup('avoid', { class: 'MBON', types: avoidTypes }, manifestNeurons, path);

  const listedTypes = new Set([...approachTypes, ...avoidTypes]);
  const unlisted = [...new Set(
    manifestNeurons.filter((n) => n.class === 'MBON' && !listedTypes.has(n.type)).map((n) => n.type),
  )].sort();

  return { kc, reward, punish, approach, avoid, unlisted };
}
