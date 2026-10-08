# Calibration
> 2026-10-07

This document explains how microfly calibrates a brain. It covers why calibration is needed, which parameters it sets, what
they change in the fly's behaviour, and how to run a calibration and record it.

It explains the process. The decisions and their evidence stay where they were made:

- [ADR 003](../adrs/003-hungry-forager-brain.md): the LIF mechanisms L1–L5, the weight rule D4, and open question Q5, which asks for calibration.
- [ADR 004](../adrs/004-output-pool-synaptic-scale.md): the output-pool scale L6 and the **Recalibration protocol**.
- [specs/008-hungry-forager-brain/calibration.md](../specs/008-hungry-forager-brain/calibration.md): the log of every calibration run.
- [specs/008-hungry-forager-brain/gate-c.md](../specs/008-hungry-forager-brain/gate-c.md): the held-out verdict for the shipped brain.
- [public/world/README.md](../public/world/README.md): the seed sets and which world values are calibrated.

## 1. Why calibration is needed

A microfly brain is cut from the MaleCNS connectome. The dataset tells us **which** neurons connect, **how many** synapses
each connection has, and the **sign** of each connection (from the predicted transmitter). It does not tell us how a
synapse count turns into a voltage change, how fast a membrane leaks, or how a neuron adapts. Those are properties of a
model, not of the wiring diagram. A spiking simulation needs them as numbers.

The extractor turns synapse counts into weights with the `postFraction` rule (ADR 003 D4):

```text
weight(i→j) = sign(i) × synapses(i→j) / Σₖ synapses(k→j)
```

Each neuron's input weights add up to at most 1. This keeps the relative strength of the inputs from the connectome, but
the absolute scale is gone. The LIF core multiplies every weight by `synapticScale` when a spike arrives:

```text
v[j] ← v[j] + (dt / tau)(vRest − v[j]) + Σ (weight × synapticScale) − a[j]      // fires when v[j] ≥ vThreshold
```

The median neuron in the forager brain has about 40 inputs, so one spike adds roughly `0.01 × synapticScale` to the target.
That number decides whether the brain does anything:

- **Too small.** With the LIF default `synapticScale = 0.2`, the motor outputs never reach threshold. The fly does not
  move. This was the first observation in the calibration log.
- **Too large.** The densely recurrent interneurons excite each other into continuous firing. Every motor output sits at
  its ceiling whatever the fly smells. The fly runs at full speed everywhere and never slows down to eat. ADR 004 Annex A.1
  measured this on the shipped brain: `forward` and `feed` averaged 0.985 with a standard deviation of 0.035.

Between these extremes there is a range where the network responds to its inputs. That range is not known in advance.
It depends on the size of the cut, the in-degree of each pool and the mechanisms in use, so it must be measured.

The constitution limits how the gap can be closed. Brains come from the dataset, so a connection cannot be added or
reweighted by hand to fix a behaviour (rule 3). The world must not steer, stop or feed a fly (rule 6). That leaves a small
set of global model parameters, set in data (the world config), as the only legitimate lever. Calibration is the
disciplined way to choose them.

## 2. What is calibrated

All calibrated values live in the world config under `flies.brain.lif` and are passed to the LIF core
([lif-v1.js](../public/js/brain/lif-v1.js)). Each value has a default that switches its mechanism off. With all defaults,
`lif-v1.js` matches `lif-v0.js` bit for bit (`tests/lif-golden.test.mjs`).

### Parameters searched so far

| Parameter       | Default      | What it controls                                                                                                                                                                                                                                                      | Source                  |
| --------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `synapticScale` | 0.2          | Potential added per unit of edge weight when a spike arrives. The global gain of the network.                                                                                                                                                                         | ADR 001, D4             |
| `outputScale`   | `null` (off) | Replaces `synapticScale` for edges that end on a declared output neuron. It can be a number for all outputs, or an object keyed by output channel (`feed`, `forward`, `backward`, `turn-left`, `turn-right`). A channel missing from the object uses `synapticScale`. | ADR 004 L6, 010 BUG-002 |
| `tauSyn`        | 0            | Synaptic current time constant. 0 means an arriving spike acts for one step only. A value above 0 spreads it over time.                                                                                                                                               | ADR 003 L1              |
| `tauAdapt`      | 0            | Time constant of spike-frequency adaptation. 0 means no adaptation.                                                                                                                                                                                                   | ADR 003 L2              |
| `adaptStep`     | 0            | How much adaptation grows with each spike. With `tauAdapt`, a neuron that keeps firing becomes harder to drive.                                                                                                                                                       | ADR 003 L2              |

### Shipped values (`public/world/world-forager.json`)

