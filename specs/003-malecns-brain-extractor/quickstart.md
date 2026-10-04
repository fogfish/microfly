# Quickstart: MaleCNS Smallest Brain Extractor

**Feature**: `003-malecns-brain-extractor` | Run and validation guide. Implementation tasks are in `tasks.md` (not created here).

## Prerequisites

- The MaleCNS v1.0 traced-only dataset on disk (not in the repository). Set `MALECNS_DIR` to the folder that holds the `.feather` files, for example `data/malecns` (git-ignored).
- Python 3.11 or newer, and Node.js 20 or newer.
- A scratch virtual environment for the extractor, outside the repository:

  ```sh
  cd extract
  python3 -m venv .venv            # .venv is git-ignored
  .venv/bin/pip install -r requirements.txt
  ```

## 1. Extract the reference brain (ADR 002, real data)

```sh
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/smallest-functional-brain.json \
  --out ../public/brains/smallest-functional-brain.brain
```

Expected: the report from [contracts/extract-config.md](contracts/extract-config.md), exit status 0, `self-check identical`. Then set `expectedNeuronCount` in the config to the reported neuron count and re-run. The `expect` row counts are dataset facts and do not change for this release. The report prints the readout two-hop inputs (R4): LEFT is expected to be far weaker than RIGHT.

Failure examples to check once each: a wrong `MALECNS_DIR` (E-DATASET-MISSING), a changed `expect.edgeRows` (E-DATASET-ROWS). Each must leave `public/brains/smallest-functional-brain.brain` unchanged.

## 2. Unit and contract tests

```sh
cd extract
.venv/bin/python -m unittest discover -s tests -t .      # Python: config, selection, container, CLI
cd ..
node --test tests/*.test.mjs                              # JavaScript: parser, LIF golden trace, fly brain, validation
```

Expected: all tests pass. The Python contract test reads `tests/fixtures/synthetic-smallest.brain` (written by `make_fixture.py`). The Node parser test reads the same file.

## 3. Format scale benchmark (full admitted subgraph)

```sh
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python tests/bench_full_admitted.py ../data/snapshots/full-admitted.brain
```

Reports neuron count (expected 143,219), edge count (expected 22,082,410), container size (expected about 221 MB of edge sections), write and read time. Not committed; not loaded by the browser by default.

Recorded run (2026-10-04):

```text
neurons        143219
edges          22082410
container      246704832 bytes (235.3 MiB)
write time     1.11 s
read time      0.24 s (read_container, including checks)
```

The counts match the expected values. The wall-clock time was 13.5 minutes but only 52 s of CPU, so the run was limited by reading the 3 GB edge file, not by selection or writing.

## 4. Browser run: toy (default) and snapshot (opt-in)

From the repository root:

```sh
python3 -m http.server 8000 -d public
```

- Default world: `http://localhost:8000/` shows six toy flies, unchanged from feature 002.
- Snapshot world: `http://localhost:8000/?world=world/world-connectome.json` shows six snapshot flies, labelled as connectome snapshot.
- Both: open the inspection readout for one fly, confirm sensory, LEFT and RIGHT values change, and the browser console shows no errors.
- Negative check: edit a copy of the snapshot's version byte to 3 (or point `flies.brain.snapshot` at a missing file) and confirm the error panel names the problem and no fly starts.

## 5. Comparison: random versus nature

```sh
npm run experiment               # four arms over experiment.seeds, prints totals and differences
```

Read the report: `nature − random-matched` is the size-matched comparison; `nature − baseline` is the ADR Gate C reading. A result below the baseline is reported, not hidden (spec User Story 3). If the snapshot brain is silent (readout rates stay at 0), the calibration path is a config change in `flies.brain.lif` (for example `synapticScale`), recorded in the report.

## 6. Done checks (feature level)

- [x] Reference container at `public/brains/smallest-functional-brain.brain` (3,264 bytes), produced by the real run in section 1. Not committed yet; the working tree holds it.
- [x] Extraction report in `extraction-report.md` (counts, readouts, reserved slots, failure contract).
- [x] Format benchmark run once: 143,219 neurons, 22,082,410 edges, 235.3 MiB container, write 1.11 s, read 0.24 s (section 3).
- [x] All Python tests pass: `cd extract && .venv/bin/python -m unittest discover -s tests -t .` gives 51 tests, OK.
- [x] All Node tests pass: `node --test tests/*.test.mjs` gives 145 tests, OK. This includes the toy golden trace, which is unchanged.
- [~] Browser run, headless Chrome (not a hands-on session), 2026-10-04:
  - Default world: six toy flies, labelled "toy (synthetic test fixture)", status running. One application warning, `object rule "fire": placed 10, 2 short of count`, comes from existing terrain code, not this feature.
  - `?world=world/world-connectome.json`: six flies labelled "connectome snapshot (male-cns-v1.0, created 2026-10-04T12:56:29Z)", status running, no application errors.
  - Negative check (world pointing at `brains/missing.brain`): error panel "The world could not be loaded", naming `flies.brain.snapshot` with HTTP 404; no fly list rendered.
  - Not verified: the inspection readout (sensory, LEFT, RIGHT changing). It needs a click on a fly, which the headless DOM dump cannot make.
- [x] Comparison report recorded for the seed list in `comparison.md`. Every brain is below the random-walk baseline (Gate C not met).
- [x] ADR 002 amended (dated "Amendment 2026-10-04"): D3 reserved slots, D7 container version 2, new error codes E-DUP-EDGE and E-OVERFLOW. The original decisions are unchanged.
