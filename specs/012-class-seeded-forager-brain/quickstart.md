# Quickstart: Class-Seeded Forager Brain

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Contracts**: [contracts/](contracts/)

A runnable guide that shows the feature works end to end. It does not repeat the design; the contracts hold the
formats and the plan holds the structure.

## Prerequisites

- Repository at branch `014-class-seeded-forager-brain`.
- Baseline measured before this feature's implementation: `npm test` reports 470 tests, 464 passing, 6 failing
  in `tests/activity.test.mjs` (pre-existing, unrelated to this feature — a spike-envelope timing test, not
  touched by this plan). Record this baseline before changing anything, so a regression this feature introduces
  is distinguishable from that pre-existing failure.
- MaleCNS v1.0 Feather files in `data/malecns/` (not committed), or `MALECNS_DIR` set to their directory.
- Python extractor environment: `extract/.venv` with the pinned `pyarrow`/`numpy` from `extract/requirements.txt`.
- Node 20+ for the app's tests, the comparison script and the calibration skill. A modern browser for the world.

## 1. Unit and contract tests

```bash
npm test                                                                      # JS: snapshot v4 additions, panel
                                                                               # provenance signals, calibrate engine
extract/.venv/bin/python -m unittest discover -s extract/tests -t extract    # Python: selection_class_seed, config
```

**Expected**: every existing test still passes at its baseline count; the new tests
(`tests/snapshot-v4-additions.test.mjs`, `tests/panel-provenance-signals.test.mjs`, `tests/calibrate-engine.test.mjs`,
`extract/tests/test_selection_class_seed.py`) pass. `tests/calibrate-engine.test.mjs` is the ported, unmodified
branch-013 test — it must pass with no change (research.md §6).

## 2. Extract the existing brains — unchanged

```bash
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain.json --out ../public/brains/forager-brain.brain
```

**Expected**: byte-identical output to the file committed before this feature, apart from `provenance.createdAt`
(spec SC-002). The small-brain and antennal-lobe configs are unaffected the same way.

## 3. Extract the class-seeded brain (format 4, `selection: "classSeed"`)

```bash
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain-11k.json --out ../public/brains/forager-brain-11k.brain
```

**Expected report** (ADR 006 Annex A3/A4; targets, not a copy of the output):

```text
dataset        male-cns-v1.0 (traced-only), minSynapses=5
seeds          ALPN 686, ALLN 420, ALIN+ALON 38, Kenyon_Cell 4064, MBON 97, DAN 340, descending_neuron 1314,
               input pools 138+138, output pools 12                        # every filter non-empty, else E-SEED-EMPTY
fill           2,873 of 11,000 total                                        # E-SEED-OVERFLOW if seeds alone exceed it
edges          ~448,000  (≥ 5 synapses)
fidelity       steering  +1.16e-7 vs whole graph +8.76e-7 (13%)  -> pass
               feeding   +3.1e-6 vs whole graph +4.1e-6           -> pass
self-check     identical
```

Run it twice and diff the files: byte-identical apart from `provenance.createdAt` (spec SC-001). Then rerun with
`fidelity.require: false` in a scratch copy of the config and confirm the file still writes even if a check fails
(edge case: a failing, non-required check is reported, not hidden).

## 4. Choose a brain in the world — mechanism unchanged

```bash
cd public && python3 -m http.server 8000
```

| URL | Brain | What to see |
|---|---|---|
| `http://localhost:8000/` | `mock` | Unchanged. Panel has no provenance/fidelity section (spec FR-023). |
| `http://localhost:8000/?world=world/world-forager.json` | `v1`, shipped forager | Unchanged. Still no provenance section — this snapshot carries none of the new fields. |
| `http://localhost:8000/?world=world/world-forager-11k.json` | `v1`, class-seeded | Panel's new "Brain provenance" section shows `selection: classSeed`, `admission: allTraced`, `minSynapses: 5`, and the fidelity pass/fail state. The brain activity view's legend distinguishes seed from fill neurons. |

**Expected**: all three start with no console error. `flies.brain.version` is `v1` for both the shipped and the
class-seeded world — no new value anywhere (spec FR-002, SC-003).

## 5. Run the calibration skill (quick look only — a full search is a separate, human-paced session)

```bash
node .claude/skills/microfly-calibrate/scripts/calibrate.mjs --version=v1 --stage=classify \
  --out=.claude/skills/microfly-calibrate/runs/v1-quicklook      # known-answer case: confirms the ported skill behaves as it did on branch 013
node .claude/skills/microfly-calibrate/scripts/calibrate.mjs --version=class-seed-11k --stage=classify \
  --out=.claude/skills/microfly-calibrate/runs/class-seed-11k-quicklook
```

**Expected**: the `v1` run reproduces branch 013's known-answer behaviour unchanged (no groups to classify). The
`class-seed-11k` run starts from the profile's `referencePoint()` (v1's calibrated LIF block) and prints which
regions, if any, stay ignited across the scanned scale range — exactly what `classify` already does for `v1`,
since this brain also has a single pseudo-region. A full `--stage=auto`/`--stage=world` run is for a human-paced
calibration session (`SKILL.md`), not part of this check.

## 6. Compare the brains

```bash
cd ..   # repository root
node scripts/compare-baseline.mjs --world=world/world-forager-11k.json \
  --brains=class-seed-11k,v1,v1-selection-rules,random-matched,baseline --json=run.json
```

**Expected**: a table with one row per arm (ADR 006 Gate C), the five forager metrics with their intervals, and
the held-out seed count. A metric the class-seeded brain does not pass is printed as measured, not hidden
(spec FR-025).

## 7. Browser timing (Gate B)

Run the existing browser timing harness (`public/tests/forager-timing.html`) against `world-forager-11k.json`.

**Expected**: the page stays responsive with six class-seeded flies. Record the measured per-step cost against
ADR 006 Annex A6's ≈0.1–0.25 ms estimate (spec SC-004); a large deviation is a finding to record, not silently
absorbed.

## Troubleshooting

- **`E-SEED-EMPTY`**: a seed `class`/`superclass` filter matched no traced body — check the dataset release and
  the filter's spelling against `malecns.md`'s annotation tables.
- **`E-SEED-OVERFLOW`**: the seed classes plus the existing pools already exceed `fill.neuronCount`; raise it
  (ADR 006 D9 — the smallest round size that still passes the fidelity probe was 11,000).
- **`E-FIDELITY`**: the probe's steering or feeding check failed under `fidelity.require: true`. The message
  names which check and both values — this is itself the finding (ADR 006 lesson 7: check fidelity before
  calibration), not something to code around.
- **Panel shows no "Brain provenance" section** for a brain that should have one: confirm the snapshot actually
  carries `selection`/`admission`/`minSynapses` in its header (`container-v4-additions.md`) — the section is
  gated on the derived `"provenance"` signal, not on the brain's name.
- **Version error in the world**: unchanged from the shipped forager brain — the snapshot's container version
  must match `flies.brain.version`; this feature introduces no new version value on either side.
