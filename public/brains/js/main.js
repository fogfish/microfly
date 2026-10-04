// Entry point of the brain point-cloud inspector. Reads the brain manifest, shows the chosen brain,
// and wires the panel. Error states follow contracts/brain-inspector-page.md: the error panel shows
// the message, and a failed switch clears the view so no mixed view is left up.
import { parseSnapshot } from '../../js/brain/snapshot.js';
import {
  drawableNeurons, topEdgesOf, bodyEdges, keepEdges, filterMinSynapses,
  groupNameFor, groupsForLevel, groupEdges, groupCentroids, colourFor,
  validateManifest, brainFromAddress,
} from './model.js';
import { createScene } from './scene.js';
import {
  bindBrainSwitch, bindConnections, bindDisplay, bindLegendButtons, groupInfo, neuronInfo,
  renderCounts, renderLegend, renderSources, renderSwitcher, showInfo,
} from './controls.js';

const MANIFEST = 'brains.json';
const LABEL_COUNT = 14;
const $ = (id) => document.getElementById(id);
const IDLE_INFO = '<span class="muted">Hover a point or a group to see it. Click to pin.</span>';

const state = {
  manifest: null,
  scene: null,
  snapshot: null,          // the brain on screen, or null
  drawable: [],            // neuron indices with a position
  bodyEdges: null,         // every edge between positioned neurons, for body mode
  cache: {},               // level → derived groups for the brain on screen
  level: 'class',
  mode: 'group',
  minSynapses: 1,
  topEdges: 300,
  density: 1,
  showUnann: false,
  showPoints: true,
  showEdges: true,
  hidden: {                // legend state per level, in memory only
    region: new Set(),
    superclass: new Set(),
    class: new Set(),
    type: new Set(['Other typed', 'Untyped']),
  },
  hover: null,             // { type: 'group', name } | { type: 'neuron', index } | null
  pinned: null,
  counts: { neuronsDrawn: 0, edgesDrawn: 0, groupsDrawn: 0 },
};

function fail(message) {
  console.error(message);
  const panel = $('error');
  panel.textContent = message;
  panel.hidden = false;
}

function clearError() {
  $('error').hidden = true;
}

async function fetchBytes(file) {
  let response;
  try {
    response = await fetch(`./${file}`);
  } catch (error) {
    throw new Error(`${file} could not be loaded (${error.message}).`);
  }
  if (!response.ok) throw new Error(`${file} could not be loaded (HTTP ${response.status}).`);
  return response.arrayBuffer();
}

async function loadManifest() {
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(await fetchBytes(MANIFEST)));
  } catch (error) {
    throw new Error(`Brain manifest ${MANIFEST} is not valid: ${error.message}`);
  }
  const errors = validateManifest(manifest);
  if (errors.length > 0) throw new Error(errors.join('; '));
  return manifest;
}

// Groups at a level for the brain on screen, computed once per level.
function levelData(level) {
  if (!state.cache[level]) {
    const { snapshot } = state;
    const neurons = snapshot.manifest.neurons;
    const groups = groupsForLevel(snapshot, level);
    const edges = groupEdges(snapshot, level);
    state.cache[level] = {
      groups,
      edges,
      names: neurons.map((neuron) => groupNameFor(neuron, level)),
      placed: groupCentroids(groups, edges, neurons.map((neuron) => neuron.soma)),
      byName: new Map(groups.map((group) => [group.name, group])),
    };
  }
  return state.cache[level];
}

const visibleGroup = (level, name) => {
  if (state.hidden[level].has(name)) return false;
  if (name === 'Unannotated' && !state.showUnann) return false;
  return true;
};

// The group graph of group mode: one sphere per visible placed group, one curve per visible pair.
function groupGraph(level, data) {
  const nodes = data.groups.filter((g) => visibleGroup(level, g.name) && data.placed.has(g.name));
  const labelled = new Set(
    [...nodes].sort((a, b) => b.count - a.count).slice(0, LABEL_COUNT).map((g) => g.name),
  );
  const shown = data.edges.filter((e) => e.synapses >= state.minSynapses
    && data.placed.has(e.source) && data.placed.has(e.target)
    && visibleGroup(level, e.source) && visibleGroup(level, e.target));
  const min = state.minSynapses;
  const max = Math.max(min + 1, ...shown.map((e) => e.synapses));
  return {
    nodes: nodes.map((g) => ({
      name: g.name,
      centroid: data.placed.get(g.name).centroid,
      count: g.count,
      colour: colourFor(g.name, level),
      label: labelled.has(g.name),
    })),
    links: shown.map((e) => ({
      source: e.source,
      target: e.target,
      colour: colourFor(e.source, level),
      opacity: Math.min(0.95, 0.12 + 0.8 * (Math.log(e.synapses) - Math.log(min)) / (Math.log(max) - Math.log(min) + 1e-9)),
    })),
    visibleNodes: nodes.length,
  };
}

