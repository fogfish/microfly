# Quickstart: validating `outputScale`

Prerequisites: Node 20+ (no install needed — the test suite uses Node's built-in runner, per `AGENTS.md`).

## 1. Regression: existing behavior is unchanged

```bash
node --test tests/lif-golden.test.mjs
```

Expected: passes unmodified. This is **G1** — with `outputScale` defaulting to `null`, `lif-v1.js` must remain
bit-exact to `lif-v0.js` for the golden drive. A failure here means the no-op guarantee was not actually
preserved and nothing else in this feature matters until it is.

## 2. Core mechanism: default no-op, isolation, validation

```bash
node --test tests/lif-v1.test.mjs
```

Expected new assertions, group **L6** (see [data-model.md](./data-model.md) and
[contracts/lif-v1-outputscale.md](./contracts/lif-v1-outputscale.md) for the exact rules):

- **(a) Default no-op**: a network built with `outputNeurons` present but `outputScale: null` produces an
  identical spike train to the same network built with no `outputNeurons` at all.
- **(b) Isolation**: a small synthetic graph — one driven presynaptic neuron feeding two equal-weight targets,
  one declared an output neuron — run at `{synapticScale: 10, outputScale: 2}` shows the output target's spike
  count measurably lower than the non-output target's; run at `{outputScale: null}` the two are equal.
- **(c) Validation**: `resolveParams({ outputScale: -1 })` and `resolveParams({ outputScale: 'x' })` both throw
  the exact message `'LIF parameter "outputScale" must be null or a number of 0 or more'`.

## 3. Integration: effect on the shipped forager brain's `forward`/`feed` channels

```bash
node --test tests/fly-brain-v1.test.mjs
```

This test is skipped automatically when `public/brains/forager-brain.brain` is absent — it needs the extracted
artifact, not the dataset itself. If present, expected: `createFlyBrain({ lif: { synapticScale: 50, outputScale:
5 } })` produces a lower mean spike rate on the `forward`/`feed` output channels than the same run with
`outputScale: null`, same seed, same fixed nonzero input.

## 4. Manual check: the app still starts and runs with no console errors

```bash
cd public && python3 -m http.server 8000
```

Then open `http://localhost:8000/?world=world/world-forager.json` and confirm at least one fly runs with no
console errors — the standard "before a feature is done" check (`AGENTS.md`). This feature does not change the
shipped `world-forager.json`'s `flies.brain.lif` values (no `outputScale` key is added to it as part of this
feature — see [plan.md](./plan.md)'s Summary), so the fly's behavior should be visually unchanged from before
this feature landed.

## 5. Full suite

```bash
npm test
```

Expected: all of `tests/*.test.mjs` pass, including the three above and the unmodified golden regression.

## What this quickstart does *not* cover

Recalibrating the forager brain's actual `synapticScale`/`outputScale` values (ADR 004's "Recalibration
protocol" section — a sweep on calibration seeds, validated on held-out seeds, recorded in
`specs/008-hungry-forager-brain/calibration.md`) is explicitly out of scope for this feature's implementation.
This quickstart only proves the mechanism works and stays a no-op until configured.
