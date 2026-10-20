# Quickstart: Mushroom-Body Valence Learning

How to check this feature end to end, in gate order. Each step names its pass condition. The formats are in
[contracts/](contracts/) and the measures in [research.md](research.md). Run everything from the repository root.

## 0. Prerequisites

- Node 20+, and the extractor venv (`extract/.venv`) for step 1.
- The dataset at `data/malecns` (git-ignored), needed only for step 1.
- Constitution v2.2.0 (Principle VI learned-gain bullet) and `adrs/011-mb-valence-learning.md` exist.

## 1. Two odours: extract the MB brain

```bash
cd extract && .venv/bin/python -m unittest discover -s tests -t .        # includes E-POOL-OVERLAP tests
MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain-mb.json --out ../public/brains/forager-brain-mb.brain
```

**Pass**:
- the extractor tests are green;
- the snapshot has channel pairs `odour-food-a`, `odour-food-b`, `reinforcement-reward`, `reinforcement-punish`;
- running the extraction twice gives byte-identical files (apart from `createdAt`);
- `forager-brain-wide.brain` is unchanged (`git diff --stat public/brains/` lists only the new files).

## 2. Regime gate (stop here if it fails)

```bash
node scripts/mb-regime-probe.mjs --world=world/world-forager-learning.json --seeds=calibration \
  --out=specs/019-mb-valence-learning/regime-gate.json
```

**Pass**: per odour, an active KC fraction of 5–15 %, same-odour correlation > 0.85, and A–B correlation < 0.7.

On an up-state failure, rerun with `--pathway-gain=<json>` (research.md §3) on calibration seeds only, and record
both runs in ADR 011. If it still fails, ADR 011 records the finding and the feature ends here.

## 3. Teaching-signal probe

```bash
node scripts/mb-teaching-probe.mjs --world=world/world-forager-learning.json --seeds=calibration
```

**Output**: for each of eat (taste plus hunger), heat, touch, danger and escape, whether the reward or punish
dopamine drive is carried by the connectome. ADR 011 lists which `reinforcement:*` events the world declares as
injected.

## 4. Plasticity core

```bash
npm test     # lif-golden (G1), lif-plasticity-golden (G6/G7/G8), learning-v1 reader, protocol additions
```

**Pass**: everything green, including the unchanged `tests/lif-golden.test.mjs`.

## 5. Conditioning probe

```bash
node scripts/mb-conditioning-probe.mjs --world=world/world-forager-learning.json --seeds=held-out \
  --arms=plastic,frozen,shuffled,random --out=specs/019-mb-valence-learning/conditioning.json
```

**Pass (SC-002)**: in the plastic arm, the paired odour's learned-valence shift has the right sign and is larger
than the unpaired odour's, for reward and for punishment, in ≥ 80 % of seeds. Frozen and shuffled do so in ≤ 20 %.
After `tauForget` the shift has decayed towards 0.

## 6. Network-path probe

```bash
node scripts/mb-network-probe.mjs --world=world/world-forager-learning.json --seeds=calibration
```

**Output**: the change in `feed`/`forward` drive for a punished odour against the frozen arm. If the network path
does not carry it (research.md §7), set `flies.body.learning` in the world and record the switch in ADR 011.

## 7. Behaviour experiment

```bash
node scripts/learning-arms.mjs --world=world/world-forager-learning.json --training=B-punished --seeds=held-out
node scripts/learning-arms.mjs --world=world/world-forager-learning-tilemap.json --training=A-punished --seeds=held-out
node scripts/learning-arms.mjs --world=world/world-forager-learning.json --training=A-only --seeds=held-out
```

**Pass**:
- **SC-003**: in the plastic arm, the eat fraction at the punished scent falls by ≥ ⅓ and the stay time there
  shortens, and the other scent falls by less than half as much.
- **SC-004**: the frozen arm shows no significant change.
- **SC-005**: the effect halves by `decaytest`.

The shuffled and random arms are reported, and any null arm that also passes is stated. The results go to
`results.md`.

## 8. Regression and run check

```bash
npm test && npm run test:slow
node scripts/forager-arms.mjs --world=world/world-forager-demo.json --seeds=held-out   # Part K unchanged (FR-027)
cd public && python3 -m http.server 8000
#   http://localhost:8000/?world=world/world-forager-learning.json
```

**Pass**:
- the demo forager's Part K numbers are identical to `specs/017-demo-forager/results.md`;
- the learning world runs 6 flies with no console errors;
- the panel shows per-odour learned gain, dopamine drive, mean `wmod`, and **injected** tags (SC-008);
- the demo world shows "learning off".