// Body edges of body mode: visible at the level, at least the minimum synapses, then the top N.
function bodyGraph(level, data) {
  const visible = keepEdges(state.bodyEdges, (source, target) =>
    visibleGroup(level, data.names[source]) && visibleGroup(level, data.names[target]));
  const kept = topEdgesOf(filterMinSynapses(visible, state.minSynapses), state.topEdges);
  return {
    source: kept.source,
    target: kept.target,
    synapses: kept.synapses,
    colours: Array.from(kept.source, (s) => colourFor(data.names[s], level)),
  };
}

function legendRows(level, data) {
  return data.groups.map((g) => ({
    name: g.name,
    colour: colourFor(g.name, level),
    count: g.count,
    checked: !state.hidden[level].has(g.name),
  }));
}

// Redraws the brain for the current level, mode and filters.
function build() {
  if (!state.snapshot) return;
  const { level, mode, scene, snapshot } = state;
  const data = levelData(level);

  const visible = Uint8Array.from(state.drawable, (i) => (visibleGroup(level, data.names[i]) ? 1 : 0));
  const colours = state.drawable.map((i) => colourFor(data.names[i], level));
  const pointsDrawn = scene.setPoints({ colours, visible, density: state.density });
  state.counts.neuronsDrawn = state.showPoints ? pointsDrawn : 0;

  if (mode === 'group') {
    const graph = groupGraph(level, data);
    scene.setEdges({ source: [], target: [], synapses: [], colours: [] });
    scene.setGroupGraph(graph);
    state.counts.edgesDrawn = state.showEdges ? graph.links.length : 0;
    state.counts.groupsDrawn = graph.visibleNodes;
  } else {
    const edges = bodyGraph(level, data);
    scene.setGroupGraph(null);
    scene.setEdges(edges);
    state.counts.edgesDrawn = state.showEdges ? edges.source.length : 0;
    state.counts.groupsDrawn = 0;
  }
  scene.setPointsVisible(state.showPoints);
  scene.setEdgesVisible(state.showEdges);

  renderCounts({
    neuronsInFile: snapshot.neuronCount,
    edgesInFile: snapshot.edgeCount,
    neuronsDrawn: state.counts.neuronsDrawn,
    edgesDrawn: state.counts.edgesDrawn,
  });
  renderLegend(legendRows(level, data), (name, checked) => {
    if (checked) state.hidden[level].delete(name);
    else state.hidden[level].add(name);
    build();
  });
  const nothing = state.counts.neuronsDrawn === 0 && state.counts.edgesDrawn === 0 && state.counts.groupsDrawn === 0;
  $('empty').style.display = nothing ? 'flex' : 'none';
  refreshInfo();
}

// Details of a group: role text, neighbours with synapse totals (reference describe()).
function groupDetails(name) {
  const data = levelData(state.level);
  const group = data.byName.get(name);
  if (!group) return IDLE_INFO;
  const outgoing = data.edges.filter((e) => e.source === name).sort((a, b) => b.synapses - a.synapses);
  const incoming = data.edges.filter((e) => e.target === name).sort((a, b) => b.synapses - a.synapses);
  const total = (rows) => rows.reduce((sum, e) => sum + e.synapses, 0);
  return groupInfo({
    level: state.level,
    name,
    count: group.count,
    fromNeighbours: data.placed.get(name)?.fromNeighbours ?? false,
    outgoing: outgoing.slice(0, 5).map((e) => [e.target, e.synapses]),
    incoming: incoming.slice(0, 5).map((e) => [e.source, e.synapses]),
    synapsesOut: total(outgoing),
    synapsesIn: total(incoming),
  });
}

function refreshInfo() {
  const target = state.pinned ?? state.hover;
  if (!target || !state.snapshot) {
    showInfo(IDLE_INFO);
  } else if (target.type === 'group') {
    showInfo(groupDetails(target.name));
  } else {
    showInfo(neuronInfo(state.snapshot.manifest.neurons[target.index]));
  }
}

