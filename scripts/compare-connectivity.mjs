// Connectivity diagnostic, not a calibration run: compares how short and how excitatory the path from
// odour-sensing input neurons to each motor output pool is, directly from a .brain snapshot's CSR edge list.
// No simulation. Motivated by specs/013-forager-brain-15k-lif-v2/calibration.md's 2026-10-11 update: v2's best
// LIF-calibrated candidates performed worse than a random walk, and A2 needed near-ceiling output gain on nearly
// every channel -- both consistent with a weak/noisy drive rather than a short, clearly excitatory relay from
// odour to motor. This script measures that relay directly, and compares it against v1 (already calibrated,
// specs/008-hungry-forager-brain/calibration.md), so the two numbers can be read side by side.
//
// Usage: node scripts/compare-connectivity.mjs [brain1.brain] [brain2.brain]
// Defaults to the two shipped brains: public/brains/forager-brain.brain (v1) and
// public/brains/forager-brain-15k.brain (v2).

import { readFileSync } from 'node:fs';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const webRoot = new URL('../public/', import.meta.url);

function loadSnapshot(relPath) {
  const bytes = readFileSync(new URL(relPath, webRoot));
  return parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

// Multi-source BFS over the CSR edge list (pre -> post, as lif-v1.js's step() walks it), hop distance only.
// `accept(weight)` filters which edges the walk may use; omit for "any edge, any sign".
function bfsHops(sources, offsets, targets, weights, neuronCount, accept) {
  const dist = new Int32Array(neuronCount).fill(-1);
  const queue = new Int32Array(neuronCount);
  let head = 0;
  let tail = 0;
  for (const s of sources) {
    if (dist[s] === -1) { dist[s] = 0; queue[tail++] = s; }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    for (let k = offsets[i]; k < offsets[i + 1]; k++) {
      if (accept && !accept(weights[k])) continue;
      const t = targets[k];
      if (dist[t] === -1) { dist[t] = d + 1; queue[tail++] = t; }
    }
  }
  return dist;
}

function poolStats(dist, neuronIds) {
  const hops = neuronIds.map((i) => dist[i]).filter((h) => h >= 0);
  return {
    poolSize: neuronIds.length,
    reached: hops.length,
    reachedFrac: neuronIds.length ? hops.length / neuronIds.length : 0,
    minHop: hops.length ? Math.min(...hops) : null,
    meanHop: hops.length ? hops.reduce((a, b) => a + b, 0) / hops.length : null,
  };
}

function isOdourFood(ch) {
  return ch.sense === 'odour:food' || (ch.sense === undefined && ch.id.startsWith('odour'));
}

function analyse(label, snapshot) {
  const { neuronCount, edgeCount, offsets, targets, weights, manifest } = snapshot;
  const channels = manifest.capabilities.channels;

  const odourNeurons = new Set();
  for (const ch of channels.inputs) {
    if (isOdourFood(ch)) for (const n of ch.neurons) odourNeurons.add(n);
  }

  let excitatory = 0;
  for (let k = 0; k < edgeCount; k++) if (weights[k] > 0) excitatory++;

  const distAny = bfsHops(odourNeurons, offsets, targets, weights, neuronCount);
  const distExc = bfsHops(odourNeurons, offsets, targets, weights, neuronCount, (w) => w > 0);

  const byDrive = new Map();
  for (const ch of channels.outputs) {
    if (!byDrive.has(ch.drive)) byDrive.set(ch.drive, []);
    byDrive.get(ch.drive).push(...ch.neurons);
  }

  const drives = {};
  for (const [drive, neuronIds] of byDrive) {
    drives[drive] = { any: poolStats(distAny, neuronIds), exc: poolStats(distExc, neuronIds) };
  }

  // Network-wide reach: how much of the whole brain is excitatorily reachable from odour at all, regardless of
  // drive. A short path to the motor pools is not informative if almost the whole network is just as close --
  // that reads as an undifferentiated recurrent blob, not a selective relay.
  let reachableAny = 0;
  for (let i = 0; i < neuronCount; i++) if (distExc[i] >= 0) reachableAny++;

  // Inflow composition at the output pools: of each pool's direct (1-hop) excitatory weight, how much comes
  // from a source that is itself excitatorily odour-reachable (any hop) vs. a source that is not reachable from
  // odour at all. If this is close to the network-wide baseline below, odour reachability does not distinguish
  // the output pools' inflow from anyone else's.
  const outputNeurons = new Set();
  for (const ids of byDrive.values()) for (const n of ids) outputNeurons.add(n);
  let poolFromReachable = 0;
  let poolTotal = 0;
  let allFromReachable = 0;
  let allTotal = 0;
  for (let i = 0; i < neuronCount; i++) {
    const srcReachable = distExc[i] >= 0;
    for (let k = offsets[i]; k < offsets[i + 1]; k++) {
      if (weights[k] <= 0) continue;
      const w = weights[k];
      allTotal += w;
      if (srcReachable) allFromReachable += w;
      if (outputNeurons.has(targets[k])) {
        poolTotal += w;
        if (srcReachable) poolFromReachable += w;
      }
    }
  }

  // Per-neuron total absolute inflow weight: how much raw dynamic range one global synapticScale has to cover.
  // v1 (postFractionAbsolute) is normalised by the writer so this is <= 1 for every neuron by construction
  // (snapshot.js's own CSR check). v2 (synapseCount) is explicitly NOT normalised (container-v5.md) -- this
  // reports how wide that raw range actually is.
  const inflow = new Float64Array(neuronCount);
  for (let k = 0; k < edgeCount; k++) inflow[targets[k]] += Math.abs(weights[k]);
  const sorted = Array.from(inflow).sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / neuronCount;
  const median = sorted[Math.floor(neuronCount / 2)];
  const p99 = sorted[Math.floor(neuronCount * 0.99)];
  const max = sorted[neuronCount - 1];
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / neuronCount;
  const inflowStats = { mean, median, p99, max, cv: mean ? Math.sqrt(variance) / mean : 0, maxOverMedian: median ? max / median : null };

  const group = manifest.neurons?.[0]?.group !== undefined
    ? Object.fromEntries(['al', 'vnc', 'dn', 'central'].map((g) => {
      const members = manifest.neurons.filter((nn) => nn.group === g).map((nn) => nn.index);
      return [g, poolStats(distExc, members)];
    }))
    : null;

  return {
    label, neuronCount, edgeCount,
    weightRule: manifest.weightRule,
    meanOutDegree: edgeCount / neuronCount,
    excitatoryFrac: edgeCount ? excitatory / edgeCount : 0,
    odourNeuronCount: odourNeurons.size,
    networkReachableFrac: reachableAny / neuronCount,
    poolInflowReachableFrac: poolTotal ? poolFromReachable / poolTotal : null,
    allInflowReachableFrac: allTotal ? allFromReachable / allTotal : null,
    inflowStats,
    drives, group,
  };
}

function fmtPct(x) { return x === null ? 'n/a' : `${(x * 100).toFixed(0)}%`; }
function fmtHop(x) { return x === null ? 'n/a' : x.toFixed(1); }

function printReport(r) {
  console.log(`\n=== ${r.label} ===`);
  console.log(`neurons=${r.neuronCount} edges=${r.edgeCount} meanOutDegree=${r.meanOutDegree.toFixed(2)} ` +
    `excitatoryEdges=${fmtPct(r.excitatoryFrac)} odourInputNeurons=${r.odourNeuronCount}`);
  console.log(`whole-network excitatory-reachable-from-odour: ${fmtPct(r.networkReachableFrac)} of all neurons`);
  console.log(`direct excitatory inflow share from an odour-reachable source: motor pools ${fmtPct(r.poolInflowReachableFrac)} ` +
    `vs. network-wide baseline ${fmtPct(r.allInflowReachableFrac)}`);
  const s = r.inflowStats;
  console.log(`weightRule=${r.weightRule} | per-neuron total |inflow| weight: mean=${s.mean.toFixed(3)} ` +
    `median=${s.median.toFixed(3)} p99=${s.p99.toFixed(3)} max=${s.max.toFixed(3)} ` +
    `CV=${s.cv.toFixed(2)} max/median=${s.maxOverMedian === null ? 'n/a' : s.maxOverMedian.toFixed(1) + 'x'}`);
  console.log('drive        | reach(any) minHop(any) | reach(exc) minHop(exc) meanHop(exc)');
  for (const [drive, s] of Object.entries(r.drives)) {
    console.log(
      `${drive.padEnd(13)} | ${fmtPct(s.any.reachedFrac).padStart(10)} ${fmtHop(s.any.minHop).padStart(10)} | ` +
      `${fmtPct(s.exc.reachedFrac).padStart(10)} ${fmtHop(s.exc.minHop).padStart(10)} ${fmtHop(s.exc.meanHop).padStart(12)}`,
    );
  }
  if (r.group) {
    console.log('group (excitatory-only distance from odour input):');
    for (const [g, s] of Object.entries(r.group)) {
      console.log(`  ${g.padEnd(8)} size=${s.poolSize} reach=${fmtPct(s.reachedFrac)} minHop=${fmtHop(s.minHop)} meanHop=${fmtHop(s.meanHop)}`);
    }
  }
}

const [p1 = 'brains/forager-brain.brain', p2 = 'brains/forager-brain-15k.brain'] = process.argv.slice(2);

const r1 = analyse(`v1  (${p1})`, loadSnapshot(p1));
const r2 = analyse(`v2  (${p2})`, loadSnapshot(p2));
printReport(r1);
printReport(r2);

console.log('\n=== side by side (excitatory-only min hop, odour input -> drive) ===');
console.log('drive        | v1    | v2');
const allDrives = new Set([...Object.keys(r1.drives), ...Object.keys(r2.drives)]);
for (const drive of allDrives) {
  const a = r1.drives[drive]?.exc.minHop;
  const b = r2.drives[drive]?.exc.minHop;
  console.log(`${drive.padEnd(13)} | ${fmtHop(a ?? null).padStart(5)} | ${fmtHop(b ?? null).padStart(5)}`);
}
