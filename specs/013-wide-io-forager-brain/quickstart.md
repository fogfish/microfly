# Quickstart: Wide-I/O Forager Brain (Brain v2)

Validation scenarios for this feature, once implemented. Each proves one slice of the spec end to end. Run them
in order; later ones assume earlier ones pass.

## Prerequisites

- Node 20+ (for `npm test` and the dev scripts).
- Python 3 with the extractor's venv set up (`cd extract && python -m venv .venv && .venv/bin/pip install -r
  requirements.txt`), for re-extraction only.
- The MaleCNS v1.0 dataset at `$MALECNS_DIR` (only needed to re-extract `forager-brain-wide.brain`; the JS/panel/
  world scenarios below can run against a committed small fixture snapshot instead — see `extract/tests/fixtures`).

## 1. Extractor: re-extract the wide-I/O brain

```bash
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain-wide.json --out ../public/brains/forager-brain-wide.brain
```

**Expected**: the run prints the seed/fill counts, the twelve-channel × six-output fidelity table, and the six
declared `fidelity.checks` results, all passing (contracts/extract-config-forager-wide.md). Running the command
again produces a byte-identical file apart from `provenance.createdAt` (spec SC-001).

```bash
.venv/bin/python -m unittest discover -s tests -t .
```

**Expected**: every existing test still passes (format 2/3/4 configs untouched), plus the new format-5 tests
(`test_config_forager_wide.py`, `test_selection_class_seed_wide.py`, `test_container_forager_wide.py`).

## 2. JS test suite

```bash
npm test
npm run test:slow
```

**Expected**: every existing test passes unchanged (spec SC-002/SC-003's backward-compatibility claim, exercised in
`world-compat-wide.test.mjs`), plus the new tests: `capabilities-v5.test.mjs`, `snapshot-forager-wide.test.mjs`,
`fly-brain-v2.test.mjs`, `stimulus-declared.test.mjs`, `body-escape.test.mjs`, `forager-step-wide.test.mjs`,
`panel-wide-channels.test.mjs`. `tests/lif-golden.test.mjs` in particular passes with no edit (spec FR-002/plan's
"no LIF mechanism added").

## 3. Run every brain in the browser, including the new one

```bash
cd public && python3 -m http.server 8000
```

Open each in turn, with no console error each time (constitution "Run check", spec SC-003):

- `http://localhost:8000/?world=world/world.json` (mock)
- `http://localhost:8000/?world=world/world.v1.json` (v0)
- `http://localhost:8000/?world=world/world-forager.json` (v1, shipped forager)
- `http://localhost:8000/?world=world/world-forager-11k.json` (v1, 11K)
- `http://localhost:8000/?world=world/world-forager-wide.json` (**v2, new**)

**Expected** on the last one: six flies run; selecting one in the side panel shows twelve labelled input rows
(food/danger odour, heat, mouth/leg taste, touch, each L/R) and six labelled output rows (turn L/R, forward,
backward, feed, escape), each with a live-updating value (spec FR-021/SC-006) — rendered by the existing generic
panel sections, no new UI code. The `escape` row shows a non-trivial value over time while the fly never visibly
jumps, because `flies.body.escape.enabled` defaults to `false` (spec FR-022/SC-008).

**Expected** on every earlier world: the panel is pixel-for-pixel unchanged from before this feature (spec
FR-023/SC-007).

## 4. Exercise escape physics

Edit a local copy of `world-forager-wide.json`, setting `flies.body.escape.enabled: true`, and reopen it.

**Expected**: a fly whose `escape` drive crosses `threshold` jumps once along its heading, then does not jump
again until `cooldown` seconds pass (spec User Story 5, SC-008). Revert the edit (or just stop using the copy) —
no committed file changes for this step.

## 5. Behaviour comparison (Gate C)

```bash
node scripts/forager-arms.mjs --world=world/world-forager-wide.json --seeds=held-out --json=run.json
```

**Expected**: a table with the `wide`, `v1-11k`, `random-matched-wide` and `baseline` arms, reporting find/approach/
eat/leave/hunger-dependence plus brake/stay/avoid/touch, and escape as telemetry only
(contracts/experiment-metrics-wide.md). Any metric that does not pass is printed as failing, with the run and
seeds recorded in `run.json` — not hidden, not adjusted (AGENTS.md).

## Done

All five scenarios passing, plus the plan's Constitution Check re-confirmed, means the feature is ready for
`/speckit-tasks`.
