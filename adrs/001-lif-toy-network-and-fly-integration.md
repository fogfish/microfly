# ADR 001: Minimal LIF network, random toy topology, and staged connectome integration

- **Status:** Proposed
- **Date:** 2026-10-04
- **Inputs:** `malecns.md`, `.specify/memory/constitution.md` (Principles II, III, V, VI, VII)
- **Intended consumer:** `/speckit-specify` for the first feature, and later for the extractor feature

## Context

The project wants a fly that behaves in the browser world, driven by a brain that is a real
subset of the male *Drosophila* CNS connectome. Building the full connectome pipeline first
would mix two unknowns: whether the neural model drives useful behaviour at all, and whether
the dataset extraction is correct. This ADR separates them.

Constraints from the constitution that shape the choice:

- The app is static HTML/CSS/JS with native ES modules and no build step (Principle I).
- Each fly runs in its own Web Worker, and the main thread does no neural computation
  (Principle II).
- The LIF core is a pure JavaScript module with no DOM or worker dependencies. Every
  parameter is named and configurable, and the same seed gives the same spike sequence
  (Principle V).
- Real brains come from `malecns.md` through Python utilities. The dataset is external and
  must be read in batches (Principles III and IV).
- Flies perceive the world only through sensory inputs and act only through motor outputs
  (Principle VI).
- Start with the smallest design that works (Principle VII).

## Decision

Build in three stages. Each stage has to pass before the next one starts.

### Stage 1: LIF core and random toy network

Add `public/js/brain/lif.js`, a pure module with:

- `LIF_DEFAULTS`: frozen named parameters `dt`, `tau`, `vRest`, `vReset`, `vThreshold`,
  `refractorySteps`, `synapticScale`.
- `createNetwork(graph, params)`: builds the simulation state from `{ neuronCount, edges }`.
- `step(net, external)`: advances one time step. `external` is a `Float64Array(n)` of
  sensory drive. Spikes are delivered with a one-step delay.
- `randomGraph({ neuronCount, outDegree, inhibitoryFraction, rand })`: fixed out-degree
  random topology with Dale's law (each neuron is excitatory `+1` or inhibitory `-1`).
  `rand` is the seeded PRNG. Requires `outDegree < neuronCount`.

Edge weights are `±1` in the toy. The toy network is a labelled test fixture, as the
constitution requires for synthetic networks.

Tests go in `tests/lif.test.mjs` and run with Node's built-in test runner:

- identical spike trains for the same seed and graph;
- a predictable inter-spike interval under constant drive;
- refractory steps are respected;
- inhibitory edges lower the downstream firing rate.

### Stage 2: Fly-world integration

Run one fly per Web Worker. Each step, the worker does this:

- **Input:** one sensory neuron (index 0) receives `external[0] = gain * fruitIntensity`,
  where `fruitIntensity` is the world's stimulus value for the fly's position.
- **Output:** two motor neurons, LEFT and RIGHT. Each keeps an exponential moving average of
  its spike rate, and the two rates set the left and right wheel speeds.

The worker exchanges messages with the main thread through a versioned protocol: sensory
input in, motor output and telemetry out (Principle II).

Acceptance metric: over several seeds, the toy fly makes more fruit contacts than a
random-walk baseline in the same world. If it does not, the wiring is at fault, and the
dataset is not yet involved.

### Stage 3: Connectome snapshot and extractor

A Python command-line tool turns `malecns.md`'s dataset into a snapshot. The snapshot is a
static JSON file with `formatVersion`, provenance (dataset release, edge variant, config
hash, tool version, creation time), neurons (`bodyId`, `type`, `class`, `superclass`,
sign), and edges.

Extraction rules, grounded in `malecns.md`:

- **Edge variant:** `connectome-weights-…-traced-only.feather`. The variant is written into
  the config and the provenance. Variants are not mixed.
- **Weight:** the synapse count from `weight`, scaled by a configured normalization. The
  dataset counts synapses per edge (for example, `Li32 → Li33` has weight 2591 and exactly
  2591 synapse rows).
