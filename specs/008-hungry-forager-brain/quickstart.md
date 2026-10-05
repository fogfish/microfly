# Quickstart: Hungry Forager Brain

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Contracts**: [contracts/](contracts/)

A runnable guide that shows the feature works end to end. It does not repeat the design; the
contracts hold the formats and the plan holds the structure.

## Prerequisites

- Repository at branch `008-hungry-forager-brain`, `npm test` passing (257 tests before this feature).
- MaleCNS v1.0 Feather files in `data/malecns/` (not committed), or `MALECNS_DIR` set to their directory.
- Python extractor environment: `extract/.venv` with `pyarrow==25.0.1` and `numpy==2.5.3` (from `extract/requirements.txt`).
- Node 20+ for the tests and the experiment script. A modern browser for the world.

## 1. Unit and contract tests

```bash
npm test                      # all JS tests, including lif-v1, fly-brain-v1, snapshot-v4, protocol-v3, metrics
extract/.venv/bin/python -m unittest discover -s extract/tests -t extract   # extractor: selection_forager, container v4, config format 3
```

Baseline before this feature: `npm test` 257 of 257; the extractor `unittest` suite 95 of 95 (both pass today).

**Expected**: every test passes. The v0 golden LIF test (`tests/lif-golden.test.mjs`) passes unchanged against `lif-v0.js`,
and `tests/lif-v1.test.mjs` shows that `lif-v1.js` with the forager mechanisms off matches it bit for bit (LIF contract G1).

## 2. Extract the small brain (format 2 → container 3) — unchanged

```bash
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/smallest-functional-brain.json --out ../public/brains/smallest-functional-brain.brain
```

**Expected**: the report prints as before and the self-check is `identical`. The output is byte-identical to the file
committed before this feature, except `provenance.createdAt` (spec SC-002). Check the magic `MFBR`, format version `3`,
and the neuron count `11` in the report. The comparison with the committed file ignores that one header field.

## 3. Extract the forager brain (format 3 → container 4)

```bash
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain.json --out ../public/brains/forager-brain.brain
```

**Expected report** (ADR 003 Annex A, measured again here; the numbers below are the targets, not the output):

```text
dataset        male-cns-v1.0 (traced-only)
neurons        ~3,900  (inputs 830, outputs 11, interneurons ~3,000)     # Gate A: 2,000–6,000
edges          ~222,000
odour pools    left 131, right 131 (matched)                             # E-SIDE-IMBALANCE if not equal
taste pools    left 317, right 351 (not matched)
outputs        turn-left 2 bodies, turn-right 2, forward 2, backward 4, feed 2 (MN9: 1 per side admitted)
edges into     DNa01 ~395, DNa02 ~458, DNp09 ~278, MDN ~1018, MN9 ~18    # E-OUTPUT-UNREACHED if 0
weights        min …, max …  (postFraction)
self-check     identical
```

Run it twice and compare the files: they must be byte-identical apart from `provenance.createdAt` (spec SC-001).

## 4. Choose a brain in the world

Open the app with a static server from the web root:

```bash
cd public && python3 -m http.server 8000
```

| URL | Brain | What to see |
|---|---|---|
| `http://localhost:8000/` | `mock` (random toy) | Flies wander as before. Panel says "toy (synthetic test fixture)". |
| `http://localhost:8000/?world=world/world-connectome.json` | `v0` (small brain) | Panel names the snapshot and its release. |
| `http://localhost:8000/?world=world/world-forager.json` | `v1` (forager) | Panel names the forager snapshot. Input rows show four channels (odour L/R, taste L/R). Output rows show five drives. |
| `http://localhost:8000/?world=world/world-forager-bad.json` | error | A v1 world naming a v0 file (test fixture). The error panel names both versions and no fly starts (spec FR-003). |

**Expected**: each world starts, with no console error. A `v1` fly that finds a flower stops on it, its energy rises, and it
walks off when its feed output drops below threshold (spec User Stories 1–3).

## 5. Compare the brains

```bash
cd ..   # repository root
node scripts/compare-baseline.mjs --world=world/world-forager.json --brains=mock,v0,v1,random-matched,baseline --json=run.json
```

**Expected**: a table with one row per arm, the five forager metrics with their intervals, the contacts (printed,
not decisive), and the held-out seed count (30). Every metric is printed with its verdict. A failing metric is reported
as it is (ADR 003 Gate C).

## 6. Browser timing (Gate B)

Run the browser timing harness (`public/tests/forager-timing.html`, added by this feature) on the forager world. It runs six
`v1` flies for 60 seconds and prints the mean and p95 tick time per fly. Record the numbers with the run, not only the
pass or fail.

**Expected**: the page stays responsive with six `v1` flies at `stepsPerTick = 5`. The measured budget is written into
`research.md` R9 when calibration ends.

## Troubleshooting

- **`E-OUTPUT-UNREACHED`**: the feed output (MN9) is thin at the default budget (ADR 003 Q4). Raise the taste budget in
  the config, or add the MN9-presynaptic DNs as a feed pool (both config changes). Do not hand-wire edges.
- **`E-SIDE-IMBALANCE`**: the odour pools differ after matching. Check `rootSide` counts; the pool types in the config should match the dataset release.
- **Version error in the world**: the snapshot's container version does not match `flies.brain.version`. `v0` needs version 3, `v1` needs version 4.
- **Panel shows one input row for v1**: the world is loading a v0 snapshot. Check `flies.brain.version`.
