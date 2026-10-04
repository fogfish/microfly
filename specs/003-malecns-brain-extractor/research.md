# Research: MaleCNS Smallest Brain Extractor

**Feature**: `003-malecns-brain-extractor` | **Date**: 2026-10-04

Each decision lists the choice, the evidence (measured on the v1.0 files unless marked as estimate), and the alternatives rejected. Measurements were made with read-only scratch scripts outside the repository. No extraction output was written into the repository during planning.

## Measured facts used below

| Fact | Value | Source |
|------|-------|--------|
| Traced bodies | 165,122 | `body-annotations`, `status = Traced` |
| Traced bodies with an admitted transmitter (ACh, GABA or Glu, confidence ≥ 0.5) | 143,219 (ACh+ 94,946; GABA/Glu− 48,273) | annotations joined with `body-neurotransmitters` |
| Admitted ALPN (sensory candidates) | 677 of 686 traced ALPN | same join, `class = ALPN` |
| Admitted descending neurons per side | L 639, R 633, M 3 | `superclass = descending_neuron`, `somaSide` |
| Traced-only edges with both ends admitted | 22,082,410 | streaming pass over `connectome-weights-…-traced-only` (about 14 s) |
| Feather row counts | annotations 211,577; neurotransmitters 1,835,518; traced-only edges 25,563,197 (391 batches) | Feather metadata |
| Column schemas | annotations `bodyId, class, superclass, somaSide, status, type` present; neurotransmitters `body, predicted_nt, predicted_nt_confidence`; edges `body_pre, body_post, weight` | Feather metadata |

## R1: Serialization format

**Decision**: Container version 2, one file, extension `.brain`.

```text
offset 0        magic "MFBR" (4 bytes ASCII)
offset 4        formatVersion, uint32 little-endian, = 2
offset 8        headerLength H, uint32 little-endian (multiple of 8)
offset 12       header: UTF-8 JSON, H bytes, padded with spaces
offset 12+H     body: CSR sections, each 4-byte aligned
                  offsets   uint32 × (neuronCount + 1)   row starts per presynaptic neuron
                  targets   uint32 × edgeCount           postsynaptic neuron index
                  weights   float32 × edgeCount          normalised signed weight (D5)
                  synapses  uint16 × edgeCount           raw synapse count (D5)
```

The JSON header holds provenance, the neuron list in role order (ADR D7), and the section table (absolute byte offsets and lengths). Edges are sorted by presynaptic index, then postsynaptic index. The body is therefore a fixed function of the selected graph.

**Rationale**:

- **Scale.** Measured full admitted set: 22,082,410 edges. The body costs 10 bytes per edge, about 221 MB, plus 0.57 MB of offsets. JSON for the same edges would be several times larger, and JSON parsing of 22M objects in a worker is not workable.
- **One format.** The reference brain (about 10 neurons) is the same container at 1 KB. There is no second code path to keep in sync (Principle VII).
- **Inspectable.** The header is readable JSON. `head -c` shows the neurons, provenance and counts. The binary body is checked by the Python reader and the browser parser.
- **Single file.** Keeps FR-014 ("a single static file with a format version").
- **Typed arrays.** The browser makes `Uint32Array`, `Float32Array` and `Uint16Array` views with no per-edge objects. This is the only way the LIF core can hold the full brain.

**Alternatives considered**:

- *JSON only (ADR D7)*: rejected on scale, see above. It stays valid for the reference brain, but two formats would be needed.
- *Two files (JSON manifest plus `.bin`)*: rejected. Violates FR-014 and needs two fetches to be consistent.
- *Base64 inside JSON*: rejected. 33% larger than binary, and it still needs a decode step.
- *Protocol buffers or Arrow IPC in the browser*: rejected. Needs a library (Principle I, VII). Arrow IPC is also a dependency the browser would have to vendor.

**Sizes (measured where stated, estimates labelled)**:

