# Quickstart: validating the dynamical regime

Prerequisites: Node 20+, the Python extractor's venv (`cd extract && python -m venv .venv && .venv/bin/pip install
-r requirements.txt`), and the MaleCNS dataset at `data/malecns` (present in this environment; see `malecns.md`).

## 1. Unit and contract tests (no dataset needed)

```bash
npm test                                  # includes new tests/lif-v1.test.mjs group L7 (G11-G15) and
                                           #   tests/lif-golden.test.mjs (G1 regression, must be unmodified)
cd extract && .venv/bin/python -m unittest discover -s tests -t .
                                           # includes the new weightRule "postFractionAbsolute" test module
```

Expected: every test passes, including the new L7 and `postFractionAbsolute` groups, with `lif-golden.test.mjs`
unchanged (confirms `noiseAmplitude: 0` and `weightRule: "postFraction"` are both true no-ops, per
`contracts/lif-v1-noise.md` G11 and `contracts/weight-rule-absolute.md`'s regression requirement).

## 2. Re-extract the forager brain under the new weight rule

After `extract/configs/forager-brain.json` is updated to `weightRule: "postFractionAbsolute"` (ADR 005
recalibration protocol step 1):

```bash
cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain.json --out ../public/brains/forager-brain.brain
```

Expected: the extractor's self-check passes, the report shows the same neuron/edge counts as the current shipped
brain (selection is unaffected by this feature — only the weight *values*, per `data-model.md`), and running the
command twice gives a byte-identical file apart from `provenance.createdAt` (determinism, per `weight-rule-
absolute.md`).

## 3. Recalibration sweep (ADR 005 "Recalibration protocol")

Extend `scripts/calibrate-forager.mjs` with the three diagnostics (saturation, pool-synchrony, sensory-gradient;
`data-model.md`'s Calibration Record), then sweep on calibration seeds only:

```bash
node scripts/calibrate-forager.mjs --world=world/world-forager.json --seeds=calibration
```

Expected: at least one grid point shows (a) `far-forward`/`far-feed` with real headroom below the firing ceiling,
not pinned near 1.0; (b) a sensory pool's lockstep fraction well below 1.0 at the candidate `noiseAmplitude`; (c)
measured firing rate at several fixed odour intensities passing through more than three distinguishable levels.

## 4. Held-out validation (non-negotiable before adopting any candidate)

```bash
node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out
```

Expected: find rate, eat-bout gates, and hunger-dependence gates reported alongside the random-walk and
size-matched random-graph baselines (re-run under the new weight rule, per spec Edge Cases), all passing on the
candidate chosen in step 3 — not only on the calibration seeds. Record the result, pass or fail, as a new dated
entry in `specs/008-hungry-forager-brain/calibration.md` (ADR 005 protocol step 5).

## 5. Ship and smoke-test

Only after a held-out pass: update `world-forager.json`'s `flies.stimulus`/`flies.brain.lif` to the validated
values, then:

```bash
cd public && python3 -m http.server 8000
#   http://localhost:8000/?world=world/world-forager.json
```

Expected: the world loads, at least one fly runs, no console errors (`AGENTS.md`'s run check) — confirming the
recalibrated world config validates (`validate.js`) and the new `.brain` snapshot loads under container v4 with the
`postFractionAbsolute` header.
