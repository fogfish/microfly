# Bug Assessment: Misaligned terrain tiles leave dark edge pixels

- **Slug**: tile-edge-misalignment
- **Created**: 2026-10-04
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

> the world repeatitively uses misaligned tiles leaving the dark pixels at the edge. rougelike-16.png has a groups and if a tile from group is used then surrouding tiles must be from same group. You must make an analysis of rougelike-16.png and upsate attribution accordingly. The world must be pixel perfect and aligned with real landscapes.

Summary: the terrain shows the same edge tile over and over, so dark outlines and transparent pixels appear as lines inside rock fields and along water. The sheet is made of tile groups that must be placed next to matching tiles. The requirement is pixel-perfect output that matches real landscapes.

## Symptom

Rock fields and water show repeated dark stripes at tile boundaries, where a single edge tile is used on every cell. Expected: each cell is drawn with a tile whose edges match its neighbours from the same group, so the landscape has no dark seams or stray edge pixels.

## Reproduction

1. Open `public/index.html` through a static server from `public/`. Default zoom is 2.
2. Look at any rock cluster (`rock` terrain, noise layer). Each rock cell shows a dark horizontal stripe at its bottom edge, and the stripes repeat down the cluster.
3. Set `camera.zoom.default` to `1.7` and reload (in a temporary copy of `world.json`). The stripes remain. Zoom is not the main cause.
4. Look at water from the blob layer. Dark outlines and light edge lines repeat inside the pond.

[NEEDS CLARIFICATION: whether the user expects the transition tiles between grass and water (the sand ring) to appear, or only the plain interior tiles. Section 4 of the sheet analysis explains why this matters.]

## Suspected Code Paths

- `public/world/world.json:` sprites `rock` (sheet 102,238), `water` (sheet 17,51), `grass` (sheet 0,255). These are single tiles from groups, used on every cell. This is the primary cause.
- `public/js/world/generate.js:generateTerrain()` assigns one terrain id per cell and has no notion of neighbours. Each cell gets the same sprite regardless of its surroundings. This is the design gap that lets the group rule be broken.
- `public/js/render/renderer.js:render()`, terrain loop. Each terrain cell is drawn with `drawImage` over whatever was drawn before. The canvas is not filled with a base colour first, so transparent pixels in a sprite show the dark page background (`--bg` in `public/css/style.css`) or the cell drawn before. This is the amplifier that makes the edge pixels dark.
- `public/js/render/camera.js:zoomAt()`. Zoom steps of `1.1` produce fractional zoom values, so cell edges can land between device pixels. This is a possible secondary cause of seams. It was not visible in the test screenshot at zoom 1.7, so it is lower priority.
- `public/assets/ATTRIBUTION.md`. The tile table lists single tiles and says nothing about group membership or edges. It needs updating once the groups are known.

## Root Cause Hypothesis

Two causes combine, with high confidence in the first and medium in the second.

1. **Edge tiles used as interior tiles (high confidence).** The `rock` tile (6,14) belongs to the Rock A edge set. Its bottom row is 0% opaque and its outline is dark on three sides (measured in `sheet-analysis.md`, section 2). The `grass` and `water` picks are also edge or non-clean tiles. Because the generator uses one tile per terrain and ignores neighbours, every rock cell repeats the edge, which produces the stripes.
2. **No opaque base under terrain (medium confidence).** Transparent pixels show whatever is behind them. The renderer does not fill the cell first, so the dark page background and the previously drawn neighbour show through. This does not create the stripes on its own, but it makes them darker and more visible.

## Proposed Remediation

**Preferred**: Use the sheet's groups properly.
- Record each group in `world.json` as a set of named tiles with their roles (for example `rock.edge.north`, `rock.fill`), using the group table in `sheet-analysis.md`.
- Add a neighbour-based pick to `generateTerrain()`. For each cell, read the 8 neighbours and pick the tile whose role matches (4-bit or 8-bit autotile). Only tiles from the same group may be next to each other.
- Use the clean interior tiles as fills: `water` (0,0) from the pond, and an opaque grass fill from the plain grass block, not an edge tile.
- Fill each cell with the opaque base terrain before drawing its sprite, so transparent edge pixels never show the page background.
- Keep the zoom at integer multiples where possible (for example snap `zoomAt` results to a whole number) to avoid seams. Make this optional if the autotile fix removes the stripes.

**Alternatives**:
- Use only opaque interior tiles for `rock`, `water` and `grass` with no transitions. Simplest, and it removes the stripes. It does not meet "aligned with real landscapes", because there are no shore or rock edges.
- Keep single tiles but fill the base colour from the terrain's average colour. This hides the stripes but does not follow the group rule, so it is not recommended.

**Files likely to change**:
- `public/world/world.json` (sprite roles and group membership, terrain entries)
- `public/js/world/generate.js` (neighbour-based tile choice)
- `public/js/render/renderer.js` (opaque base fill under each terrain cell)
- `public/js/render/camera.js` (optional integer zoom snapping)
- `public/assets/ATTRIBUTION.md` (per-group tile table, with the group names and sheet coordinates)
- `specs/001-arcade-world-setup/contracts/world-config.md` (new optional `groups` or `roles` field, needs a version decision)

**Tests to add or update**:
- A test that every rock or water cell's neighbours come from the same group (no mixed group pairs in the grid).
- A test that the autotile pick is deterministic for a given neighbour set.
- A render check, or a pixel test in `tests/`, that no terrain cell has a fully transparent edge row when drawn over the base colour.
- Update `tests/generate.test.mjs` assertion that `rock` never replaces `water`, if the layer order changes.

## Risks & Considerations

- **Config contract change.** Adding roles or groups is an addition within version 1 if the app ignores absent fields, but the autotile pick is a behaviour change. Confirm whether this needs `version: 2` (see `contracts/world-config.md`, versioning rule).
- **Determinism.** The neighbour pick must not change the PRNG draw order, or the seed contract (FR-013) breaks. The pick should be a pure function of the grid after placement.
- **Performance.** An 8-neighbour lookup per cell is cheap for 100 × 100, and fine at 512 × 512 once.
- **Incomplete group mapping.** Without the full 3 × 3 role map for rock and grass, the autotile pick can only be partial, which can leave some cells mismatched. Section 4 of the sheet analysis lists what is missing.
- **Attribution.** The user asked for the attribution to be updated. That is a source-file change, so it belongs to the fix step, not this assessment.

## Open Questions

- [NEEDS CLARIFICATION: Should the terrain use the sheet's transition (edge) tiles between grass, water and rock, following the groups, or only plain interior tiles? The first option looks more like real landscapes but needs the full neighbour mapping. The second is simpler.]
- [NEEDS CLARIFICATION: Can the user confirm the group membership of the rock and grass blocks in `sheet-analysis.md`, section 1? I identified them visually, and the 3 × 3 role for each tile still needs confirming, which I could not fully determine from pixels alone.]
- [NEEDS CLARIFICATION: Is an integer-only zoom acceptable for "pixel perfect", or should fractional zoom stay available?]

## Next step

`/speckit-bug-fix slug=tile-edge-misalignment`. This applies the fix and updates `ATTRIBUTION.md` with the group table. The open questions above should be answered first, because they decide between the preferred and the simpler fix.
