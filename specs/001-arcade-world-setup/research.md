# Research: Arcade World Setup

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-04

This file resolves every open question for the plan. Each entry gives the decision, why it was chosen, and what was rejected.

---

## R1. Reuse the repo's `assets/` folder or find new open assets?

**Decision**: Find new assets. Do **not** ship the existing files (`assets/tilemap.json`, `assets/town.json`, `assets/gentle-obj.png`, `assets/rpg-tileset.png`) in `public/`. Leave them untouched in `assets/` as reference only.

**What the existing files are** (inspected):

| File | Format | Notes |
|------|--------|-------|
| `assets/tilemap.json` | Tiled 1.10 JSON map, orthogonal, 40×40 tiles of 16 px | Layers `terrain`, `bridge`, `deco`, `monsters` (objects), `npcs` (objects), `zones` (objects). Tileset image `environment/rpg-tileset.png`, 1600×1600, 100 columns, 10,000 tiles. Tile properties include a `collides` flag. |
| `assets/town.json` | Custom JSON, not Tiled | Keys: `tileset` `gentle-obj.png`, `tile` 32, `width` 45, `height` 32, `tilesetCols` 45, and arrays `bg`, `obj`, `anim`, `water`. `anim` entries reference `campfire.json`. |
| `assets/gentle-obj.png` | PNG 1440×1024, RGBA | 32 px tileset used by `town.json`. |
| `assets/rpg-tileset.png` | PNG 1600×1600, RGBA | 16 px tileset used by `tilemap.json`. |

**Why not reuse them**:

1. **Provenance is unverified.** The layout (`bg`/`obj`/`anim`/`water` arrays in `town.json`, and the `terrain`/`bridge`/`deco`/`zones` layers in `tilemap.json`) looks like map data from the ai-town project. The user excluded anything taken from its ReactJS app. Because the map data lives in that app, we treat it as excluded too unless the owner confirms otherwise.
2. **Licence unknown.** Neither file carries a licence header. The `rpg-tileset` art style matches community RPG tile sets that are often CC-BY or CC-BY-SA, which would require attribution or share-alike terms. We could not verify this from the repo.
3. **Format mismatch.** Two different tile sizes (16 px and 32 px) and two different map formats would need two loaders. The config-driven design needs one.

**Rejected alternative**: Reuse both files and add an attribution note. Rejected because the licence cannot be confirmed and the user asked for no ReactJS-derived assets. The decision is reversible: if the owner confirms the licence, a sprite entry in `world.json` can point at `assets/gentle-obj.png` without any code change.

---

## R2. Which open asset sources supply terrain and scenery?

**Decision**: Use **Kenney's CC0 pixel packs**, in particular the 16×16 Roguelike/RPG pack (1,700+ tiles, which includes trees, bushes and hedges). Confirm during implementation that it has grass, water and rock tiles. If it does not, use the Kenney Tiny series instead (also CC0). Record every chosen tile in `public/assets/ATTRIBUTION.md` with its sheet, file name and coordinates.

**Evidence**: Search results show the Roguelike/RPG pack is CC0, with trees, bushes and hedges, and that a 16×16 conversion of Kenney's pixel tiles is also CC0. Kenney's licence is public domain, so attribution is not required, but it is recorded anyway.

**Open point**: The exact contents of the water and rock tiles were not confirmed by search. Implementation has to check the sheet before writing `world.json`. If the pack does not have a water tile, add one from a second CC0 pack. The config contract does not change either way.

**Rejected alternatives**:
- *Gentle/LPC packs on OpenGameArt*: Mixed licences (some CC-BY-SA), so each tile would need its own attribution and share-alike check. Too much licence risk for a first version.
- *Commercial packs* (for example "Tiny Creatures" and "16x16 Pixel Fruit Sprite Sheet"): listed as purchase links in search. Excluded because they are paid and the project has no budget line for them.

---

## R3. Where do fruit, honey, fire and spider sprites come from?

**Decision**: Author them in the project as small inline pixel-art grids. Each sprite is 16×16 or smaller, written as a string grid with a palette in `world.json`. The config contract (`contracts/world-config.md`) supports this as the `pixels` sprite form.

**Why**: Search found no CC0 pack that clearly covers fruit, honey, fire and spider together in one consistent 16 px style. Authoring them keeps the style consistent and the licence clean (project-owned). Keeping them inline in `world.json` means a designer can change a sprite by editing JSON, which is the spec's "configurable" goal.

**Rejected alternative**: Mix art from several packs. Rejected because the styles would clash and the licences would need separate checks.

