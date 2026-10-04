# ADR 002: Smallest functional connectome brain (ALPN → interneurons → DN readouts)

- **Status:** Proposed
- **Date:** 2026-10-04
- **Supersedes:** nothing. Refines Stage 3 of [ADR 001](001-lif-toy-network-and-fly-integration.md).
- **Inputs:** `malecns.md` §2, §4, §8, §10, §12; ADR 001; `.specify/memory/constitution.md` (Principles II–VII); `specs/002-toy-lif-fly-network/contracts/fly-config.md`; `contracts/worker-protocol.md`.
- **Intended consumer:** the extractor feature (`/speckit-specify`), and anyone reading the brain's wiring as reference.

## Context

ADR 001 fixed the simulator (`lif.js`), the worker protocol and the world contract. It left the
brain topology open: how a real connectome subgraph becomes the 40-neuron random graph that
`fly-brain.js` builds today.

This ADR defines the smallest connectome subgraph that can drive a fly, the rules that select it,
the rules that set its signs and weights, and the conditions under which the extractor refuses to
produce a snapshot. Everything here must be reproducible from the dataset and a config file.

The simulator and the world already define the interface the brain must meet:

- neuron **0** receives the sensory drive (`external[0]`);
- neuron **1** (LEFT) and neuron **2** (RIGHT) are read as spike-rate EMAs (`fly-brain.js`);
- every other neuron is free to wire however the data says.

So a connectome brain is a graph with three fixed roles and any number of interneurons between them.

## Decisions

### D1. Sensory entry point: ALPN, Traced only

The sensory neuron (index 0) is a body with `class = ALPN` and `status = Traced`.

ALPN (antennal-lobe projection neurons) are second-order olfactory neurons. They receive input from
olfactory receptor neurons (ORN, `class = olfactory`) and relay it to the mushroom body and lateral
horn (`malecns.md` §6, §13). ALPN are the correct entry point for a *receptor-like* signal, but they
are not receptors themselves. The ORN layer upstream is out of scope for this ADR. Adding it later
is a change to the config, not to the simulator.

The world's stimulus is a distance gradient (`fruitIntensity`, radius 3 tiles). ALPN responses to
odour fit that shape better than contact-only gustatory neurons, which was ADR 001's first choice.

Only `Traced` bodies are admitted anywhere in the brain. In `malecns.md` §8, `Traced` is the most
reliable status. `Orphan`, `Glia`, `Unimportant` and `Assign` bodies are not used.

### D2. Readouts: descending neurons on each side

- **LEFT (1):** a body with `superclass = descending_neuron`, `somaSide = L`, `status = Traced`.
- **RIGHT (2):** a body with `superclass = descending_neuron`, `somaSide = R`, `status = Traced`.

Descending neurons (DN) are the brain-to-VNC command layer (`malecns.md` §13). Motor neurons
(`vnc_motor`) are almost pure sinks, with about 70k outgoing synapses in the whole dataset
(`malecns.md` §10). A readout only needs to spike, so DN are a better choice than MN, and they keep
the path from sensory to motor inside the brain. Mapping DN onto wheel speeds is the same
`LEFT`/`RIGHT` convention as ADR 001 and needs no change to the world.

### D3. Interneurons: two-hop sandwich, Traced only

An interneuron is admitted if all of these hold:

1. `status = Traced` and its transmitter passes D4 (confident, mapped).
2. It is not the sensory body or a readout.
3. It receives at least one synapse from the sensory body (one hop from 0).
4. It sends at least one synapse to LEFT or RIGHT (one hop to 1 or 2).

Each admitted candidate is scored by `min(synapses from sensory, synapses to readouts)`. The top
`maxInterneurons` are kept. Ties break on ascending `bodyId`.

The extractor also requires at least one interneuron that reaches LEFT and at least one that
reaches RIGHT. Without that, one turn direction is impossible, and the fly cannot steer toward fruit
on both sides.

The selected subgraph is the **induced subgraph** on `{sensory, LEFT, RIGHT, interneurons}`. Every
traced-only edge between two selected nodes is kept.

### D4. Signs come from predicted transmitters