const sameTarget = (a, b) => a !== null && b !== null && a.type === b.type
  && (a.type === 'group' ? a.name === b.name : a.index === b.index);

function ensureScene() {
  if (state.scene) return true;
  try {
    state.scene = createScene($('scene'));
  } catch (error) {
    console.error(error);
    fail('This browser cannot create a WebGL context, so the inspector cannot draw.');
    return false;
  }
  $('scene').addEventListener('pointermove', (event) => {
    const hit = state.scene.pick(event);
    if (!sameTarget(hit, state.hover)) {
      state.hover = hit;
      refreshInfo();
    }
  });
  // A click pins what is under the pointer; a second click on it unpins.
  $('scene').addEventListener('click', () => {
    if (state.hover) state.pinned = sameTarget(state.hover, state.pinned) ? null : state.hover;
    refreshInfo();
  });
  return true;
}

// Clears the view and the state for the brain on screen.
function clearView() {
  if (state.scene) state.scene.clear();
  state.snapshot = null;
  state.drawable = [];
  state.cache = {};
  state.hover = null;
  state.pinned = null;
  state.counts = { neuronsDrawn: 0, edgesDrawn: 0, groupsDrawn: 0 };
  renderCounts({ neuronsInFile: 0, edgesInFile: 0, neuronsDrawn: 0, edgesDrawn: 0 });
  renderLegend([], () => {});
  $('empty').style.display = 'none';
  showInfo(IDLE_INFO);
}

async function show(file) {
  clearError();
  history.replaceState(null, '', `?brain=${encodeURIComponent(file)}`);
  renderSwitcher(state.manifest.brains, file);

  let snapshot;
  try {
    snapshot = parseSnapshot(await fetchBytes(file));
  } catch (error) {
    clearView();
    fail(error.message);
    return;
  }

  const drawable = drawableNeurons(snapshot);
  if (drawable.length === 0) {
    clearView();
    fail('No neuron has a 3D position');
    return;
  }
  if (!ensureScene()) {
    clearView();
    return;
  }

  state.scene.setBrain(snapshot, drawable);
  state.snapshot = snapshot;
  state.drawable = drawable;
  state.bodyEdges = bodyEdges(snapshot);
  state.cache = {};
  state.hover = null;
  state.pinned = null;
  // Legend state is per brain: a group name hidden in one brain means nothing in another.
  for (const level of Object.keys(state.hidden)) state.hidden[level] = new Set(level === 'type' ? ['Other typed', 'Untyped'] : []);
  build();
}

function wireControls() {
  const connections = bindConnections({
    onLevel: (level) => {
      state.level = level;
      state.pinned = null;
      state.hover = null;
      build();
    },
    onMode: (mode) => {
      state.mode = mode;
      build();
    },
    onMinSynapses: (value) => {
      state.minSynapses = value;
      build();
    },
    onTopEdges: (value) => {
      state.topEdges = value;
      build();
    },
  });
  state.level = connections.level;
  state.mode = connections.mode;
  state.minSynapses = connections.minSynapses;
  state.topEdges = connections.topEdges;

  const display = bindDisplay({
    onPoints: (on) => {
      state.showPoints = on;
      state.scene?.setPointsVisible(on);
    },
    onEdges: (on) => {
      state.showEdges = on;
      state.scene?.setEdgesVisible(on);
    },
    onUnannotated: (on) => {
      state.showUnann = on;
      build();
    },
    onDensity: (value) => {
      state.density = value;
      build();
    },
    onAutoRotate: (on) => state.scene?.setAutoRotate(on),
    onReset: () => state.scene?.resetView(),
  });
  state.density = display.density;

  bindLegendButtons({
    onShowAll: () => {
      state.hidden[state.level] = new Set();
      build();
    },
    onHideAll: () => {
      state.hidden[state.level] = new Set(levelData(state.level).groups.map((g) => g.name));
      build();
    },
  });
  bindBrainSwitch((file) => show(file));
  renderSources();
}

async function main() {
  wireControls();
  try {
    state.manifest = await loadManifest();
  } catch (error) {
    fail(error.message);
    renderCounts({ neuronsInFile: 0, edgesInFile: 0, neuronsDrawn: 0, edgesDrawn: 0 });
    return;
  }
  await show(brainFromAddress(location.search, state.manifest));
}

main();