**Consequence**: Sprite art is hand-drawn in the first version. It can be replaced later with a sheet by using the `sheet` form of the same sprite contract.

---

## R4. Rendering technology

**Decision**: Canvas 2D on the main thread, with `imageSmoothingEnabled = false` for crisp pixels. Sprites are either drawn from a sheet image or rendered once into an offscreen canvas from their pixel grid. The renderer draws only the tiles and objects inside the viewport.

**Rationale**: Canvas 2D is in the constitution's required API list, needs no library, and handles 10,000 tiles comfortably when culled. An offscreen cache for pixel-grid sprites means each sprite is parsed once.

**Rejected alternatives**:
- *WebGL / WebGPU*: Allowed by the constitution only if justified. Not justified here: the world is small and 2D.
- *One DOM element per tile*: Too slow for zooming and panning at 10,000 cells.
- *A game framework (Phaser, PixiJS)*: Would be a vendored third-party library, which Simplicity (VII) rejects for this scope.

---

## R5. Zoom and pan model

**Decision**: The camera holds `{ x, y, zoom }` where `(x, y)` is the world-space point at the top-left of the canvas, measured in world pixels, and `zoom` is screen pixels per world pixel. Zoom uses the anchor rule: the world point under the cursor is unchanged. Pan subtracts the drag delta divided by zoom. After every change the camera clamps so the viewport stays inside the world bounds (or centres the world if it is smaller than the viewport).

**Zoom steps**: Each wheel event multiplies zoom by `1.1` (out) or `1/1.1` (in), clamped to `zoom.min` and `zoom.max` from the config. `deltaY` magnitude is ignored so fast wheels do not jump past the limits (spec edge case).

**Rationale**: The anchor rule is a standard, testable calculation. It is pure math, so it lives in `camera.js` and has unit tests.

**Rejected alternative**: Zoom around the viewport centre. Rejected because the spec requires zoom to keep the cursor point fixed (FR-008).

---

## R6. World generation and reproducibility

**Decision**: Generation is a pure function `generate(config) -> { grid, objects }`.
1. A seeded PRNG (mulberry32) takes `config.seed`.
2. Terrain: start with the base terrain, then lay down water lakes and rock outcrops from seeded value noise, then tree groves on grass. The layer order and thresholds come from the config.
3. Objects: for each scatter rule in the config (fruits, honey, fires, spiders, rocks, trees), pick positions with the PRNG. A position is valid only if the cell's terrain is in the rule's `allowedTerrain` and it is not closer than `minSpacing` to another placed object. If no valid cell is found after a bounded number of attempts, the object is skipped and the shortfall is reported in the result.

**Why**: The spec requires identical output for identical configs (FR-013, SC-006). Every random choice goes through one seeded stream in a fixed order, so the output is deterministic. The bounded retry means generation always finishes.

**Rejected alternative**: `Math.random()`. Rejected because the output would not be reproducible.

---

## R7. Config validation and error reporting

**Decision**: `validate(config)` returns an array of `{ path, message }` errors, where `path` is a JSON-pointer-like string such as `terrain[2].sprite`. An empty array means valid. `main.js` shows all errors in the error panel and renders nothing. Missing file, network error and JSON parse error are reported the same way, with a distinct message.

**Format version**: `format: "arcade-world"` and `version: 1`. Any other value is an error with the message `unsupported version X; this app supports 1` (FR-014).

**Rationale**: Returning every error at once is more useful to the person editing JSON than stopping at the first. The version check is the constitution's rule for contract changes.

**Rejected alternative**: Schema validation library (for example Ajv). Rejected because it would be a vendored dependency for a small, fixed schema.

---

## R8. Testing approach

**Decision**:
- **Automated** (`node --test tests/`): validation accepts the default config and rejects a set of broken configs with the expected `path`; generation is identical across runs for one seed and differs for another; no object is placed on a disallowed terrain; spacing and count shortfalls are reported; camera zoom keeps the anchor point fixed, clamps to min and max, and clamps pan to the world bounds.
- **Manual** (`quickstart.md`): pan, zoom, error panel, visual distinction of element types, console clean.

**Rationale**: The logic is where bugs are expensive and where tests run without a browser. The visual checks cannot be automated well without a browser runner, which the constitution does not require for this feature.

---

## R9. Licensing and attribution record

**Decision**: `public/assets/ATTRIBUTION.md` lists, for every external asset: name, source URL, author, licence, and which files use it. The project-authored sprites are listed as "project-authored, same licence as the repository".

**Rationale**: Keeps the provenance requirement from the constitution (III's spirit of traceability) and the user's explicit licence concern in one place.
