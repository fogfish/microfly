# World definitions

`world.json` is the map the app draws: the art pack's reference "Arcade World Map" (`zrpg-art/examples/world.html`,
`WORLD-SPEC.md`) on a 64 × 40-cell grid of 32 px (spec 014 FR-026, [BUG-002](../../specs/014-sketch-world-map/bugs/BUG-002.md)).
It is format version 3 (`"version": 3`). The app refuses any other version and names the version in the error panel.

- The `map` section holds the reference design's data in reference px (`reference: [1376, 768]`): water bodies,
  organic ground areas (swamp, sand beach, rocky desert), trampled-grass trails, the edge-forest band with river
  gaps, groves, mountains, region objects, scatter and the finish. Reference px scale to the grid per axis.
  Contract: [world-format-sketch-map.md §7](../../specs/014-sketch-world-map/contracts/world-format-sketch-map.md).
  `world/sketch-map.js` plans it (pure) and `world/sketch-paint.js` paints it. A world has either `map` or the tile
  sections (`ground`, `waterBodies`, `objects`, `groves`, `scatter`) of the format 005 contract, never both.
- Every 64 × 40 world carries the same `map`; only `edibles` and the `flies` section differ by brain.
- Art: `assets/atlas/` is the zrpg-art catalogue of 2026-10-14 (commit `5d151a3`). The map names sprites as
  `"sheet/name"`, because ids move when the art pack regenerates.
- Water: Lake Joy (with its outlet bay), the north river that enters above the map, the Joy → swamp channel, eight
  swamp pools, Lake Byte (west lobe and island), and the south river that leaves below the map. Logic water is a
  cell whose centre is drawn water. Heat is the 100%/50%/25% ring from water (`"from": "water"`,
  `world/heat-field.js`). The reference water leaves no zero-heat crossing: the walkable crossing runs between
  the swamp pools at heat ≤ 50% (`tests/water-corridor.test.mjs`, BUG-002 finding).
- Food presentation: `edibleStyle` (optional) draws a ground marker under each food unit (`trees/light_meadow_patch_a` on
  grass, `beach/sand_splat` on the dunes) and draws the small flower at 1.5×. Visual only; contract [world-format-v3.md §8](../../specs/009-food-odour-recalibration/contracts/world-format-v3.md).
- Heat over the swamp: `flies.heatQuiet` (demo world only: `["swamp"]`) takes the heat ring off the swamp cells, so the fly can cross it. Contract: [world-format-sketch-map.md §3](../../specs/014-sketch-world-map/contracts/world-format-sketch-map.md).
- Demo fly art: the demo world draws its flies from `public/assets/fly/fly.png` (256 × 256, rotated to face up), drawn at 64 × 64 px through `{ "image", "size" }` sprites. Contract: [fly-sprite.md §6](../../specs/009-food-odour-recalibration/contracts/fly-sprite.md).
- Dead edge forest: `map.border.dead` (`{ area, trees, blend }`) makes every border tree inside the named ground
  `dead` (`beach/dead_gnarled_tree`) with chance `density` (0.33), and fades that chance to live over `blend` ref px (200), so the live forest and the
  dead one meet in a gradual mix. Contract: [world-format-sketch-map.md §7](../../specs/014-sketch-world-map/contracts/world-format-sketch-map.md).
- Edge forest: cells whose centre lies in the ragged border band (outside the river gaps) are edge forest, the only
  source of danger odour: 100%/50%/25%/0% over three tile-steps (`"from": "forestEdge"`, `world/danger-field.js`).
  There is no point-source `dangers` list (spec 014 research.md R10).
- Food: one or more edibles per size class, every class present (`small` `red_flower_plant`, `medium`
  `jungle-plant-010`, `large` `jungle-plant-015`), unchanged by the map. Odour follows the irregular,
  stepped food field (`world/food-field.js`): a 3×3 full-strength core, falling off roughly 10% per
  noise-roughened ring beyond it; several units combine by maximum (not sum), and are placed so neighbouring
  footprints touch, forming one connected trail across the map (spec 014 FR-012 to FR-015). No solid scenery
  stands in a unit's 3×3 eating square. Food sprites are never decor, and yellow flowers (`trees-plant-001` to
  `003`) are decor only.
- Every solid map sprite (tree, bush, rock, prop: border and grove trees, mountains, region objects, scatter stones
  and bushes) blocks its foot cell, so the `touch` sense (`"from": "blocked"`) reports contact on it. Plants and
  shore decor are drawn, not solid.
- Fly sprites are 32 × 32 pixels (one map cell), drawn head-up. There is a female and a male variant
  (`fly-female`, `fly-male`), each with its own baseline colour pair; `flies.sex` picks which pair each fly
  uses (spec 009 contracts/fly-sprite.md, BUG-002).
- Fly art and the `flies` section: [specs/002-toy-lif-fly-network/contracts/fly-config.md](../../specs/002-toy-lif-fly-network/contracts/fly-config.md)

