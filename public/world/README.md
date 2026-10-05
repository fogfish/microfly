# World definitions

`world.json` is the map the app draws. It is format version 2 (`"version": 2`). The app refuses any
other version and names the version in the error panel.

- Format, coordinates, outlines, groves, scatter, edibles and dangers:
  [specs/005-world-tileset-environment/contracts/world-format.md](../../specs/005-world-tileset-environment/contracts/world-format.md)
- Art: every sprite is an id or a unique name from `assets/atlas/catalog.json`.
- Water: one lake and 2 to 3 ponds, each a `blob` outline. Shores, bank faces and shore decor are
  drawn from the outline (grass shore style of the art pack's water spec). See "Water and shores"
  in the format contract.
- Edibles and dangers: flowers are the only edible; dangers are `spider` and `lantern` (no `fire`).
  They are spread over the whole map: every 16 × 16-cell region holds at least one flower and one
  danger, and flowers are at least 6 cells apart (`public/tests/spread.test.js`).
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

**Calibration.** `brain.lif.synapticScale` (50), `brain.lif.tauAdapt` (20) and `brain.lif.adaptStep` (0.05) were set on the
calibration seeds. The choice and the grid are in `specs/008-hungry-forager-brain/calibration.md`.

**Starting values, not calibrated.** These keep the values they were written with. Changing them is a recorded config
change: `brain.stepsPerTick` (5), `body.energy`, `food` (`consumeRate`, `regrowth`, `eatSpeed`, `feedThreshold`, `sated`),
`stimulus.antennaOffset`, `brain.lif.tauSyn` (0) and `thresholdJitter` (0). The modulator gains in the snapshot are fixed by
ADR 003 D5.