- **Sign:** from `body-neurotransmitters` (`predicted_nt`, with
  `predicted_nt_confidence`). Acetylcholine is treated as excitatory and GABA as inhibitory.
  This mapping is an assumption based on general neuroscience, not on `malecns.md`, and the
  config must state it. Glutamate is not assigned a sign in this ADR (see open question 4).
  Neurons with confidence below a configured threshold, or with `unclear` transmitter, get a
  sign rule that the config states. The default is excitatory.
- **Selection:** a declarative config picks the starting class and the regions it may
  traverse. The first slice is `gustatory` sensory neurons (the closest match to the fruit
  and honey in the world) → a small set of intrinsic and descending neurons → `vnc_motor`.
  The config states expected neuron and edge counts, and the pipeline reports the actual
  numbers.
- **Reading:** Feather files are read with `pyarrow` in column-selected or filtered batches.
  The large files (for example `syn-points`, about 13 GB) are never loaded whole.
- **Determinism:** any sampling uses a seed from the config, so the same config and dataset
  give a byte-identical snapshot.

The browser loads a snapshot in its worker and rejects an unsupported `formatVersion` with a
clear error. Stage 3 runs the same LIF core and the same worker protocol as Stage 2. Only
the topology and the parameters change.

### Growth loop

After Stage 3, grow the network one configuration change at a time. After each change, run
the Stage 2 metric and keep the change only if it is needed for faithfulness or improves
behaviour.

## Consequences

- The LIF core and worker protocol are tested before any dataset work starts.
- The dataset enters only at Stage 3, so extraction bugs and simulation bugs are separated.
- Choosing `traced-only` removes reconstruction-incomplete bodies. Results are biased toward
  well-traced neurons, and the snapshot records that the variant was chosen.
- Sign comes from predicted transmitters, not measurements. Mistakes there change
  behaviour in ways that are hard to see, so the confidence threshold is part of the config
  and the provenance.
- `vnc_motor` neurons produce very few outgoing synapses (about 70k in total across the
  dataset). They act as sinks, so the path from sensory to motor must go through descending
  neurons.
- Motor groups outside the VNC are out of scope for this ADR.

## Open questions

These need decisions before or during `/speckit-specify`:

1. **Motor outputs:** two (LEFT, RIGHT) or one? One output can change speed but not heading.
   This ADR assumes two, which departs from a literal "one input, one output".
2. **Motor mapping:** how real `vnc_motor` groups map to LEFT and RIGHT drive. Deferred to
   after the toy works, but it must be decided before Stage 3 reaches the motor end.
3. **Weight normalization:** the scale and any cap for synapse counts. This affects how
   `synapticScale` should be set.
4. **Sign rules:** the confidence value below which a neuron takes the default sign, the
   default sign itself, and how glutamate (common in the dataset, sign not assigned here)
   is treated.
5. **Neuron count:** the target size of the first real snapshot (the constitution asks each
   configuration to state it).

## Related

- `.specify/memory/constitution.md`: Principles II, III, V, VI, VII
- `malecns.md`: §2 files, §4 annotation schema, §5 superclass and region, §10 connectivity
  and neurotransmitters, §12 caveats

## Annex A: a 40-line LIF core, a seeded random graph, and a two-channel fly

The smallest useful version is one pure JavaScript module plus a seeded random graph. It matches the constitution: Principle V (LIF core is pure JS with named parameters, reproducible from a seed) and Principle VII (smallest design that works). I haven't written any files yet.

### 1. LIF core (`public/js/brain/lif.js`, pure, no DOM or worker code)

