# Quickstart: Cautious Forager Brain (15K, LIF v2)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Contracts**: [contracts/](contracts/)

A runnable guide that shows the feature works end to end. It does not repeat the design; the contracts hold the
formats and the plan holds the structure.

## Prerequisites

- Repository at branch `013-forager-brain-15k-lif-v2`, `npm test` passing (baseline before this feature).
- MaleCNS v1.0 Feather files in `data/malecns/` (not committed), or `MALECNS_DIR` set to their directory.
- Python extractor environment: `extract/.venv` with the pinned `pyarrow`/`numpy` (`extract/requirements.txt`).
- Node 20+ for the tests and the experiment script. A modern browser for the world.

## 1. Unit and contract tests

```bash
npm test                      # all JS tests, including lif-v1-groupgain, fly-brain-v2, snapshot-v5, metrics-v2
extract/.venv/bin/python -m unittest discover -s extract/tests -t extract   # extractor: selection_forager_v2, container v5, config format 4
```

**Expected**: every existing test still passes, unchanged. `tests/lif-golden.test.mjs` (imports `lif-v0.js` only)
and `tests/lif-v1.test.mjs`'s existing G1 assertions are untouched; `tests/lif-v1.test.mjs`'s new `groupGain: {}`
assertion (G16, `contracts/lif-v1-groupgain.md`) passes before any other v2 test runs, per the plan's phase order.

## 2. Extract the earlier formats — unchanged

```bash
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/smallest-functional-brain.json --out ../public/brains/smallest-functional-brain.brain
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain.json --out ../public/brains/forager-brain.brain
```

**Expected**: both reports print exactly as before this feature, and both outputs are byte-identical to the files
committed before this feature apart from `provenance.createdAt` (spec SC-002).

## 3. Extract the 15K brain (format 4 → container 5)

```bash
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain-15k.json --out ../public/brains/forager-brain-15k.brain
```

**Expected report** (ADR 006 Annex A3 at `perPair: 2400`; the numbers below are the targets, not the output):

```text
dataset              male-cns-v1.0 (traced-only)
neurons              ~15,351  (inputs 1,001, outputs 16, interneurons ~14,334)   # Gate A: 12,000–18,000
edges (≥1 synapse)   ~2,034,266
admission source     ground_truth N, consensus_nt N, predicted_nt N              # D10 breakdown
pools                odour-food 138/138, odour-danger 36/36, heat 3/3 (matched)
                     taste-mouth 106/106, taste-leg 123/126, touch 93/93 (unmatched)
pair budget fill     (pathway × outputGroup) 30 pairs, perPair 2,400              # E-PAIR-EMPTY if any empty
outputs              turn-left/right, forward, backward, feed, escape — all reached
real-input coverage  turn 0.91, forward 0.89, backward 0.98, feed 0.97, escape 0.68
weights              synapseCount, minSynapses 1
self-check           identical
```

Run it twice and compare the files: they must be byte-identical apart from `provenance.createdAt` (spec SC-001).

## 4. Choose a brain in the world

Open the app with a static server from the web root:

```bash
cd public && python3 -m http.server 8000
```

| URL | Brain | What to see |
|---|---|---|
| `http://localhost:8000/` | `mock` | Unchanged. |
| `http://localhost:8000/?world=world/world-connectome.json` | `v0` | Unchanged. |
| `http://localhost:8000/?world=world/world-forager.json` | `v1` | Unchanged: four input rows, five output rows, no region-activity section. |
| `http://localhost:8000/?world=world/world-forager-15k.json` | `v2` | Panel names the 15K snapshot. Twelve input rows (food/danger odour, heat, mouth/leg taste, touch — each L/R). Six output rows incl. `escape`. A new "Region activity" section with six rows (input/output/al/vnc/dn/central). |
| `http://localhost:8000/?world=world/world-forager-15k-bad.json` | error | A `v2` world naming a `v4` (not `v5`) file. The error panel names both versions and no fly starts (spec FR-003). |

**Expected**: each world starts with no console error. A `v2` fly that reaches a flower's front-leg site shows
nonzero leg-taste/touch rows before its mouth-taste row goes nonzero (User Story 1); on the flower, its forward
row drops and its feed row rises (User Story 2); near a spider or lantern its odour-danger/heat rows are nonzero
and its steering changes (User Story 3); a blocked front leg changes its turn row, and a high escape row triggers
a visible jump and an "escape" action label (User Story 4).

## 5. Compare the brains

```bash
cd ..   # repository root
node scripts/compare-baseline.mjs --world=world/world-forager-15k.json --brains=mock,v0,v1,v2,random-matched,baseline --json=run.json
```

**Expected**: a table with one row per arm, the five existing forager metrics plus brake, avoid, touch, escape
and rest (ADR 006 Gate C), each with its interval, and the held-out seed count. Brake must pass (lower than 1 and
lower than the random-graph arm's) for `v2`; every other new metric is printed with its measured value regardless
of pass/fail (spec FR-028).

## 6. Browser timing (Gate B)

Run the browser timing harness (`public/tests/forager-v2-timing.html`, added by this feature) on the 15K world.
It runs six `v2` flies and prints the mean and p95 tick time per fly.

**Expected**: the page stays responsive with six `v2` flies at the configured `stepsPerTick`. The measured budget
is recorded with the run (ADR 006 Annex A6 found 1.9–9.4 ms per tick on reference hardware, well inside a 50 ms
world tick).

## Troubleshooting

- **`E-PAIR-EMPTY`**: a `(pathway, outputGroup)` pair in the config has no candidate above a positive score at the
  configured `budget.perPair`. Raise the budget, or check the pathway/outputGroup membership in the config —
  both are config changes, not hand-wired edges.
- **`E-ANCHOR-EMPTY`**: the ALLN anchor filter matched no admitted body; check the admission (`transmitterSource`
  order) actually reaches that class.
- **`E-TRANSMITTER-SOURCE`**: `transmitterSource` names a column the dataset release does not provide; check the
  release and the column names against `dataset.py`.
- **Version error in the world**: the snapshot's container version does not match `flies.brain.version`. `v2`
  needs container version 5 (`v0` needs 3, `v1` needs 4).
- **Undeclared-sense error at world start**: a `v2` snapshot's channel names a `sense` with no matching entry in
  `flies.stimuli`; add the entry rather than letting it read as zero (ADR 006 W6).
- **Panel shows no "Region activity" section**: the loaded snapshot has no per-neuron `group` field — it is a
  `v0`/`v1` container, or an older `v2` snapshot extracted before this field existed. Re-extract.
