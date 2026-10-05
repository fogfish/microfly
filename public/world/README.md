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