- Reference brain: about 10 neurons and about 40 edges, expected container size about 1 KB (estimate; verified in the first extraction).
- Full admitted set: 143,219 neurons, 22,082,410 edges, about 221 MB body (computed from the layout above; to be measured by the format benchmark).

## R2: Extraction algorithm and memory

**Decision**: Three phases.

1. **Read the small tables in full, column-selected**: annotations (`bodyId, class, superclass, somaSide, status`) and neurotransmitters (`body, predicted_nt, predicted_nt_confidence`). Both are small (14 MB and 43 MB on disk). Build the admitted set (D4) and reject duplicates (E-DUP-BODY).
2. **Stream the traced-only edges once**: read batches of `body_pre, body_post, weight` and keep only rows whose two ends are both admitted. Verify uniqueness of `(pre, post)` (E-DUP-EDGE). Result: typed arrays of the restricted edges (22M rows for the full admitted set, 3 × 4 bytes each).
3. **Select in memory**: sensory, readouts, interneurons, induced subgraph, signs, weights, self-check. The restricted table is sufficient for every step, because all selected nodes are admitted and every rule only touches edges between admitted bodies.

**Rationale**: The constitution requires that the file never be loaded whole and that memory scale with the data needed, not the file. The admitted subgraph is the data the rules need. Measured streaming time was about 14 s for the full filter. The self-check (E-NONDETERMINISTIC) reruns phase 3 on the same in-memory table, so it costs little.

**Alternatives considered**:

- *`pyarrow.dataset` with filters on `body_pre` and `body_post`*: one pass per rule, and each pass filters 25M rows again. Slower, and no simpler.
- *`pandas`*: works, but roughly doubles memory for the same table. Principle VII prefers the lean path.
- *Storing an intermediate Parquet*: a second format for no benefit.

## R3: Reserved slots (amends ADR 002 D3)

**Decision**: After scoring, reserve one interneuron for each side: the best-ranked candidate that reaches LEFT and the best-ranked candidate that reaches RIGHT. Fill the remaining slots by score, ties on ascending `bodyId`. The selected set is then ordered by ascending `bodyId` for indices (D7). E-NO-PATH only when a side has no candidate at all.

**Evidence**: The ADR's rule (top `maxInterneurons`, default 8) was checked against the real data:

- 77 candidates pass D3 (admitted, sensory → candidate, candidate → readout).
- The top 8 by score all reach RIGHT, and none reaches LEFT (reading of the scores: fromS and toR columns).
- Only 5 candidates reach LEFT at all: ranks 30, 35, 46, 72 and 76. The best LEFT-reacher is body 10702 (score 4; fromS 4; toL 24; toR 1).

So D3's own requirement ("at least one that reaches LEFT") is violated by D3's selection step. Reserved slots fix this without changing the score or the admission rules. With `maxInterneurons` 8, the reserved LEFT slot is 10702 and the RIGHT slot is the top-ranked RIGHT-reacher (already first by score).

**Rationale**: Keeps the ranking and every admission rule exactly as written. Only the selection cut changes, and only to satisfy the rule that already exists in D3.

**Alternatives considered**:

- *Keep the ADR rule*: the reference brain cannot be built. E-NO-PATH on the real release.
- *Raise `maxInterneurons` until LEFT appears*: LEFT-reachers are ranked 30th and below, so this would select about 30 interneurons, which conflicts with the "smallest brain" purpose and with the `maxInterneurons` default.
- *Rank by LEFT and RIGHT balance*: a new score that is not in the ADR.

## R4: Readout asymmetry (reported, not hidden)

**Decision**: No rule change. The report prints, for each readout, its two-hop input total (the D6 step-6 score) and the number of interneurons that reach it.

**Evidence**: Two-hop input from the sensory partners (817 direct partners of body 10084): LEFT readout 10118 gets **31**, RIGHT readout 10065 gets **906**. Candidates reaching LEFT are few (5), and their LEFT synapses are small (24 is the largest).

