# Implementation Plan: MaleCNS Smallest Brain Extractor

**Branch**: `003-malecns-brain-extractor` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-malecns-brain-extractor/spec.md`

**Note**: Scope from the user: write the extraction utility in Python; decide the serialization format with a full brain in mind; configure with the malecns.md vocabulary but only for ADR 002 needs; validate on real extraction and integration into `lif.js`; keep the toy mock alive and configurable; enable the random-vs-nature comparison.

## Summary

A Python command-line tool (`extract/`) reads the MaleCNS v1.0 traced-only Feather files, applies the rules of ADR 002 with a declarative config, and writes one binary **brain container** (`.brain`): a small JSON header (provenance, neurons in role order, section table) followed by CSR arrays of targets, weights and raw synapse counts. The browser simulator loads that container in each fly's worker and builds the LIF network from it. The toy random network stays the default and is unchanged in behaviour; a world config opts a fly into the snapshot brain. The comparison script runs the same seeds through four arms: toy random, connectome snapshot ("nature"), size-matched random control, and the random-walk baseline.

Three findings from real-data checks, made during this plan, change the ADR text and are decided here:

1. **Serialization.** On the real traced subgraph the ADR's admission rules leave **143,219 neurons and 22,082,410 edges** (measured). JSON (ADR 002 D7) would be roughly a gigabyte for that. The format is therefore binary CSR. The small brain uses the same format, so there is one code path. Decision R1.
2. **Selection.** The ADR's "top `maxInterneurons` by score" rule selects **no LEFT-reaching interneuron** on the real data. Of 77 candidates that pass D3, only 5 reach LEFT, and the best one ranks 30th. The fix is reserved slots: the best LEFT-reaching and best RIGHT-reaching candidate are always kept. Decision R3. This amends ADR D3.
3. **Readout asymmetry.** The selected readouts are not symmetric in the data. The RIGHT readout receives 906 synapses from the sensory partners' two-hop sum, and LEFT receives 31. The tool reports this, and the comparison will show its effect. It is not hidden by a rule change. Decision R4.

## Technical Context

**Language/Version**: Python 3.11+ for the extractor (CLI, pure logic plus Feather I/O). JavaScript (ES2022, native ES modules, module Web Workers) for the browser and tests. Node.js 20+ for `node --test`.

**Primary Dependencies**: Extractor: `pyarrow` and `numpy`, pinned in `extract/requirements.txt` (pyarrow 25.0.1, numpy 2.5.3, as tested). No pandas in the tool. Tests use the standard library (`unittest`). Browser: none (Constitution I).

**Storage**: Dataset outside the repository (`MALECNS_DIR`, never committed). The committed reference brain is `public/brains/smallest-functional-brain.brain` (about 1 KB, Constitution III allows small reference snapshots used by the app and tests). Full-admitted-subgraph benchmark output goes to `data/` (already git-ignored).

**Testing**: `python -m unittest discover -s extract/tests` for the extractor, including error codes, determinism and a contract test that reads the container written by Python and loaded by JavaScript (fixture `tests/fixtures/synthetic-smallest.brain`). `node --test tests/*.test.mjs` for the browser modules, the container parser, the LIF refactor (golden trace), validation and the fly brain. Real-data validation is described in `quickstart.md`.

**Target Platform**: Extractor on macOS or Linux with Python 3.11+ and a local dataset. Browser on current evergreen Chrome, Firefox and Safari.

**Project Type**: Static web application with a Python offline extraction tool, in one repository.

**Performance Goals**: The reference extraction runs in under 2 minutes on the v1.0 traced-only files (the measured single streaming pass is about 14 s). Browser: six flies at 20 Hz with snapshot brains, as in feature 002.

**Constraints**: The dataset is read in column-selected batches (Constitution IV). Memory is bounded by the admitted subgraph, not by the 25.5M-row edge file. The same config and dataset give byte-identical containers, except the creation time. The browser rejects unsupported versions with a clear error. No dataset access in the browser.

**Scale/Scope**: Reference brain: about 3 to 11 neurons (ADR 002). Full admitted subgraph measured for the format decision: 143,219 neurons, 22,082,410 edges, about 221 MB of edge sections. That size is a format benchmark, not a default app setting.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Static Web, Zero Build | Browser loads a static `.brain` file with `fetch` and typed arrays. No build step, no package install. The extractor is an offline tool, not a runtime dependency. | PASS |
| II. One Fly, One Worker | Each snapshot fly keeps its own worker and its own LIF state. The worker fetches the container itself, so the main thread does not copy the edge data. The main thread only validates the header. | PASS |
| III. Connectome-Grounded Snapshots | Every snapshot comes from the dataset by the Python tool. Provenance (release, variant, config hash, tool version, creation time) is in the header. Neuron identity keeps `bodyId`, `type`, `class` and `somaSide`. Signs come from `predicted_nt` with the threshold recorded. The toy stays labelled as a synthetic fixture. | PASS |
| IV. Configurable, Reproducible Extraction | Config is declarative JSON (ADR D8 keys only). The dataset path is an argument or env var. Same config and dataset give identical body bytes. Reads are column-selected and filtered. The tool reports actual counts and the expected values are in config. | PASS |
| V. Faithful, Inspectable LIF Simulation | LIF stays pure. Named parameters are overridable through `flies.brain.lif`. The CSR refactor keeps the toy spike train bit-identical (golden trace test). Telemetry is unchanged. | PASS |
| VI. Living World, Embodied Flies | The mapping from sensory and motor neurons is in the container header (roles) and in config, not in world code. Flies still act only through LEFT and RIGHT motor outputs. | PASS |
| VII. Simplicity | One container format for all sizes. Stdlib tests. Two pinned Python packages. Reserved slots are one rule, not a new algorithm. Deviations are listed in Complexity Tracking. | PASS (see deviations) |
| Tests (Dev Workflow) | Python tests on a synthetic fixture (config, selection, determinism, container). Protocol and container contract tests on both sides. Browser run check with `python3 -m http.server` and no console errors (quickstart). | PASS |
| Documentation (Dev Workflow) | `contracts/snapshot-format.md` (container v2), `contracts/extract-config.md`, `contracts/integration.md` (fly-config and worker-protocol deltas) are written with this plan. ADR 002 gets an amendment note (task). | PASS |
| Technology constraints (Data flow) | MaleCNS (external) → Python extraction (config) → `.brain` (static asset) → fly worker (LIF) ↔ world (main thread). Matches the constitution. | PASS |

**Post-design re-check (after Phase 1)**: PASS. Two items are deviations, not violations: the full-admitted brain is larger than Principle IV's "compact enough to load in a browser worker" for the default app (it is a benchmark only), and reserved slots amend ADR D3. Both are recorded in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-malecns-brain-extractor/
├── spec.md                       # Feature specification
├── plan.md                       # This file (/speckit-plan)
├── research.md                   # Phase 0: decisions R1–R12, with measured evidence
├── data-model.md                 # Phase 1: config, selection, container, comparison entities
├── quickstart.md                 # Phase 1: how to extract, test, compare and run in the browser
├── contracts/
│   ├── snapshot-format.md        # Container version 2 (binary CSR + JSON header). Replaces ADR D7 JSON.
│   ├── extract-config.md         # Extractor config (ADR D8 keys), CLI and error codes
│   └── integration.md            # world.json `flies.brain.snapshot`, init message delta, `?world=` switch
├── checklists/
│   └── requirements.md           # Spec quality checklist
└── tasks.md                      # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
extract/                                  # Python extraction tool (offline, not served)
├── requirements.txt                      # pyarrow==25.0.1, numpy==2.5.3
├── configs/
│   └── smallest-functional-brain.json    # ADR 002 D8 config for release v1.0
├── malecns_brain/
│   ├── __init__.py
│   ├── __main__.py                       # CLI: extract --config --dataset --out
│   ├── config.py                         # Load and validate config (E-CONFIG)
│   ├── dataset.py                        # Feather reads: column selection, row counts, batched edge stream
│   ├── selection.py                      # ADR D3–D6 rules: admission, sensory, readouts, interneurons, reserved slots
│   ├── container.py                      # Write .brain (header JSON + CSR body), atomic rename
│   └── errors.py                         # Stable error codes
└── tests/
    ├── make_fixture.py                   # Writes the synthetic Feather fixture (labelled as test fixture)
    ├── test_config.py
    ├── test_selection.py
    ├── test_container.py                 # Format, determinism, and contract read-back
    ├── test_cli.py                       # Exit codes, no snapshot on failure, existing file untouched
    └── bench_full_admitted.py            # Format benchmark on the full admitted subgraph (not run by unittest)

public/
├── brains/
│   └── smallest-functional-brain.brain   # Reference container from the real v1.0 extraction (committed, ~1 KB)
├── world/
│   ├── world.json                        # Unchanged default (toy brains)
│   └── world-connectome.json             # Same world, flies.brain.snapshot set (opt-in via ?world=)
└── js/
    ├── brain/
    │   ├── snapshot.js                   # PURE: parse and validate the container (ArrayBuffer → snapshot)
    │   ├── lif.js                        # CSR internal form; accepts edges (toy) or CSR (snapshot)
    │   ├── fly-brain.js                  # Snapshot branch: graph from container, no addMotorDrive
    │   ├── worker-core.js                # Accepts a resolved snapshot in init
    │   └── fly.worker.js                 # Shell: fetches and parses snapshot URL before ready
    ├── fly/fly-host.js                   # BROWSER: validates header once, telemetry bounds, error panel
    └── world/validate.js                 # snapshot rules and conflicts with toy-only fields

scripts/
└── compare-baseline.mjs                  # Four arms: toy, snapshot, size-matched random, baseline

tests/
├── snapshot.test.mjs                     # Parser: magic, version, header length, role order, bounds, truncation
├── lif-golden.test.mjs                   # Toy spike trains bit-identical before and after the CSR refactor
├── fly-brain-snapshot.test.mjs           # Snapshot brain from the synthetic fixture: determinism, roles
├── validate-snapshot.test.mjs            # Conflicts with neuronCount/outDegree/inhibitoryFraction
└── fixtures/
    ├── synthetic-smallest.brain          # Written by extract/tests/make_fixture.py (test fixture, labelled)
    └── small-world.json                  # Existing fixture
```

**Structure Decision**: One offline Python tool in `extract/`, separate from the static app (`public/`), with its own tests and pinned requirements. The app reads only the committed container. The LIF core remains the only simulator file with new internals (CSR), and the toy path is proven unchanged by a golden trace.

## Phase 0 and Phase 1 summary

Decisions R1–R12 with alternatives and evidence are in [research.md](research.md). Entities are in [data-model.md](data-model.md). Interfaces are in [contracts/](contracts/). The run and validation steps are in [quickstart.md](quickstart.md).

Key decisions:

- **R1 Format**: container version 2 = `MFBR` magic, `formatVersion`, a UTF-8 JSON header (provenance, neurons in role order, section table), then CSR arrays: `offsets` (uint32), `targets` (uint32), `weights` (float32), `synapses` (uint16). 10 bytes per edge. Replaces the JSON of ADR D7.
- **R2 Extraction**: one streaming pass over the traced-only edge file that keeps only edges with both ends admitted (about 22M for the full admitted set, held as typed arrays). Selection runs on that in-memory table, so the self-check (E-NONDETERMINISTIC) reruns cheaply.
- **R3 Reserved slots**: after the top-N scoring of D3, the best LEFT-reaching and best RIGHT-reaching candidates are always kept. The rest of the slots are filled by score. Failure (E-NO-PATH) only when a side has no candidate at all.
- **R4 Asymmetry**: no rule change. The report prints the two-hop input totals of both readouts so the asymmetry is visible in every extraction.
- **R5 Config**: exactly the keys of ADR D8. No new knobs.
- **R6 LIF**: CSR internal form for both toy and snapshot, preserving edge order, so the toy trace is bit-identical.
- **R7 Browser loading**: each snapshot worker fetches and parses the container; the host validates the header once and checks telemetry bounds.
- **R8 Switch**: `flies.brain.snapshot` in a world config; `?world=world/world-connectome.json` selects it. The default world is unchanged.
- **R9 Comparison**: four arms over the same seeds and world. The size-matched random control removes the size confound (3 to 11 neurons versus 40).
- **R10 Validation**: Python unittest on a synthetic fixture; Node tests; the real extraction; a format benchmark on the full admitted subgraph (no config mode).
- **R11 Layout and pins**: `extract/` package, stdlib tests, pinned pyarrow and numpy.
- **R12 Synapse bounds**: `synapses` is uint16. A larger count fails with E-OVERFLOW (not reachable on v1.0 traced-only: the largest edge is 2,591).

## Complexity Tracking

| Deviation or addition | Why needed | Simpler alternative rejected because |
|-----------------------|------------|--------------------------------------|
| Binary container replaces ADR D7 JSON | The full admitted subgraph (22M edges) cannot be a browser-loadable JSON. The binary body is 10 bytes per edge, and the JSON header keeps the neuron list readable. | Keep JSON: about a gigabyte at full size, and slow to parse per worker. Two files (manifest + bin): violates the spec's single-file requirement (FR-014). |
| Reserved slots amend ADR D3 | Without them the rule yields no LEFT path on the real data (E-NO-PATH), so the reference brain cannot be built. | Keep the ADR rule: no snapshot ever exists. Raise `maxInterneurons` until LEFT appears: that only moves the search into a config value and still ranks LEFT candidates last. |
| Two new error codes (E-DUP-EDGE, E-OVERFLOW) | A duplicate `(body_pre, body_post)` pair or a synapse count over uint16 would corrupt the CSR silently. | Silent summing or clamping: violates the "fail, don't guess" rule (ADR D6). |
| Full-admitted benchmark outside the app | Principle IV asks that snapshots load in a worker. The full brain (about 221 MB of edges per fly) does not, for six flies, on a laptop. It is measured to prove the format scales, not shipped as a default. | Shipping it as a world option: needs a selection mode outside ADR 002 and a memory budget nobody has set. |
| Snapshot flies share one topology | The brain is the connectome: every fly built from it has the same connections, each with its own state. This changes the "no shared connections" wording of feature 002 FR-002 for snapshot flies only. | Per-fly subsampling: a new random selection outside the ADR. |

## Risks carried into implementation

- **Silent brain.** The toy is silent at `synapticScale` 0.2 (see `fly-brain.test.mjs`). Snapshot weights are similar in size, so the snapshot brain may also stay silent. Calibration is a config change (`flies.brain.lif`), which the comparison will record. Silence is reported per readout, not hidden.
- **LEFT under-driven.** See R4. A LEFT-biased result is expected from the data; the comparison reports it as a finding.
- **Memory.** Six workers each holding the 221 MB full brain would exceed a laptop budget. Not a risk for the reference brain (about 1 KB).
- **Glutamate sign** (ADR Q1) stays inhibitory by default, set in config.