```js
// Leaky integrate-and-fire core. No DOM, no workers, no hidden constants.
export const LIF_DEFAULTS = Object.freeze({
  dt: 1.0,             // ms per step
  tau: 20.0,           // membrane time constant (ms)
  vRest: 0.0,          // resting potential
  vReset: 0.0,         // potential after a spike
  vThreshold: 1.0,     // firing threshold
  refractorySteps: 2,  // steps silent after a spike
  synapticScale: 0.2,  // potential jump per unit of edge weight
});

export function createNetwork(graph, params = LIF_DEFAULTS) {
  const n = graph.neuronCount;
  const outgoing = Array.from({ length: n }, () => []);
  for (const { pre, post, weight } of graph.edges) outgoing[pre].push({ post, weight });
  return {
    params, n, outgoing,
    v: new Float64Array(n).fill(params.vRest),
    refractory: new Int32Array(n),
    input: new Float64Array(n),   // synaptic input delivered on the next step
    spikes: new Uint8Array(n),    // spikes emitted by the last step
  };
}

// external: Float64Array(n) of sensory drive for this step (zeros if none)
export function step(net, external) {
  const { params: p, n, v, refractory, input, spikes, outgoing } = net;
  const nextInput = new Float64Array(n);
  spikes.fill(0);
  for (let i = 0; i < n; i++) {
    if (refractory[i] > 0) { refractory[i]--; continue; }
    v[i] += (p.dt / p.tau) * (p.vRest - v[i]) + input[i] + external[i];
    if (v[i] >= p.vThreshold) {
      v[i] = p.vReset;
      refractory[i] = p.refractorySteps;
      spikes[i] = 1;
      for (const e of outgoing[i]) nextInput[e.post] += e.weight * p.synapticScale;
    }
  }
  net.input = nextInput;
}
```

Each neuron has one leaky state variable, one threshold, and one refractory counter. Spikes are delivered with a one-step delay, which keeps the update order-independent.

### 2. Random topology (same file or `graph.js`)

```js
// Fixed out-degree random graph with Dale's law: each neuron is excitatory (+1) or inhibitory (-1).
export function randomGraph({ neuronCount, outDegree, inhibitoryFraction, rand }) {
  const sign = Array.from({ length: neuronCount }, () => (rand() < inhibitoryFraction ? -1 : 1));
  const edges = [];
  for (let pre = 0; pre < neuronCount; pre++) {
    const targets = new Set();
    while (targets.size < outDegree) {
      const post = Math.floor(rand() * neuronCount);
      if (post !== pre) targets.add(post);
    }
    for (const post of targets) edges.push({ pre, post, weight: sign[pre] });
  }
  return { neuronCount, edges };
}
```

`rand` should be the seeded PRNG so the same seed gives the same network. The repo already has `public/js/world/prng.js`, which I haven't checked yet. The loop requires `outDegree < neuronCount`.

### 3. Fly-world interface (the worker, not the core)

- **Sensor:** neuron 0 gets `external[0] = gain * fruitIntensity`. This is the single input.
- **Motor:** two output neurons, `LEFT` and `RIGHT`, each with an exponential moving average of its spike rate. The rates drive the left and right wheel speeds.

I'd use two motor neurons rather than one. With one output, the fly can only change speed, not heading. That's a change to your "one input one output" wording, so say if you want strictly one output.

### 4. Iterative path to the connectome

1. **Toy loop:** the random network in the fly-world loop. Measure fruit contacts against a random-walk baseline over several seeds. If the toy doesn't beat the baseline, the wiring is the problem, not the dataset.
2. **Snapshot contract:** JSON with `formatVersion`, provenance, neurons (`bodyId`, `type`, `class`, `superclass`, sign), and edges. Edge weight is the synapse count from `connectome-weights`, normalized by a configured scale. The browser rejects unknown versions.
3. **Python extractor:** reads the Feather files in batches with column selection, so nothing large is loaded whole. Use `connectome-weights-…-traced-only` and state that choice in the config. Sign comes from `body-neurotransmitters` (acetylcholine, glutamate, GABA, and so on) with a confidence threshold written in the config.
4. **First real slice:** `gustatory` sensory neurons (the closest match to the fruit and honey in the world) → a small set of intrinsic and descending neurons → `vnc_motor`. Motor neurons in `malecns.md` are mostly sinks, so the descending path matters. Mapping real motor groups to left and right drive is a judgment call. I'd postpone it until the toy loop works.
5. **Grow one step at a time:** add neurons or regions through the config, rerun the baseline metric, and keep only additions that change behaviour.