**Consequence**: A fly driven by this brain will have a much weaker LEFT motor channel. Turning will be biased. This is a property of the connectome subgraph reached from this sensory entry point, and it is the kind of result ADR Gate C exists to expose. It must not be "fixed" by changing the readout rule to hit a target.

**Alternative considered**: *Pick LEFT readout by direct input from candidates* (ADR Q4's alternative). It was checked: it still selects 10118 (31 from candidates). So Q4 does not remove the asymmetry.

## R5: Configuration covers only ADR 002 D8

**Decision**: The config file has exactly the keys of ADR D8 (see [contracts/extract-config.md](contracts/extract-config.md)). Nothing is added. The vocabulary is malecns.md's: `class`, `status`, `superclass`, `somaSide`, `predicted_nt`, `bodyId`, `type`.

**Rationale**: "Configurability minimal, covering only ADR needs." D8 already names every value the ADR's rules need, and nothing the rules do not use. Sensory and readout values are Traced, as D1 and D2 state, and are kept in config only because D8 places them there. `datasetDir` stays outside the config (D8, Constitution III).

**Alternatives considered**:

- *Free-form filters on any annotation column*: general, but outside ADR needs and a source of silent mistakes.
- *Hard-coding every value*: rejected. D8 already asks for the config, and the `expect` counts must be in it to catch a release change (E-DATASET-ROWS).

## R6: LIF internal form (CSR for toy and snapshot)

**Decision**: `createNetwork` converts either input into CSR arrays (`offsets`, `targets`, `weights`), preserving the edge order of the input within each presynaptic neuron. `step` iterates the CSR arrays. Input shapes:

- toy: `{ neuronCount, edges }` as today (unchanged);
- snapshot: `{ neuronCount, offsets, targets, weights }` from the container.

The per-tick arithmetic keeps the same operation order (`weight × synapticScale`, accumulated in the same sequence), so the floating-point result for the toy is identical.

**Rationale**: The snapshot's 22M edges cannot be JS objects (one object per edge would be over a gigabyte). CSR is the form the container already has. The toy path is proven unchanged by a golden trace: record the motor sequence and spike sets for seed 1990 (fly 0) before the refactor, commit the trace as a test fixture, and require equality after (`tests/lif-golden.test.mjs`).

**Alternatives considered**:

- *Keep objects and add a second step function for snapshots*: duplicates the core, which Principle V forbids (one tested LIF core).
- *Convert the container into the object form at load*: memory cost described above.

## R7: Browser loading

**Decision**: The worker shell (`fly.worker.js`) receives `init` with `brain.snapshot` set to a URL. It fetches the container, parses it with the pure `snapshot.js`, then hands the resolved snapshot to `worker-core`. The host (`fly-host.js`) fetches and validates the header once before starting workers, and checks telemetry indices against the snapshot's `neuronCount`. Validation errors show in the fly panel and no flies start (spec FR-019, SC-007).

**Rationale**: Each fly owns its brain (Principle II). Passing 221 MB through `postMessage` from the main thread would copy it per fly and hold it in the main thread's memory. The worker fetches from the static URL, so the browser's HTTP cache can serve the bytes.

**Alternatives considered**:

- *Host fetches and transfers the ArrayBuffer to each worker*: copies per fly, and the main thread keeps a copy. Rejected for scale.
- *`SharedArrayBuffer` shared across workers*: needs cross-origin isolation headers, which a plain static host may not set. Breaks Principle I's deployment promise. Deferred.

## R8: Switching brains by configuration

**Decision**: `flies.brain.snapshot` (a URL relative to the web root) selects the snapshot brain for all toy-mode flies in that world. The default `world.json` is unchanged. A second world file, `public/world/world-connectome.json`, is the same world with `snapshot` set, opened with `index.html?world=world/world-connectome.json` (the existing `?world=` switch in `load-world.js`). The snapshot is opt-in per world, never the default.

**Rationale**: Spec FR-017/FR-018 and SC-004 require switching by configuration only. The `?world=` switch already exists. A separate file keeps the default app identical (SC-005).

**Alternatives considered**:

- *A per-fly `brain` choice list*: finer control, but mixing kinds inside one world needs new UI and was not asked for. FR-024 allows it, and the config shape leaves room for it later.
- *Overwriting `world.json`*: changes the default app.

## R9: Comparison design

**Decision**: `scripts/compare-baseline.mjs` runs four arms over the same world and the `experiment.seeds` list:

| Arm | Brain | Purpose |
|-----|-------|---------|
| `toy` | Random toy from `flies.brain` (40 neurons by default) | The current mock |
| `nature` | Snapshot from `flies.brain.snapshot` | Connectome brain |
| `random-matched` | Random toy with `neuronCount` = snapshot neuron count and `outDegree` = round(edges ÷ neurons), clamped to `[1, neuronCount − 1]` | Size-matched random control |
| `baseline` | Random walk (no brain) | ADR Gate C reference |

Each arm reports fruit contacts per fly and per seed, the totals, and the differences: nature − random-matched, nature − toy, and every arm − baseline.

**Rationale**: The user goal is random versus nature. The toy has 40 neurons and the snapshot about 10, so without the size-matched control the comparison confounds size with topology. The control has the same size and about the same degree; signs and weights differ, and that is the point. This is a metric, not a gate (research R12 of feature 002), so the script exits 0 with a verdict.

**Alternatives considered**:

- *Only toy versus baseline (the current script)*: does not answer the user's question.
- *Toy versus nature only*: confounded by size.

## R10: Validation strategy

**Decision**:

1. **Python unit tests** on a synthetic Feather fixture written by `extract/tests/make_fixture.py` (labelled as a test fixture, Principle III). Cover config errors, each ADR error code, reserved slots, determinism (byte-identical body), and the container round trip.
2. **Contract test on both sides**: `make_fixture.py` also writes `tests/fixtures/synthetic-smallest.brain`. The JavaScript parser must read it (`tests/snapshot.test.mjs`) and the Python reader must read the same bytes (`test_container.py`).
3. **Node tests** for the parser rejection cases, the LIF golden trace, the snapshot brain, and validation conflicts.
4. **Real extraction**: run the tool on the v1.0 release with `extract/configs/smallest-functional-brain.json`. Commit the resulting `public/brains/smallest-functional-brain.brain`. Record the report in `quickstart.md`.
5. **Format benchmark**: a script (`extract/tests/bench_full_admitted.py`, not a config mode) writes the full admitted set (143,219 neurons, 22,082,410 edges) with the same writer, to `data/`. It reports the container size and read time in Python. The browser is not asked to load it by default.
6. **Browser run check**: `python3 -m http.server` from `public/`, both worlds, six flies, no console errors (Constitution Dev Workflow).

**Alternatives considered**: a "full brain" config mode (rejected: outside ADR needs, see R5 and Complexity Tracking).

## R11: Repository layout and pinned dependencies

**Decision**: `extract/` for the Python tool, with `requirements.txt` pinning `pyarrow==25.0.1` and `numpy==2.5.3` (the versions tested). Python 3.11 or newer. Tests use `unittest` from the standard library. The tool is run as `python -m malecns_brain` from `extract/`.

**Rationale**: Constitution "Technology & Architecture Constraints" asks for separated top-level directories and pinned requirements. Stdlib tests avoid a third package.

**Alternatives considered**: `pytest` (a third dependency for little benefit), `pandas` (see R2), a `pyproject.toml` package (more machinery than one small package needs; can be added later).

## R12: Bounds and overflow

**Decision**: `synapses` is stored as uint16. A raw count over 65,535 fails with E-OVERFLOW. Duplicate `(body_pre, body_post)` pairs fail with E-DUP-EDGE.

**Evidence**: The largest traced-only edge in v1.0 is 2,591 (malecns.md §3), so the bound is not reachable on this release; the check makes the format's limit explicit.

**Alternatives considered**: uint32 for synapses (adds 2 bytes per edge, about 44 MB extra at full size, for a case that cannot occur); silent clamping (violates ADR D6).