`world.v1.json` is the old format-1 map, kept only for comparison. The app does not load it.
`world-connectome.json` is format version 2. It has the same map as `world.json`, with the
connectome brain (`?world=world/world-connectome.json`).
`world-antennal-lobe.json` is the same map with the antennal-lobe brain
(`brains/antennal-lobe-brain.brain`, from `extract/configs/antennal-lobe-brain.json`) and the LIF
settings it was tuned with (`?world=world/world-antennal-lobe.json`).

## Choosing the brain: `flies.brain.version`

`flies.brain.version` selects the brain stack (specs/008-hungry-forager-brain/contracts/world-config-forager.md):

| Version | Brain | Snapshot | LIF | Protocol |
|---|---|---|---|---|
| `mock` | toy random graph (`neuronCount`, `outDegree`, `inhibitoryFraction`) | none | `lif-v0.js` | 2 |
| `v0` | small connectome brain (ADR 002) | version 3 | `lif-v0.js` | 2 |
| `v1` | forager brain (ADR 003), kind `"forager"` | version 4 | `lif-v1.js` | 3 |
| `v2` | wide-I/O forager brain (ADR 007), kind `"forager-wide"` | version 4 | `lif-v1.js` (unchanged) | 3 |
| `v3` | demo forager brain (ADR 010): decoded readout + body layer, same `"forager-wide"` snapshot as `v2` | version 4 | `lif-v1.js` (+ `baselineCurrent`, off by default) | 3 |

The version is optional. Without it, a world with no `snapshot` is `mock`, and a world with one is `v0`, so every existing
world keeps its meaning. A `v1` world needs a version 4 snapshot of kind `"forager"`, and `v2`/`v3` need kind
`"forager-wide"`; a version or kind mismatch stops the app before any fly starts, and names both sides.
`world-forager-bad.json` is a test fixture that names a version 3 file under `v1`, so it must refuse to start.
`"v2"` runs the identical `lif-v1.js`/`fly-brain-v1.js` path as `"v1"` (ADR 007: "v2" names the wider interface
generation, not a new LIF core) — it only senses generically from each channel's declared `sense`/`site`
(`forager-step-wide.js`) instead of `v1`'s four hard-coded inputs, and gains `flies.stimuli`, `flies.body.sites`
and `flies.body.escape` in place of `v1`'s singular `flies.stimulus`.

`"v3"` (ADR 010, contracts/world-config-v3.md in `specs/017-demo-forager/`) keeps `v2`'s sensing unchanged but
replaces its hard-wired motor path with a decoded readout: `flies.brain.decoder` names a `decoder-v1` sidecar
file (`<snapshot-basename>.decoder.json`, next to the `.brain` file) that declares which pools of neurons carry
each sense's side/drive signal and its approach/avoid/none valence — produced by a calibration run
(`.claude/skills/microfly-calibrate`), never hand-wired. A `v3` world additionally requires
`flies.body.locomotion` and `flies.body.backup` (the declared nerve-cord stand-in's walking/steering/backing-up
parameters, `public/js/fly/body-layer.js`), and may set `flies.modulators.hunger.threshold` to reshape the hunger
gain curve (default: today's linear curve, unchanged).

## The forager world: `world-forager.json`

The same map as `world.json`, with the forager brain (`brains/forager-brain.brain`, from
`extract/configs/forager-brain.json`), hunger and energy (`body.energy`), flowers that deplete and regrow (`food`), and
bilateral odour (`stimulus.antennaOffset`). Open it with `?world=world/world-forager.json`.

Its experiment has two seed sets:

- `experiment.seeds` (6–10) are the **calibration** seeds. Calibration (`scripts/calibrate-forager.mjs`) uses only these.
- `experiment.heldOut` (101–130) are the **held-out** seeds for Gate C. They must not overlap the calibration seeds, and
  the world validator checks it. Run the comparison on them with
  `node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out`.

**Calibration.** `brain.lif.synapticScale` (50), `brain.lif.inhibitoryScale` (1), `brain.lif.noiseAmplitude` (0.08)
with `brain.lif.noiseBulkScale` (0: noise on the odour and taste pools only), `brain.lif.outputScale` (per channel),
`brain.motorSmoothing` (0.02) and `stimulus.resting` (0.02) were set on the calibration seeds with the staged,
regime-gated protocol of ADR 005 Annex B (`scripts/calibrate-forager.mjs`), and passed the held-out find gate (51.7 %
vs the random walk's 23.3 %). The forager walks with no odour, steers on odour, and does not brake to eat; the brake is
left to the next brain generation. `brain.lif.tauAdapt` (20) and `adaptStep` (0.05) were held from the first
calibration. The choices and grids are in `specs/008-hungry-forager-brain/calibration.md`.

**Starting values, not calibrated.** These keep the values they were written with. Changing them is a recorded config
change: `brain.stepsPerTick` (5), `body.energy`, `food` (`consumeRate`, `regrowth`, `eatSpeed`, `feedThreshold`, `sated`),
`stimulus.antennaOffset` and `thresholdJitter` (0). `brain.lif.tauSyn` (0) was on the regime grid and stays 0. The modulator gains in the snapshot are fixed by
ADR 003 D5.

## The class-seeded forager world: `world-forager-11k.json`

The same map, body, food and stimulus as `world-forager.json`, with the class-seeded brain
(`brains/forager-brain-11k.brain`, from `extract/configs/forager-brain-11k.json`, ADR 006). `flies.brain.version`
is still `"v1"` — this brain runs under the unchanged `v1` stack; only the snapshot differs. Open it with
`?world=world/world-forager-11k.json`. Its `brain.lif` block is this brain's own calibration result, found with
the `microfly-calibrate` skill's `class-seed-11k` profile, not a copy of `world-forager.json`'s. Its
`experiment.seeds`/`heldOut` split is the same as `world-forager.json`'s own (calibration 6–10, held-out
101–130); nothing requires the two worlds' seed sets to differ. `world-forager-11k-bad.json` is a test fixture
that names this brain's (version 4) snapshot under `v0`, so it must refuse to start — the same mechanism
`world-forager-bad.json` already exercises for the shipped forager brain.

## The wide-I/O forager world: `world-forager-wide.json`

The same map and body/food/escape mechanics as the other forager worlds, with the wide-I/O brain
(`brains/forager-brain-wide.brain`, from `extract/configs/forager-brain-wide.json`, ADR 007) under
`flies.brain.version: "v2"`. It re-extracts the 11K brain's own topology rule (seeds, fill, weights
unchanged) with twelve bilateral inputs (food odour, danger odour, heat, mouth taste, leg taste, touch) and
six outputs (turn L/R, forward, backward, feed, escape), and adds every presynaptic partner of the output pools
as a seed, at 14,500 neurons (ADR 009). Open it with `?world=world/world-forager-wide.json`.

