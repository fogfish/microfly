# Quickstart: Toy LIF Fly Network

**Feature**: `002-toy-lif-fly-network`

This guide shows how to run the automated checks, the ADR Stage 2 metric, and the manual browser checks. It does not repeat the code; see `plan.md` for the layout and `contracts/` for formats.

## Prerequisites

- Node.js 20 or later (tests and experiment only; the app needs no Node).
- A current evergreen browser.
- The repository at its root.

## 1. Automated checks (no browser)

From the repository root:

```sh
npm test
```

This runs `node --test tests/*.test.mjs`. Expected: every test passes. The groups are:

- `lif.test.mjs`: ADR Stage 1 engine checks. Same seed gives the same spike train. Constant drive gives a constant inter-spike interval. The refractory period is respected. Inhibitory edges lower the downstream rate.
- `graph.test.mjs`: fixed out-degree, no self-edges or repeated edges, Dale's law, seeded determinism, and the error when `outDegree >= neuronCount`.
- `fly-brain.test.mjs`: same seed gives the same motor sequence; motor rates stay in `[0, 1]`; sensory drive raises the LEFT rate over time.
- `protocol.test.mjs`: protocol v1 contract, host encode and validation, and worker handler replies on both sides.
- `body.test.mjs`, `stimulus.test.mjs`, `fly-world.test.mjs`: motion, collision, contacts, intensity, spawn.
- `validate-flies.test.mjs`: each invalid `flies` field gives a clear error.

## 2. ADR Stage 2 metric (headless)

```sh
node scripts/compare-baseline.mjs
```

This runs the toy and random-walk baseline in the same world for each seed in `flies.experiment.seeds`, for `flies.experiment.ticks` brain ticks. Output:

```text
seed   toy contacts   baseline contacts
1      …              …
…
total  …              …
toy - baseline: +N   verdict: toy > baseline | toy <= baseline
```

**Pass for Stage 2**: the `toy > baseline` verdict. If it reads `toy <= baseline`, the wiring is the problem (ADR, Stage 2). Check the per-fly motor activity printed with `--verbose` to see whether LEFT or RIGHT stayed silent. Do not start Stage 3 until this passes.

### Recorded result before the resting level (2026-10-04)

```text
seed   toy contacts   baseline contacts
1      0              12
2      0              10
3      0              10
4      0              14
5      0              11
total  0              57

toy - baseline: -57   verdict: toy <= baseline
```

**Finding (fixed, see below): the toy motors never fired, so the toy flies never moved.** With `--verbose`, every toy fly on every seed shows mean LEFT and RIGHT of 0.000 and zero spike ticks. The cause is in the LIF defaults, not the code:

- Activity does not propagate past the sensory neuron. The sensory neuron fires, but no other neuron does, at `synapticScale` 0.2 (the ADR default) and sensory drive from 0 to 0.5.
- With no fruit near a fly, the sensory input is 0, so the network is silent and the fly does not move. The spec (edge case "no fruit nearby") says the fly keeps moving, so this does not meet the spec.
- A probe (not in the repo) found that `synapticScale` 1.0 with a sensory drive of 0.2 makes both motors fire in 29 of 40 random networks. A drive of 0 is still silent at every `synapticScale` tried, so a resting sensory level is also needed.

### Result after the resting level and synapticScale 0.85

Changes: `flies.stimulus.resting` 0.2 is added to the sensory formula (spec: sensory input stays at its resting level), and `flies.brain.lif.synapticScale` is set to 0.85 in `world.json`.

```text
seed   toy contacts   baseline contacts
1      1              12
2      0              10
3      0              10
4      5              14
5      3              11
total  9              57

toy - baseline: -48   verdict: toy <= baseline
```

Motors now fire: about 5% of ticks for LEFT and 6% for RIGHT, summed over all toy flies. A sweep (40 random networks, sensory 0.2) chose 0.85 because it gives both motors firing in 27 of 40 networks without saturating. At 1.0 the motors sit at the refractory ceiling (one spike every three ticks), and the fly drives straight. At 0.5 almost no network drives both motors.

The verdict is still `toy <= baseline`. Per the ADR, the wiring is the problem now, so Stage 3 does not start. The ADR's Stage 2 check is recorded, not tuned to pass.

## 3. Manual browser checks

Start the static server from `public/`:

```sh
cd public && python3 -m http.server 8000
```

Open `http://localhost:8000/`.

| # | Action | Expected |
|---|--------|----------|
| 1 | Load the page | The world appears within 3 s. Six flies are visible and moving. The panel lists six flies, each `running`, labelled "toy (synthetic test fixture)". |
| 2 | Watch for 30 s | Flies move. Their positions change. Contacts increase when a fly reaches fruit. |
| 3 | Click a fly | The readout shows its sensory value, LEFT and RIGHT rates, and spike rows for the telemetry neurons, updating live. |
| 4 | Pan and zoom while flies run | Response stays immediate. No visible stutter at default zoom. |
| 5 | Hide the tab for 10 s, then show it | Flies pause while hidden and resume without a burst of movement. |
| 6 | Open the browser console | No errors while the app runs for 5 minutes. |
| 7 | Set `flies.mode` to `"baseline"` in `world.json`, reload | Flies use the baseline sprite and the panel labels them "baseline". No workers are listed. |
| 8 | Set `flies.brain.outDegree` to `40` (equal to neuronCount), reload | The error panel names `flies.brain.outDegree` and the world does not start. |
| 9 | Remove the `flies` section, reload | The world appears exactly as in feature 001, with no flies. |

## 4. Reproducibility check

Load the page twice with the same `world.json`. Read the first fly's readout for 20 ticks in both runs (the panel can copy the history as JSON). The `sensory`, `left` and `right` sequences are identical for the same tick indices. Wall-clock timing may change where in the sequence a fly is at a given moment, but not the values for a given tick.

## Troubleshooting

- **Blank page or errors on load**: check the error panel. It names the config path that failed.
- **A fly shows `error`**: its readout shows the message from the worker. Other flies keep running (spec FR-021).
- **Module worker fails to load**: serve from `public/` over HTTP, not `file://`.


### Result after the fixed sensory-to-motor edges (wiring rule)

`addMotorDrive` (`public/js/brain/graph.js`) makes the sensory neuron excitatory and adds one excitatory edge to each motor neuron. Random wiring is otherwise unchanged. Result: both motors fire in 198 of 200 random networks at `synapticScale` 0.85 (was 27 of 40 before the rule). All six default flies now move (4.7 to 12.3 tiles in 30 s).

```text
total  11 toy vs 57 baseline   verdict: toy <= baseline
```

Steering is still weak. The sensory input drives both motors equally, so turning comes only from random asymmetry. The verdict is unchanged, and Stage 3 stays off.
