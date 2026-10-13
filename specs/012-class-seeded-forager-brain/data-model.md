# Phase 1 Data Model: Class-Seeded Forager Brain

Entities this feature introduces or extends. Validation rules are stated where the spec or ADR 006 fixes them;
see `contracts/` for the exact wire/file shapes.

## Extraction-time entities

### SeedClassFilter

A declared functional class or superclass whose every traced, matching body is admitted with no sampling.

| Field | Type | Rule |
|---|---|---|
| `class` | string[] | Dataset `class` values, e.g. `["ALPN", "ALLN", "ALIN", "ALON", "Kenyon_Cell", "MBON", "DAN"]`. |
| `superclass` | string[] | Dataset `superclass` values, e.g. `["descending_neuron"]`. |

- A filter with zero matching traced bodies is `E-SEED-EMPTY` (FR-014).
- Exactly one of `class`/`superclass` is set per filter entry; a config may list several entries.
- Input and output pools (ADR 003 D1/D2, reused verbatim) are seeds automatically and are not repeated here.

### FillSelection

How the remaining neurons, up to one total count, are chosen.

| Field | Type | Rule |
|---|---|---|
| `neuronCount` | integer | Total brain size, seeds included. Seeds exceeding it is `E-SEED-OVERFLOW`. |
| `excludeClasses` | string[] | Sensory classes (ADR 003 D3) never considered as fill. |
| `excludeSuperclassSuffix` | string | e.g. `"_sensory"`. |
| `excludeSuperclasses` | string[] | e.g. `["vnc_motor", "cb_motor"]` — motor neurons that are not output pools. |

- Fill candidates are scored by `shared(i) = Σ_{s ∈ seeds} [syn(i→s) + syn(s→i)]` over edges at or above
  `minSynapses`; the top `neuronCount − |seeds|` candidates are kept; ties break on ascending `bodyId` (FR-008).
- No pathway, flow or per-output score is used (constitution III: "No edge is hand-wired").

### AdmissionRule

| Field | Type | Rule |
|---|---|---|
| `admission` | `"allTraced"` | Every traced body is admissible regardless of transmitter confidence. |
| `transmitterColumn` | string | Must be a column of the neurotransmitter table, else `E-TRANSMITTER-COLUMN`. |
| `transmitterSign` | map\<string, -1\|1\> | e.g. `{ "gaba": -1, "glutamate": -1 }`. |
| `defaultSign` | `-1\|1` | Sign for every transmitter value not listed. |

- Recorded per neuron as `transmitter` (the `transmitterColumn` value) and implied by `sign` (FR-009).

### EdgeThreshold

| Field | Type | Rule |
|---|---|---|
| `minSynapses` | integer ≥ 1 | Edges below this are dropped before scoring, selection and weights (FR-010). Default stays 1, so existing configs are unaffected. |

### FidelityProbeConfig / FidelityReport

| Field | Type | Rule |
|---|---|---|
| `fidelity.require` | boolean | When true, extraction fails (`E-FIDELITY`) if either check below fails. |
| `fidelity.steps` | integer | Propagation steps, 8 per ADR 006 D13. |
| `fidelity.minContrastFraction` | number | Minimum fraction of the whole-graph contrast the brain must keep (steering check). |

`FidelityReport` (written to the snapshot header, see `container-v4-additions.md`):

| Field | Meaning |
|---|---|
| `table` | Per (input pool, output) pair: `{ brain: number, wholeGraph: number }`. |
| `steering` | `{ pass: boolean, brainContrast, wholeGraphContrast, fraction }`. |
| `feeding` | `{ pass: boolean, brainValue, wholeGraphValue }`. |

- Computed on the thresholded graph, brain vs. whole, per D13's linear-propagation formula.
- A check that fails when `require` is false is still recorded in the report, not silently dropped (edge case:
  "mismatch is recorded... not hidden").

### ExtractionConfig (classSeed)

Composes the above with the existing forager pools, modulators, outputs and `weightRule` (reused verbatim from
`extract-config-forager.md`). See `contracts/extract-config-classseed.md` for the full shape and `formatVersion`/
`kind`/`selection` discriminators.

## Snapshot entities (runtime)

### SnapshotProvenanceAdditions (header, optional)

| Field | Type | Meaning |
|---|---|---|
| `minSynapses` | integer | The threshold this brain was extracted with. Absent means 1 (v1 behaviour). |
| `selection` | string | `"classSeed"` or `"forager"` (the strategy used). Absent means `"forager"`. |
| `admission` | string | `"allTraced"` or the existing ADR 002 rule. Absent means the ADR 002 rule. |
| `fidelity` | `FidelityReport` | Present only when the probe ran. |

### NeuronOriginAdditions (per neuron, optional)

| Field | Type | Meaning |
|---|---|---|
| `transmitter` | string \| null | The `consensus_nt` (or configured column) value behind `sign`. |
| `origin` | string \| null | `"seed:<class or superclass>"`, `"fill"`, or absent for pool neurons. |

Both groups are optional and ignored by readers that do not know them (no container version bump — see
`contracts/container-v4-additions.md`). Absent on `mock`, `v0`, and the shipped `v1` forager snapshot.

## App-side entities

### DerivedCapabilitySignal

A string appended to `capabilities.signals` by the loader when the corresponding header/per-neuron data is
present: `"provenance"` (any of `minSynapses`/`selection`/`admission` present), `"fidelity"` (`fidelity` present),
`"origin"` (any neuron has a non-null `origin`). Consumed by `registry.js`'s existing `requires.signal` gate — no
change to the registry itself (research.md §5).

### ComparisonArm (extended)

The existing arm shape (`forager-arms.mjs`) gains two named instances: the class-seeded brain (this feature's
snapshot) and "v1 selection under D10–D12" (the shipped forager's own flow selection, re-run under `allTraced`
admission, `minSynapses: 5` and the D12 denominator — ADR 006 Gate C arm 3). Metrics shape (find rate, time to
food, bout length, early-leave fraction, hungry-vs-sated contrast) is unchanged (`experiment-metrics.md`, spec 008).

### CalibrationProfile (extended set)

The shape every `scripts/profiles/<id>.mjs` module must implement for `engine.mjs`/`calibrate.mjs` to run it —
already established by `v1.mjs`/`v2.mjs` on branch 013, formalised here as a contract since this feature adds a
new instance of it. See `contracts/calibration-profile.md`.

## Relationships

```text
ExtractionConfig (classSeed) ──produces──▶ .brain snapshot (container v4 + optional additions)
        │                                         │
        │ seeds/fill/admission/threshold          │ read by
        ▼                                         ▼
FidelityReport ◀──compares brain vs whole graph── public/js/brain/snapshot.js
                                                   │
                                                   ▼
                                     capabilities.signals (+ provenance/fidelity/origin)
                                                   │
                                                   ▼
                                     panel registry.js → provenance.js section / brain activity view

CalibrationProfile (class-seed-11k) ──drives──▶ engine.mjs (A1/A2/B) ──reads/writes──▶ world-forager-11k.json, checkpoints
scripts/forager-arms.mjs ──adds arm──▶ class-seeded brain, "v1 selection under D10-D12"
```