Two new `flies` sections replace `v1`'s singular `flies.stimulus` and add escape physics:

- `flies.stimuli`: one entry per `sense` a channel declares (`odour:food`, `odour:danger`, `heat`, `taste`,
  `touch`), naming which world source it reads: `edibles` or `dangers` (falloff over an object list, with a
  radius), `blocked` (touch, read directly from world walkability), or `water`/`forestEdge` (spec 014: a
  precomputed ring field, no radius — `odour:danger` and `heat` read `forestEdge`/`water` on the shipped
  world). A snapshot channel whose `sense` has no matching entry here is a world-load error, naming the
  channel.
- `flies.body.sites`: one entry per `site` a channel declares (`antenna`, `mouth`, `front-leg`), each a
  forward/lateral offset in tiles from the body centre. `mouth` has no lateral offset by design, so its left
  and right channels read the same value; `front-leg` sits half a tile ahead, so leg taste and touch reach a
  flower or a blocked cell before the mouth does.
- `flies.body.escape`: `enabled` (default `false`), `threshold`, `distance`, `cooldown`. The `escape` output is
  always computed and shown; with `enabled: false` it moves nothing (ADR 007 D17) — set it `true` locally to
  exercise the physics, but do not commit that change (the shipped default stays off).

Its `experiment.seeds`/`heldOut` split is the same convention as the other forager worlds. Its `brain.lif`
block is a placeholder (a copy of the 11K world's own calibrated block) until the `microfly-calibrate` skill's
`wide-io` profile has run a real calibration session (research.md R11 of specs/013-wide-io-forager-brain) —
`results.md` records which run, if any, that value came from. `world-forager-wide-bad.json` is a test fixture
that names this brain's snapshot (kind `"forager-wide"`) under `v1`, so it must refuse to start on the kind
mismatch, the same mechanism `world-forager-11k-bad.json` exercises for a version mismatch.

## The mushroom-body learning worlds (ADR 011): do not currently load a fly

`world-forager-learning.json` (sketch map) and `world-forager-learning-tilemap.json` (a second, structurally
distinct tile-section map) name the two-food-odour brain (`brains/forager-brain-mb.brain`, from
`extract/configs/forager-brain-mb.json`) and its learning sidecar (`brains/forager-brain-mb.learning.json`,
contracts/learning-v1.md), with flowers tagged `scent: "fruit"`/`"floral"` and `flies.stimuli["odour:food-a"]`/
`["odour:food-b"]` reading them. **They name no `flies.brain.decoder` file that exists** —
`brains/forager-brain-mb.decoder.json` was never produced, because ADR 011's regime gate (FR-008's hard stop on
this feature) rejected the brain before decoder calibration was attempted: the KC population is in an up-state
(fires for almost any input) even after the one allowed remedy. Opening either world in the app will fail to
start a fly (404 on the decoder fetch). See `adrs/011-mb-valence-learning.md` and
`specs/019-mb-valence-learning/regime-gate.md` for the measured finding.
