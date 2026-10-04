// Pure model of the brain inspector: no DOM, no three.js. Works on the objects parseSnapshot returns.
// Scene rules are the reference inspector's (inspector/malecns-3d.html): centre of the bounding box,
// largest extent scaled to 220 units, y axis flipped.
// Region rule checked against the reference's region counts (spec 004, T032): all 211,577 annotation rows
// match exactly for Optic lobe, Central brain, Ventral nerve cord, Brain-VNC pathways, ENS and Unannotated.

const SCENE_SIZE = 220;

const hasPosition = (soma) => Array.isArray(soma);

// Indices of the neurons that have a 3D position (soma !== null).
export function drawableNeurons(snapshot) {
  const out = [];
  snapshot.manifest.neurons.forEach((neuron, i) => {
    if (hasPosition(neuron.soma)) out.push(i);
  });
  return out;
}

// Centre and scale for a set of [x, y, z] positions.
export function sceneTransform(positions) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of positions) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], p[i]);
      hi[i] = Math.max(hi[i], p[i]);
    }
  }
  const centre = lo.map((v, i) => (v + hi[i]) / 2);
  const extent = Math.max(...hi.map((v, i) => v - lo[i]));
  const scale = extent > 0 ? SCENE_SIZE / extent : 1;
  return { centre, scale };
}

// A dataset position in scene coordinates.
export function toScene(position, { centre, scale }) {
  return [
    (position[0] - centre[0]) * scale,
    -(position[1] - centre[1]) * scale,
    (position[2] - centre[2]) * scale,
  ];
}

// Every CSR edge whose both ends have a position, as parallel typed arrays.
export function bodyEdges(snapshot) {
  const { neuronCount, offsets, targets, synapses, weights, manifest } = snapshot;
  const drawable = manifest.neurons.map((neuron) => hasPosition(neuron.soma));
  const source = [];
  const edge = [];
  for (let s = 0; s < neuronCount; s++) {
    if (!drawable[s]) continue;
    for (let k = offsets[s]; k < offsets[s + 1]; k++) {
      if (drawable[targets[k]]) {
        source.push(s);
        edge.push(k);
      }
    }
  }
  return {
    source: Uint32Array.from(source),
    target: Uint32Array.from(edge, (k) => targets[k]),
    synapses: Uint16Array.from(edge, (k) => synapses[k]),
    weight: Float32Array.from(edge, (k) => weights[k]),
  };
}

// Edges picked by index, in the order given.
function selectEdges(edges, indices) {
  return {
    source: Uint32Array.from(indices, (k) => edges.source[k]),
    target: Uint32Array.from(indices, (k) => edges.target[k]),
    synapses: Uint16Array.from(indices, (k) => edges.synapses[k]),
    weight: Float32Array.from(indices, (k) => edges.weight[k]),
  };
}

// Edges for which keep(source, target, synapses) is true, in their order.
export function keepEdges(edges, keep) {
  const kept = [];
  for (let k = 0; k < edges.synapses.length; k++) {
    if (keep(edges.source[k], edges.target[k], edges.synapses[k])) kept.push(k);
  }
  return selectEdges(edges, kept);
}

// The n edges with the most synapses among the drawable edges (research R7). Used by the body mode.
export function topEdges(snapshot, n) {
  return topEdgesOf(bodyEdges(snapshot), n);
}

// The n edges with the most synapses of an edge set (topEdges on the drawable body edges). A histogram
// of the synapse counts finds the threshold in one pass, with no sort. Ties at the threshold go to the
// lower edge index. The result is in index order.
export function topEdgesOf(all, n) {
  const total = all.synapses.length;
  const want = Math.min(n, total);
  if (want <= 0) return selectEdges(all, []);

  const counts = new Uint32Array(65536);
  for (let k = 0; k < total; k++) counts[all.synapses[k]]++;
  let above = 0;
  let threshold = 65535;
  while (threshold > 1 && above + counts[threshold] < want) {
    above += counts[threshold];
    threshold--;
  }

  let ties = want - above;
  const picked = [];
  for (let k = 0; k < total; k++) {
    const s = all.synapses[k];
    if (s > threshold) picked.push(k);
    else if (s === threshold && ties > 0) {
      picked.push(k);
      ties--;
    }
  }
  return selectEdges(all, picked);
}

// Edges with at least `min` synapses.
export function filterMinSynapses(edges, min) {
  return keepEdges(edges, (_source, _target, synapses) => synapses >= min);
}

const MANIFEST_FORMAT = 'brain-manifest';

// Errors in a brain manifest (contracts/brains-manifest.md). An empty list means it is valid.
export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object'
      || manifest.format !== MANIFEST_FORMAT || manifest.version !== 1) {
    return ['unsupported brain manifest: expected format "brain-manifest" and version 1'];
  }
  if (!Array.isArray(manifest.brains) || manifest.brains.length === 0) {
    return ['brains must be a non-empty list'];
  }
  const errors = [];
  const files = new Set();
  manifest.brains.forEach((entry, i) => {
    const file = entry?.file;
    if (typeof file !== 'string' || file === '') {
      errors.push(`brains[${i}].file must be a file name`);
      return;
    }
    if (/[\\/]/.test(file)) errors.push(`file ${file} has a path separator`);
    if (files.has(file)) errors.push(`duplicate file ${file}`);
    files.add(file);
    if (typeof entry.label !== 'string' || entry.label.trim() === '') {
      errors.push(`brains[${i}].label must be a non-empty string`);
    }
  });
  if (!files.has(manifest.default)) {
    errors.push(`default ${manifest.default} is not the file of a listed brain`);
  }
  return errors;
}