| Parameter       | Value                                                                | Recorded in                                                                          |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `synapticScale` | 50                                                                   | calibration.md, 2026-10-05                                                           |
| `tauSyn`        | 0 (default)                                                          | calibration.md, 2026-10-05                                                           |
| `tauAdapt`      | 20                                                                   | calibration.md, 2026-10-05                                                           |
| `adaptStep`     | 0.05                                                                 | calibration.md, 2026-10-05                                                           |
| `outputScale`   | `{ feed: 30, forward: 2, backward: 5, turn-left: 5, turn-right: 5 }` | **No calibration entry yet.** See [section 6](#6-current-status-and-open-questions). |

### Values not calibrated yet

These keep the starting values they were written with. Changing one is a recorded config change, and each can become a
calibration target later:

- LIF: `thresholdJitter` (0), `stepsPerTick` (5).
- Runner: `motorSmoothing` (0.05).
- World: `food` (`eatSpeed`, `feedThreshold`, `consumeRate`, `regrowth`, `sated`), `stimulus` (`gain`, `resting`,
  `antennaOffset`, `radius`), `body.energy`.
- Snapshot: the hunger modulator gains, which are fixed by ADR 003 D5.

The food placement was recalibrated in feature 009. That was a geometric search for odour coverage
([scripts/food-placement.mjs](../scripts/food-placement.mjs)), not a behaviour calibration. It did not look at what the
flies did. See [specs/009-food-odour-recalibration/results.md](../specs/009-food-odour-recalibration/results.md).

## 3. What calibration changes

The parameters change how the brain's outputs respond to its inputs. Behaviour follows from that through fixed physics:

```text
speed   = maxSpeed × clamp(forward − backward, −1, 1)
turn    = turnRate × (turn-left − turn-right)
eats    ⇔ on a stocked flower ∧ speed < eatSpeed ∧ feed > feedThreshold
```

A fly finds food only if `turn-left` and `turn-right` follow the odour difference between its antennae. It eats only if
`forward` drops and `feed` rises on the same ticks. Calibration decides whether these outputs have room to move, or are
stuck at silence or at the ceiling.

The calibration log shows how strong the effect is. The 2026-10-05 grid, on calibration seeds, 30 flies per row:

| Setting                                   | Find rate | Eating ticks |
| ----------------------------------------- | --------- | ------------ |
| `synapticScale` 20, no adaptation         | 77 %      | 0            |
| `synapticScale` 30, adaptation (20, 0.05) | 87 %      | 0            |
| `synapticScale` 50, no adaptation         | 0 %       | 0            |
| `synapticScale` 50, adaptation (20, 0.05) | 50 %      | 447          |

Lessons from the runs so far:

1. **Finding and eating pull in different directions.** The settings that find food most often walk through flowers
   without stopping. The only setting that ate found food less often. The selection criterion has to name the behaviour
   it wants. The 2026-10-05 run chose "finds food and eats", and so took the eating row.
2. **One global gain cannot serve every pool.** The `feed` pool (MN9) gets its input from only two presynaptic neurons.
   To push it over threshold, `synapticScale` had to rise to 50. At 50 the large interneuron population saturates and
   pins `forward` near 1.0. ADR 004 swept 16 settings and `forward` stayed between 0.98 and 0.99 in all of them. This is
   why `outputScale` exists. It lets the output pools have their own gain, so the bulk of the network can run lower.
3. **One output gain cannot serve every channel.** A single `outputScale` of 5 freed `forward` but starved `feed`. On
   food, `feed` peaked at 0.45, below its 0.5 threshold, and the fly never ate (010 BUG-002). This is why `outputScale` can
   be set per channel.
4. **Some gaps are not parameter gaps.** The 2026-10-07 sweep of `outputScale.feed` from 5 to 40 moved `feed` as expected,
   but near food `speed` stayed at about 2.0, above `eatSpeed` 0.5, for every value. No `feed` value can produce eating
   while `forward` stays high on food. Calibration found the limit and recorded it, and no number was forced to pass.
5. **Gains on calibration seeds can fail to hold.** ADR 004 Annex A.3: `tauAdapt` 40 gave 93 eating bouts on calibration
   seeds, against 7 for the shipped setting. On held-out seeds it reversed two gates that the shipped setting passes:
   hungry flies ate in shorter bouts than sated ones, and found food less often. It was rejected. This is why held-out
   validation is required.

## 4. How calibration works

### 4.1 Two seed sets

Every forager world declares two disjoint seed sets in `flies.experiment`:

- `seeds` (6–10): **calibration seeds**. Every search runs on these.
- `heldOut` (101–130): **held-out seeds**. These are used only to give a verdict on a candidate that already passed
  screening.

A seed fixes the start positions of the flies and each fly's brain seed. The same seed and config give the same run. The
world validator rejects overlapping sets, and `compare-baseline.mjs` refuses to run on held-out seeds that overlap the
calibration seeds. Tuning on held-out seeds would make the Gate C verdict meaningless, because it would measure the fit to
those seeds and not how the brain generalises.

### 4.2 The algorithm

Calibration is a small, explicit grid search with a held-out check:

```text
1. Diagnose.   Run the shipped setting and look at the output drives (silent? pinned at the ceiling?).
               Choose which parameters to search and a coarse grid from the diagnosis.
2. Screen.     For each grid point g:
                 for each calibration seed s:
                   build the world, spawn the main cohort (6 flies, energy 0.3)
                   build each fly's v1 brain with lif = world's lif ⊕ g
                   run 3,000 ticks; record whether the fly reached stocked food,
                   its eating bouts, eating ticks and (optionally) mean drives
               aggregate over all flies: find rate, flies found, bouts, eating ticks
3. Select.     Apply a stated criterion to the screen table, in a stated order. For example (ADR 004):
                 a) far-from-food forward/feed are not pinned near 1.0
                 b) feed still crosses feedThreshold near food
                 c) find rate stays above the random walk
                 d) the fly eats
               No candidate passes  →  stop. Record the finding. Do not change the world.
4. Validate.   Run the candidate on held-out seeds against the null arms (compare-baseline.mjs).
               Gate C: find > random walk; hungry bouts longer than sated; hungry find rate higher than sated.
5. Record.     Add a dated entry to calibration.md: seeds, runs, grid, full table, choice and reason,
               and the held-out verdict, whether it passes or fails.
6. Ship.       Only on a held-out pass, update flies.brain.lif in the world file and its contract.
```

Points about the design:

- **Every other value stays fixed.** A grid point overrides only the keys it names. Everything else comes from the world
  file, so the table compares like with like.
- **Coarse first.** The grids have been small, about 5 to 16 points. A coarse grid shows where behaviour changes. A finer
  search follows only where the coarse one points.
- **Null arms.** `compare-baseline.mjs` runs the brain next to a random walk (`baseline`) and a size-matched random graph
  (`random-matched`), which has the same degrees and weights with random targets. A brain must beat the random walk. The
  random graph shows whether the connectome's structure matters or only its size and weights.
- **A failure is a result.** If nothing passes, the record says so and the world stays as it was. Changing code to make a
  number pass is not allowed (AGENTS.md, "Behaviour failures are findings").

### 4.3 The metrics

| Metric                         | Definition                                                                                           | Used in                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Find rate                      | Share of flies that stand on a stocked food cell at least once in the run.                           | Screen, Gate C (must exceed the random walk) |
| Eating bouts / ticks           | Number of eating episodes and total ticks spent eating, over all flies.                              | Screen                                       |
| Eat                            | Median bout length for hungry starts (energy 0.1) against sated starts (0.9). Hungry must be longer. | Gate C                                       |
| Hunger dependence              | Find rate for hungry starts minus sated starts. Must be positive.                                    | Gate C                                       |
| Approach, leave                | Ticks to first food; share of bouts that end by walking away. Reported, not gated.                   | Gate C                                       |
| `far-*` / `near-*` drive means | Mean of an output drive on ticks off every food source's reach, or on it. Shows saturation.          | Diagnosis (ADR 004 A.2)                      |

## 5. Running a calibration

Requirements: Node 20 or later, and the snapshot `public/brains/forager-brain.brain`. Nothing to install. Run every
command from the repository root.

### 5.1 Check the current state

```bash
# Shipped setting on calibration seeds, all arms
node scripts/compare-baseline.mjs --world=world/world-forager.json

# Shipped setting on held-out seeds (the Gate C verdict)
node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out
```

The output has one row per arm (`mock`, `v1`, `random-matched`, `baseline`) and a PASS/FAIL line per Gate C metric. Add
`--json=<file>` to save the run record and `--brains=<arm>` to run one arm.

### 5.2 Define the grid

The grid is in [scripts/calibrate-forager.mjs](../scripts/calibrate-forager.mjs), in the `GRID` constant. Each entry is a
set of `lif` overrides merged over the world file's `flies.brain.lif`:

```js
const GRID = [];
for (const synapticScale of [10, 20, 30, 50]) {
  for (const tauSyn of [0, 5]) {
    for (const adaptation of [{ tauAdapt: 0, adaptStep: 0 }, { tauAdapt: 20, adaptStep: 0.05 }]) {
      GRID.push({ synapticScale, tauSyn, ...adaptation });
    }
  }
}
```

To search other parameters, edit the loops. For example, a per-channel output sweep:

```js
for (const feed of [10, 20, 30]) {
  for (const forward of [1, 2, 5]) {
    GRID.push({ outputScale: { feed, forward, backward: 5, 'turn-left': 5, 'turn-right': 5 } });
  }
}
```

Two things to watch:

- The merge is shallow. An `outputScale` object in a grid point replaces the world's whole `outputScale`, so list every
  channel you want scaled.
- The script prints only the find rate and eating counts. The `far-*`/`near-*` drive diagnostic from ADR 004 is not in the
  committed script yet. Add it when output saturation is in question.

### 5.3 Run the screen

```bash
# One process
node scripts/calibrate-forager.mjs --world=world/world-forager.json --json=calib.json

# Four parallel shards. Shard k runs grid points k, k+4, k+8, …
for k in 0 1 2 3; do
  node scripts/calibrate-forager.mjs --world=world/world-forager.json --shard=$k/4 --json=calib-$k.json &
done
wait
```

| Flag      | Default                    | Meaning                                             |
| --------- | -------------------------- | --------------------------------------------------- |
| `--world` | `world/world-forager.json` | World file, relative to `public/`.                  |
| `--ticks` | 3000                       | Ticks per fly.                                      |
| `--shard` | `0/1`                      | Run every n-th grid point, starting at k.           |
| `--json`  | none                       | Write `{ seeds, ticks, shard, rows }` to this file. |

The script uses only `experiment.seeds` and never reads `heldOut`. Each row prints the grid point, `found/flies`, find
rate, eating bouts and eating ticks. Keep the JSON files outside the repository, or in the feature's spec folder if they
are the evidence for a decision.

### 5.4 Choose and validate

1. Apply the criterion you wrote down **before** reading the table.
2. If no row passes, stop and go to step 5.
3. Put the candidate into a copy of the world file, or temporarily into `world-forager.json`, and run:

   ```bash
   node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out --json=heldout.json
   ```

4. The candidate passes only if `find`, `eat` and `hunger dependence` all pass and it is no worse than the shipped
   setting on any gate the shipped setting passes.
5. Record the run in `specs/008-hungry-forager-brain/calibration.md` as a new dated section. Use the same layout as the
   existing entries: date, seeds, runs (script and cohort), grid, result table, choice, reason, held-out verdict, and what
   was not searched.
6. On a pass, set the values in `flies.brain.lif`. Update
   [public/world/README.md](../public/world/README.md) and the world-config contract under
   `specs/008-hungry-forager-brain/contracts/`. On a fail, restore the world file.

Before calling the change done, run `npm test` (including `tests/lif-golden.test.mjs`) and open
`http://localhost:8000/?world=world/world-forager.json` from `cd public && python3 -m http.server 8000`. Check that a fly
runs with no console errors.

### 5.5 Rules

- Never tune on held-out seeds. Never pick a candidate by its held-out result.
- Never hand-wire a connection or change world code to make a metric pass. Change config or LIF parameters only.
- Report the random walk and the random graph next to the brain.
- Record every run that changes a value, and every run that would have changed one but failed.
- A new LIF mechanism added for calibration is off by default and keeps `tests/lif-golden.test.mjs` green.

## 6. Current status and open questions

- **Eating is not solved by calibration alone.** The shipped brain finds food above the random walk on held-out seeds.
  Its eating bouts are one or two ticks. The 2026-10-07 `feed` sweep showed that `forward` stays high on food. The next
  steps named in ADR 004 and in 008 BUG-002 are a joint `(outputScale.forward, outputScale.feed)` sweep, or a
  pathway-aware extraction that admits the candidate brake neurons from the connectome.
- **The shipped `outputScale` has no record.** `world-forager.json` sets
  `outputScale = { feed: 30, forward: 2, backward: 5, turn-left: 5, turn-right: 5 }`. The latest calibration.md entry
  (2026-10-07) says the world stays at the scalar 5, and none of the recorded sweeps tried `forward: 2`. This value needs
  its own calibration entry with a held-out verdict, as the protocol in section 4.2 requires, or it should be reverted.
- **The saturation diagnostic is not in the committed script yet.** ADR 004 asks whether the `far-*`/`near-*` drive
  means should become a permanent part of `calibrate-forager.mjs`. The diagnostic would have caught the saturation in
  the first calibration.
- **Most parameters have not been searched.** See [section 2](#values-not-calibrated-yet). The grids so far were coarse.
  The calibration log notes that a finer search around `synapticScale` 40–70 might find more eating with a higher find
  rate.
