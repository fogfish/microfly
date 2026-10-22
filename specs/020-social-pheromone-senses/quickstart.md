# Quickstart: Social and Pheromone Senses

These are the validation runs for the phases in [plan.md](plan.md). The shapes are in [contracts/](contracts/), and
the definitions are in [research.md](research.md).

## Prerequisites

- The dataset is in `data/malecns`, and the extractor venv is set up (`AGENTS.md` Commands).
- Node 20+.
- The MB brain (spec 019) ships as it is today.

## A. Extract and check (SC-001)

```bash
cd extract
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain-social.json --out ../public/brains/forager-brain-social.brain
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain-social.json --out /tmp/social-2.brain
# byte-identical apart from provenance.createdAt
.venv/bin/python -m unittest discover -s tests -t .
```

Expected:
- `contact-pheromone` has 69 L and 67 R neurons. `odour-conspecific` has 89 L and 254 R neurons, plus the
  unknown-side drops.
- `taste-leg` holds the same `bodyId`s as `forager-brain-mb.brain`.
- Every seed type matched.
- Re-extracting `forager-brain-mb.json` gives the shipped hash.

## B. Fidelity

```bash
cd extract && MALECNS_DIR=../data/malecns .venv/bin/python ../scripts/connectivity-audit.py \
  --config configs/forager-brain-social.json --snapshot ../public/brains/forager-brain-social.brain \
  --sections coverage,paths,bridges,readout
```

Record in `fidelity.md`:
- the conspecific and contact contrasts, brain over whole graph;
- the VL2a variant;
- every existing check, which must still pass.

## C. Claims, C2 and ADR 012 (SC-002)

Use the `microfly-calibrate` skill, profile `social-v3`, stages C1 (confirm only) and C2, on calibration seeds. Then:
- write `claims.md`: the linear sign per social pair against turn, forward, backward and song;
- write the decoder file;
- fill in the ADR 012 valence table.

Expected: the decoder has `drive.*` pools for the social pairs, or a recorded `E-DECODE-*` finding, and a `song` pool.
Each social pair's valence is `approach`, `avoid` or `none`, with its source.

## D. World (SC-003, SC-007, SC-008)

```bash
npm test
node --test tests/slow/social-two-fly.test.mjs
cd public && python3 -m http.server 8000
# http://localhost:8000/?world=world/world-forager-social.json
```

In the browser:
1. Turn on the `odour-conspecific` overlay. It follows the flies.
2. Select a fly. The panel shows its sex tag ("female (male connectome)"), its L/R social inputs labelled with their
   valence, and its song state.
3. Bring two flies together. The contact input fires on the touching leg's side.
4. The console shows no errors, with 6 flies running.
5. The existing worlds (`world-forager.json`, `world-forager-demo.json`, `world-forager-learning.json`) still load.

## E. Calibrate

On calibration seeds only, tune these and note each value with the run behind it in `calibration.md`:
- `radius`, `contrast`;
- emission per sex;
- `bodyRadius`;
- `song.threshold`, `song.tau`;
- `solid`.

## F. Experiment (SC-004, SC-005)

```bash
node scripts/social-arms.mjs --world=world/world-forager-social.json --seeds=held-out \
  --arms=social,ablated,random-graph,random-walk --out=specs/020-social-pheromone-senses/results.json
node scripts/social-arms.mjs --world=world/world-forager-social.json --seeds=held-out --no-social-stimuli \
  --arms=social --out=specs/020-social-pheromone-senses/results-no-social.json
```

Expected in `results.md`:
- the SC-004 verdict: `social` time near and contact rate above `random-graph` and `random-walk`, with 95 % CIs that
  do not overlap, or the finding;
- the `ablated` arm next to it;
- the sex split;
- the song per contact against song alone;
- with no social stimuli, the food and danger measures within the MB brain's spread.