// The brain to show: ?brain=<file> when that file is in the manifest, else the default.
export function brainFromAddress(search, manifest) {
  const requested = new URLSearchParams(search).get('brain');
  const listed = manifest.brains.some((entry) => entry.file === requested);
  return listed ? requested : manifest.default;
}

// ---- groups (research R4, R6, R8; data-model sections 4 to 6)

export const REGION_COLOUR = {
  'Optic lobe': '#4fc3f7',
  'Central brain': '#ffb74d',
  'Ventral nerve cord': '#81c784',
  'Brain-VNC pathways': '#e57373',
  ENS: '#ba68c8',
  Unannotated: '#7d7d7d',
};

const PATHWAY_SUPERCLASSES = new Set([
  'ascending_neuron', 'descending_neuron',
  'sensory_ascending', 'sensory_descending', 'efferent_ascending', 'efferent_descending',
]);

// Region of a superclass, by its prefix (research R4).
export function regionOf(superclass) {
  if (!superclass) return 'Unannotated';
  if (superclass.startsWith('ol_') || superclass.startsWith('visual_')) return 'Optic lobe';
  if (superclass.startsWith('cb_')) return 'Central brain';
  if (superclass.startsWith('vnc_')) return 'Ventral nerve cord';
  if (superclass === 'ENS') return 'ENS';
  const base = superclass.endsWith('_tbc') ? superclass.slice(0, -4) : superclass;
  if (PATHWAY_SUPERCLASSES.has(base)) return 'Brain-VNC pathways';
  return 'Unannotated';
}

// The group name of a neuron at a level (data-model section 5).
export function groupNameFor(neuron, level) {
  switch (level) {
    case 'region': return regionOf(neuron.superclass);
    case 'superclass': return neuron.superclass || 'Unannotated';
    case 'class':
      if (neuron.class) return neuron.class;
      if (neuron.superclass) return `(no class) ${neuron.superclass}`;
      return 'Unannotated';
    case 'type': return neuron.type || 'Untyped';
    default: throw new Error(`unknown level ${level}`);
  }
}

// One group per distinct name. `count` includes every neuron of the group; `members` holds only the
// drawable ones (those with a soma). Largest first, then by name.
export function groupsForLevel(snapshot, level) {
  const byName = new Map();
  snapshot.manifest.neurons.forEach((neuron, i) => {
    const name = groupNameFor(neuron, level);
    if (!byName.has(name)) byName.set(name, { level, name, members: [], count: 0 });
    const group = byName.get(name);
    group.count++;
    if (Array.isArray(neuron.soma)) group.members.push(i);
  });
  return [...byName.values()].sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
}

// Synapse totals between groups over all edges, self-pairs excluded. Includes neurons without a
// position, so a group with no position can still be placed from its neighbours (research R6).
export function groupEdges(snapshot, level) {
  const { neuronCount, offsets, targets, synapses, manifest } = snapshot;
  const names = manifest.neurons.map((neuron) => groupNameFor(neuron, level));
  const totals = new Map();
  for (let s = 0; s < neuronCount; s++) {
    for (let k = offsets[s]; k < offsets[s + 1]; k++) {
      const source = names[s];
      const target = names[targets[k]];
      if (source === target) continue;
      const key = `${source}\u0000${target}`;
      if (!totals.has(key)) totals.set(key, { source, target, synapses: 0 });
      totals.get(key).synapses += synapses[k];
    }
  }
  return [...totals.values()];
}

const mean = (points) => {
  const sum = [0, 0, 0];
  for (const p of points) for (let i = 0; i < 3; i++) sum[i] += p[i];
  return sum.map((v) => v / points.length);
};

// Dataset-coordinate centroid of each group that can be placed (data-model section 5, R6).
// A group with members is at their mean position. A group without members is at the synapse-weighted
// mean of its placed neighbours. A group with neither is not in the map. Returns Map name → {centroid, fromNeighbours}.
export function groupCentroids(groups, edges, positions) {
  const placed = new Map();
  for (const group of groups) {
    if (group.members.length > 0) {
      placed.set(group.name, { centroid: mean(group.members.map((i) => positions[i])), fromNeighbours: false });
    }
  }
  for (const group of groups) {
    if (group.members.length > 0) continue;
    const sum = [0, 0, 0];
    let total = 0;
    for (const edge of edges) {
      const other = edge.source === group.name ? edge.target : edge.target === group.name ? edge.source : null;
      if (other === null || !placed.has(other)) continue;
      const { centroid } = placed.get(other);
      for (let i = 0; i < 3; i++) sum[i] += centroid[i] * edge.synapses;
      total += edge.synapses;
    }
    if (total > 0) placed.set(group.name, { centroid: sum.map((v) => v / total), fromNeighbours: true });
  }
  return placed;
}

const toHex = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');

// HSL (h, s, l in 0 to 1) to a #rrggbb string.
function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x];
  return `#${toHex(r + m)}${toHex(g + m)}${toHex(b + m)}`;
}

// Group colour: the region palette for the region level, grey for Unannotated, otherwise a hue from
// the name (the reference's rule).
export function colourFor(name, level) {
  if (level === 'region' && REGION_COLOUR[name]) return REGION_COLOUR[name];
  if (name === 'Unannotated') return '#7d7d7d';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return hslToHex((h % 360) / 360, 0.62, 0.62);
}