`body-neurotransmitters` gives `predicted_nt` and `predicted_nt_confidence` per body. The sign of a
body is the sign of its outgoing edges (Dale's law, as in `graph.js`).

| `predicted_nt` (lower-cased) | Sign | Admitted? |
|---|---|---|
| `acetylcholine` | +1 (excitatory) | yes |
| `gaba` | −1 (inhibitory) | yes |
| `glutamate` | −1 (inhibitory) | yes, see open question Q1 |
| `histamine`, `dopamine`, `serotonin`, `octopamine` | — | no |
| `unclear`, or any other value | — | no |

A body is admitted only if `predicted_nt_confidence >= minConfidence` (default 0.5). A body below
the threshold or with an unmapped transmitter is **not admitted** as an interneuron. If the
sensory or a readout body fails this rule, that is an extraction failure (D6), not a silent
default.

Histamine, dopamine, serotonin and octopamine are left out of the fast-sign rule. They act through
metabotropic or modulatory mechanisms that a single signed LIF weight does not represent. Excluding
them keeps the model honest about what it simulates.

Signs are predictions, not measurements (`malecns.md` §12). The config and the provenance must record
the map and the threshold.

### D5. Weights

For each kept edge with `synapses = weight` in `connectome-weights-…-traced-only`:

```
weight = sign(pre) × min(synapses, synapseCap) / synapseCap
```

`synapseCap` defaults to 5. Reasons:

- Median weight is 2, and 75th percentile is 4 (`malecns.md` §10).
- About 6.2M edges have weight ≥ 5. Five is the dataset's own break point.
- Typical edges land at 0.4–0.8, close to ADR 001's toy magnitude of ±1, so `synapticScale = 0.2`
  stays a sensible starting point.

The raw synapse count is kept in the snapshot next to the normalized weight, so the normalization
can change without re-reading the dataset.

### D6. The extractor fails instead of guessing

The extractor exits with status 1 and writes **no** snapshot (and leaves any existing snapshot
untouched) when any of these rules is violated. Each failure carries a stable code.

| Code | Condition |
|---|---|
| `E-CONFIG` | Config has unknown keys, or a value is out of range. |
| `E-DATASET-MISSING` | A required Feather file is absent in `datasetDir`. |
| `E-DATASET-ROWS` | Row count differs from `expect` in the config (guards against a different release). |
| `E-DUP-BODY` | A `bodyId` or `body` appears more than once in annotations or neurotransmitters. |
| `E-SENSORY-NONE` | No body matches D1 (`ALPN`, `Traced`, admitted transmitter). |
| `E-READOUT-NONE` | No admitted, `Traced` descending neuron on one of the two sides. |
| `E-NO-PATH` | No interneuron satisfies D3, or none reaches LEFT and none reaches RIGHT. |
| `E-TOO-FEW` | Fewer than `minInterneurons` interneurons were selected. |
| `E-NODE-COUNT` | Selected node count differs from `expectedNeuronCount`, when that is set. |
| `E-SIGN` | A selected node has an unmapped or low-confidence transmitter. |
| `E-EMPTY-EDGES` | No edge leaves the sensory body, or no edge enters LEFT or RIGHT after filtering. |
| `E-NONDETERMINISTIC` | Two runs with the same config and dataset produce different bodies (self-check). |

The extractor reports the actual numbers (nodes, edges, selected transmitters, weight range) on
success, so the config's `expect` values can be filled in from a real run.

### D7. Snapshot format (version 1)

```jsonc
{
  "formatVersion": 1,
  "provenance": {
    "datasetRelease": "male-cns-v1.0",
    "edgeVariant": "traced-only",
    "minConfidence": 0.5,
    "configHash": "sha256:…",          // canonical JSON of the config
    "toolVersion": "0.1.0",
    "createdAt": "2026-10-04T00:00:00Z"
  },
  "neurons": [
    // index 0: sensory; 1: LEFT; 2: RIGHT; 3..: interneurons ordered by ascending bodyId
    { "index": 0, "role": "sensory", "bodyId": 0, "class": "ALPN", "type": "…", "somaSide": "…",
      "transmitter": "acetylcholine", "transmitterConfidence": 0.9, "sign": 1 }
  ],
  "edges": [
    // only edges between selected nodes, synapses >= 1
    { "pre": 0, "post": 3, "synapses": 12, "weight": 1.0 }
  ]
}
```

Rules for the browser loader:

- `formatVersion` must be `1`, otherwise reject with a clear error.
- `neurons[0].role` must be `sensory`, `neurons[1].role` must be `left`, `neurons[2].role` must be
  `right`. Any other order is rejected.
- `neurons.length` gives `neuronCount`. `edges` maps directly to the `{pre, post, weight}` graph that
  `createNetwork` already accepts.
- `createdAt` is recorded in provenance but ignored by the byte-identity check (see D6,
  `E-NONDETERMINISTIC`).

### D8. Config (the extractor's only input besides the dataset path)

```jsonc
{
  "formatVersion": 1,
  "datasetRelease": "male-cns-v1.0",
  "edgeVariant": "traced-only",
  "expect": {
    "annotationRows": 211577,
    "edgeRows": 25563197,
    "neurotransmitterRows": 1835518
  },
  "sensory": { "class": "ALPN", "status": "Traced" },
  "readouts": { "superclass": "descending_neuron", "status": "Traced", "somaSides": ["L", "R"] },
  "transmitterSign": { "acetylcholine": 1, "gaba": -1, "glutamate": -1 },
  "minConfidence": 0.5,
  "synapseCap": 5,
  "minInterneurons": 2,
  "maxInterneurons": 8,
  "expectedNeuronCount": null
}
```

`datasetDir` comes from a command-line argument or the `MALECNS_DIR` environment variable, never from
the config file. Constitution III requires this, and it keeps the config portable.

`expect` values are the counts in `malecns.md` §1–§2 for the v1.0 release. A different release must
either update them or fail with `E-DATASET-ROWS`.

## Algorithm

1. Validate the config (`E-CONFIG`). Check that each Feather file exists (`E-DATASET-MISSING`) and
   has the expected row count (`E-DATASET-ROWS`).
2. Read annotations with column selection: `bodyId`, `class`, `superclass`, `somaSide`, `status`,
   `type`. Reject duplicate `bodyId` (`E-DUP-BODY`).
3. Read neurotransmitters with column selection: `body`, `predicted_nt`, `predicted_nt_confidence`.
   Reject duplicate `body` (`E-DUP-BODY`). Compute admitted transmitters (D4).
4. Read traced-only edges with column selection: `body_pre`, `body_post`, `weight`, using a row
   filter on the two endpoints. Keep only edges whose endpoints are both `Traced` and admitted.
5. **Sensory:** among admitted ALPN, choose the body with the largest total outgoing synapses to
   admitted bodies. Ties go to the smallest `bodyId`. None found → `E-SENSORY-NONE`.
6. **Readouts:** for each side in `{L, R}`, among admitted `Traced` descending neurons on that side,
   choose the one receiving the most synapses from the sensory body's direct downstream partners
   (two-hop synapse sum). Ties go to the smallest `bodyId`. None found → `E-READOUT-NONE`.
7. **Interneurons:** apply D3, score, sort, and keep the top `maxInterneurons`. Fewer than
   `minInterneurons` → `E-TOO-FEW`. No interneuron reaches LEFT, or none reaches RIGHT → `E-NO-PATH`.
8. Build the induced subgraph. Check `expectedNeuronCount` (`E-NODE-COUNT`), signs (`E-SIGN`), and
   that edges leave the sensory body and enter both readouts (`E-EMPTY-EDGES`).
9. Compute weights (D5). Assign indices (D7). Write `snapshot.json` through a temporary file and an
   atomic rename.
10. Self-check: run steps 5–9 a second time in the same process and compare the output, excluding
    `createdAt` (`E-NONDETERMINISTIC`).

All sorting uses explicit keys, and every tie breaks on `bodyId`. Floating-point values use a fixed
format when serialized.

## Integration into the world

Changes are confined to the brain layer. `lif.js`, `worker-core.js`, `protocol.js`, the stimulus,
the renderer and the world generator do not change.

1. **Host** (`fly-host.js`): fetch the snapshot JSON once at startup, validate `formatVersion` and
   role order (D7), and place the parsed object into `brain.snapshot`. The worker's `init` message
   already carries `brain` as an object, so the protocol is unchanged.
2. **Brain** (`fly-brain.js`): if `brainConfig.snapshot` is set, build the graph from it instead of
   calling `randomGraph`. Skip `addMotorDrive`, because it would overwrite the connectome's sensory
   edges with `weight = 1`. Use `neuronCount` from the snapshot. If `snapshot` and `neuronCount` or
   `outDegree` are both given, the config is invalid.
3. **World config** (`world.json`, `flies.brain`): add an optional `snapshot` path, relative to the
   web root. `neuronCount` and `outDegree` are ignored when it is set. `telemetry` indices must be
   below the snapshot's `neuronCount`.
4. **Contract** (`fly-config.md`): document `brain.snapshot` as an optional field within version 1,
   following the versioning rule in that contract. Existing configs stay valid.

Constitution I (static, zero build) holds: the snapshot is a static JSON file served next to the
code. The dataset is never read in the browser (Principle III).

## Acceptance

Extraction and integration are separate gates.

- **Gate A, extractor.** On the v1.0 release with the config in D8, the extractor either writes a
  snapshot that passes D7, or fails with one of the codes in D6. Unit tests use a small synthetic
  Feather fixture labelled as a test fixture (Principle III), covering each failure code and a
  byte-identical rerun.
- **Gate B, integration.** The browser loads the snapshot, `createFlyBrain` builds the graph with
  `neuronCount` taken from the snapshot, and the worker runs without errors for a full tick run.
  Node tests cover the loader's rejection cases and determinism.
- **Gate C, behaviour.** Using the existing `experiment` block in `fly-config.md`, the snapshot brain
  makes more fruit contacts than the random-walk baseline over the listed seeds. If it does not,
  ADR 001 applies: the wiring is at fault, and the fix is a config change (`maxInterneurons`,
  `synapseCap`, `minConfidence`, or `lif`), not a change to the simulator.

Gate C is a result, not a precondition for shipping the extractor. The extractor can be correct and
the brain can still underperform.

## Consequences

- The brain is traceable. Each node has a `bodyId`, `type`, `class` and sign source, and each weight
  has a raw synapse count.
- Failures are loud. A dataset change, a missing path or a low-confidence transmitter stops the
  extraction, and the old snapshot stays in place.
- The brain is small. A snapshot of about 3 to 11 neurons is inspectable by hand, which suits the
  constitution's rule to start with the smallest design that works.
- Only `Traced` bodies with confident transmitters are used, so the brain is biased toward
  well-reconstructed, well-predicted neurons. The snapshot records this.
- Sign comes from predictions, so the brain's behaviour depends on the transmitter map. The map is
  in the config and the provenance.
- A single ALPN entry means the brain is driven by one olfactory-like channel. The world gives
  one scalar sense, so this matches the current world. It is a limit, not a bug.

## Open questions

These do not block the extractor. Each one changes a config value or a single rule.

- **Q1. Glutamate sign.** D4 treats glutamate as inhibitory by default. That follows a common view of
  the fly, but `malecns.md` does not say so, and I have not checked the literature for this release.
  If it is wrong, the change is one line in `transmitterSign`.
- **Q2. Confidence threshold.** `0.5` is a default borrowed from the `minconf` name. The meaning of
  `predicted_nt_confidence` is not documented here. Confirm it against the release notes.
- **Q3. Interneuron count.** `maxInterneurons = 8` is a guess. Run the extractor with several values
  and pick the smallest that passes Gate C.
- **Q4. Readout choice.** The DN readout rule uses two-hop synapse sums. It is a heuristic, and an
  alternative is to pick readouts with the largest direct input from the interneurons.
- **Q5. ORN layer.** Adding ORN (`class = olfactory`) upstream of ALPN would add realism but also a
  second stage of sign and weight choices. Defer until Gate C is met.

## Related

- [ADR 001](001-lif-toy-network-and-fly-integration.md): simulator, protocol, Stage 3 context.
- `malecns.md`: §4 annotation schema, §8 status, §10 connectivity and neurotransmitters, §12 caveats.
- `.specify/memory/constitution.md`: Principles I, II, III, IV, V, VI, VII.
- `specs/002-toy-lif-fly-network/contracts/fly-config.md`: the `brain` block that gains `snapshot`.

## Amendment 2026-10-04

Recorded during implementation of feature 003 (`specs/003-malecns-brain-extractor/`). The decisions above are kept as written. The changes below take precedence where they differ.

### A1. D3 reserved slots (research R3)

The top-`maxInterneurons` rule of D3 selects no LEFT-reaching interneuron on the v1.0 release. Of 77 candidates, only 5 reach LEFT, and the best of them ranks 30th. The rule is amended: after scoring, the best LEFT-reaching candidate and the best RIGHT-reaching candidate are always kept. The remaining slots are filled by score, ties on ascending `bodyId`. E-NO-PATH is raised only when a side has no candidate at all. Evidence: the 5-of-77 LEFT count and the best LEFT-reacher, body 10702, are in `specs/003-malecns-brain-extractor/research.md` R3. The real run selects body 10702 as the LEFT slot (`specs/003-malecns-brain-extractor/extraction-report.md`).

### A2. D7 replaced by container version 2

The JSON format of D7 was not implemented. It is replaced by the binary container, version 2: a JSON header (provenance, neurons in role order, section table) followed by CSR arrays of `offsets`, `targets`, `weights` and `synapses`. The reason is scale: the full admitted set is 143,219 neurons and 22,082,410 edges, which JSON cannot hold in a browser worker (`specs/003-malecns-brain-extractor/research.md` R1). The contract is `specs/003-malecns-brain-extractor/contracts/snapshot-format.md`. Roles, neuron order and the reader checks of D7 are kept in that contract.

### A3. New error codes

- `E-DUP-EDGE`: a `(body_pre, body_post)` pair appears more than once in the traced-only edges. Added to D6 (research R12).
- `E-OVERFLOW`: a selected raw synapse count exceeds 65,535, the limit of the `synapses` section. Added to D6 (research R12).

The D6 codes are otherwise unchanged. The config keys of D8 are unchanged.
