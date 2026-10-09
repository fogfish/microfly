# Quickstart: validating pathway-aware interneuron selection

Prerequisites: `extract/.venv` set up (`cd extract && python -m venv .venv && .venv/bin/pip install -r
requirements.txt`), per `AGENTS.md`. The real-dataset steps (4–6) additionally need `MALECNS_DIR` pointing at a
`male-cns-v1.0` checkout.

## 1. Fixture-level correctness (no dataset needed)

```bash
cd extract
.venv/bin/python -m unittest discover -s tests -t .
```

Expect the existing suite to keep passing unchanged, plus new cases in `tests/test_config_forager.py` and
`tests/test_selection_forager.py` (see tasks.md for the exact list): a config omitting `pathwayBias` selects
byte-identically to today; a config declaring a rule whose seed-restricted backward flow admits a body that plain
reachability alone would not; an undeclared `pathway`/`intoOutput` id fails with `E-CONFIG` before any file is
written; an output pool with zero inhibitory in-edges boosts nothing and is not an error.

## 2. Config validation, interactively

```bash
cd extract
.venv/bin/python -c "
from malecns_brain.config import validate_forager
from malecns_brain.errors import ExtractError
import json, copy
base = json.load(open('configs/forager-brain.json'))
bad = copy.deepcopy(base)
bad['pathwayBias'] = [{'id': 'x', 'pathway': 'smell', 'intoOutput': 'forward'}]
try:
    validate_forager(bad)
    print('did not fail')
except ExtractError as e:
    print(e)  # expect E-CONFIG naming the undeclared pathway id
"
```

## 3. Determinism (no dataset needed)

`tests/test_forager_determinism.py` must keep passing unmodified — two extractions of the same config and fixture
still produce identical output.

## 4. Real-dataset extraction (Gate A)

```bash
cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain.json --out ../public/brains/forager-brain.brain
```

Append the printed report (now including the `pathwayBias` boost counts, data-model.md) to
`specs/012-pathway-aware-selection/gate-a.md`, in the same shape as `specs/008-hungry-forager-brain/gate-a.md`.
Check: neuron count still in `neuronCountRange`, every output pool still reached, odour side balance unchanged,
byte-reproducible rerun.

## 5. Topology comparison against the currently-shipped brain

```bash
cd extract && MALECNS_DIR=../data/malecns .venv/bin/python tests/compare_forager_topology.py
```

Runs `select_forager` twice in one process on the live dataset — once with `pathwayBias` forced to `[]` (today's
shipped topology, guaranteed byte-equivalent by contract P1), once as shipped — and prints the `TopologyDiff`
(data-model.md): bodies added/removed per pathway budget, edge-count delta, and whether every added body's
`RuleBackwardFlow` is actually positive (sanity check that the diff is explained by the rule). Append the printed
diff to `specs/012-pathway-aware-selection/gate-a.md` under a "Comparison with the current forager brain" section,
stating plainly whether the difference is significant (any non-zero count is reported as a finding either way,
per `AGENTS.md`'s "behaviour failures are findings" discipline — this script does not pass/fail, it measures).

## 6. Gate B — simulator timing, re-confirmed

No `public/js/`, worker, or LIF change is made by this feature, so a regression is not expected — re-run the
existing harness to confirm, since the admitted neuron/edge count can shift slightly within the same budget:

```bash
# open public/tests/forager-timing.html via: cd public && python3 -m http.server 8000
# six v1 flies, 60 s; record mean/p95 tick time
```

Record the numbers in `specs/012-pathway-aware-selection/gate-b.md`.

## 7. Gate C — behaviour on held-out seeds

```bash
node scripts/compare-baseline.mjs --world=world/world-forager.json --brains=v1,random-matched,mock,baseline \
  --seeds=held-out --json=specs/012-pathway-aware-selection/gate-c.json
```

Write the table and verdicts to `specs/012-pathway-aware-selection/gate-c.md`, same shape as
`specs/008-hungry-forager-brain/gate-c.md`, alongside the pre-feature baseline numbers already recorded there. A
regression on any metric is reported as a finding, not tuned away (spec FR-014).

## 8. App smoke check

```bash
cd public && python3 -m http.server 8000
# open http://localhost:8000/?world=world/world-forager.json — one fly runs, no console errors
```
