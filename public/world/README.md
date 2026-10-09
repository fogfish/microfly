# World definitions

`world.json` is the map the app draws. It is format version 3 (`"version": 3`). The app refuses any
other version and names the version in the error panel.

- Format, coordinates, outlines, groves, scatter, edibles and dangers:
  [specs/005-world-tileset-environment/contracts/world-format.md](../../specs/005-world-tileset-environment/contracts/world-format.md)
- Art: every sprite is an id or a unique name from `assets/atlas/catalog.json`.
- Water: one lake and 2 to 3 ponds, each a `blob` outline. Shores, bank faces and shore decor are
  drawn from the outline (grass shore style of the art pack's water spec). See "Water and shores"
  in the format contract.
- Food: one or more edibles per size class, every class present (`small` `red_flower_plant`, `medium`
  `jungle-plant-010`, `large` `jungle-plant-015`; BUG-001 — the shipped worlds carry 5: 2 small, 2 medium,
  1 large). Each names its `sprite`. Odour reach is `flies.stimulus.radius` times the sprite size in tiles,
  so a larger unit smells farther; the peak is the same for every unit, and several units of the same kind
  MAY sit near each other so their odour adds, raising local coverage (spec 009, FR-020). Food sprites are
  never used as decor, and yellow flowers (`trees-plant-001` to `003`) are decor only. The food rules are
  checked in `tests/odour-food.test.mjs` and `public/tests/spread.test.js`.
- Dangers: `spider` and `lantern` (no `fire`). They are spread over the whole map: every 16 × 16-cell
  region holds at least one danger (`public/tests/spread.test.js`).
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
| `v1` | forager brain (ADR 003) | version 4 | `lif-v1.js` | 3 |

The version is optional. Without it, a world with no `snapshot` is `mock`, and a world with one is `v0`, so every existing
world keeps its meaning. A `v1` world needs a version 4 snapshot, and a version 4 snapshot needs `v1`; a mismatch stops the
app before any fly starts, and names both versions. `world-forager-bad.json` is a test fixture that names a version 3 file
under `v1`, so it must refuse to start.

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
