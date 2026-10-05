# Research: Fly Status Side Panel

**Date**: 2026-10-05

Each decision answers an open question in the plan's Technical Context or a choice the request
left to the planner. There were no NEEDS CLARIFICATION markers after the spec was answered.

## R1. Point cloud rendering: three.js Points with vertex colour

- **Decision**: One `THREE.Points` object for the selected brain. Each neuron is a point. Its
  colour is the base colour multiplied by its current brightness, and the colour attribute is
  updated each frame while any neuron is still fading. Orbit controls come from the vendored
  `OrbitControls.js`.
- **Rationale**: The inspector already draws neurons this way, so the approach is proven in this
  repository. A brain has at most a few thousand points for the panel, and a colour attribute
  update costs about 1 ms at that size.
- **Alternatives considered**:
  - A custom ShaderMaterial with an alpha attribute: more code for no visible gain at these counts.
  - Reusing `public/brains/js/scene.js`: rejected, because that file belongs to the inspector and
    its spec (004) requires it to stay parallel and unchanged.

## R2. Fade-in and fade-out envelope

- **Decision**: For each neuron, brightness is `env(t) = min(1, t / riseMs) × exp(−t / fallMs)`,
  where `t` is the wall-clock time since its most recent spike. Defaults: `riseMs = 120`,
  `fallMs = 600`. Brightness is the maximum over neurons that spiked, so only the last spike
  matters. The base brightness is 0.12, so a silent neuron stays dim.
- **Rationale**: Time-based and pure, so Node can test it at fixed times. The 20 Hz tick is too
  coarse for a per-tick decay to look smooth, and a time envelope gives a clear rise and fall for
  every spike.
- **Alternatives considered**:
  - Per-tick multiplicative decay: visible steps at 20 Hz.
  - Shader-side animation with a uniform clock: more moving parts, and it still needs spike times.

## R3. Spike transport: sparse indices per tick

- **Decision**: Each motor message carries `spikes: Uint32Array`, the indices of neurons that
  spiked on that tick, transferred as a buffer. The window (20 ticks) counts are computed on the
  main thread from the history.
- **Rationale**: Spikes are sparse. A dense `Uint8Array` per tick would be 143 KB per tick per fly
  for the full admitted brain, times six flies at 20 Hz. The sparse list stays small for the
  reference brain and grows with activity, not with brain size.
- **Alternatives considered**:
  - Keep the fixed `telemetry` list and extend it: the panel must cover every neuron, so a list
    would have to contain all of them.
  - Keep the dense `selected` array: rejected for the same size reason.

## R4. Snapshot version 3 with a declaration, and a header-only migration

- **Decision**: The header gains a required `capabilities` object: `signals` and `channels`
  (`inputs`, `outputs`). The format version becomes 3. Version 2 files are rejected with
  `unsupported snapshot version 2; this build supports 3`. The reference brain is migrated with
  `extract/malecns_brain/migrate.py`, which rewrites the header only and copies the body bytes.
- **Rationale**: A reader that does not know the declaration would show wrong or missing channels
  and give no warning, so the version must change. A header-only migration keeps the body bytes
  identical, so the reference brain does not need the dataset. The body's determinism check still
  applies to fresh extractions.
- **Alternatives considered**:
  - An optional `capabilities` field inside version 2 (allowed by the 003 contract): an old reader
    would ignore it and render wrong labels silently.
  - Regenerating the reference brain from the dataset: needs the external dataset and a full run,
    and gives the same body bytes that the migration already copies.

## R5. Channel declaration shape and semantics

- **Decision**: A channel is `{ id, label, side, neuron, range, drive? }`, with `side` in
  `L | R | both` and `kind` implied by its list (`inputs` or `outputs`). Input channels reference
  neuron 0, the only neuron the world drives. Output channels reference any neuron. An output with
  `drive: "left"` or `drive: "right"` drives the body, and exactly one of each is required when the
  brain drives a fly.
- **Rationale**: This carries the L/R split the request asks for, keeps the body contract (one
  left and one right drive) explicit, and lets an extra output appear in the panel without moving
  the fly.
- **Alternatives considered**:
  - Hard-coded `left` and `right` only: rejected by the extensibility requirement.
  - A free-form registry in JavaScript: rejected, because connectome brains must carry their own
    declaration in the file.

## R6. Layout of the neuron cloud

- **Decision**: Neuron `soma` positions are centred and scaled uniformly into a unit cube (the
  largest extent maps to 2). Neurons without a soma are placed on a seeded sphere
  (`RANK_SEED`-style PRNG, so the layout is stable between reloads). Toy brains have no soma and use
  the seeded sphere for all neurons.
- **Rationale**: Uniform scale keeps the dataset's proportions. The seeded fallback is deterministic
  and needs no dataset.
- **Alternatives considered**:
  - Reusing the inspector's `sceneTransform`: rejected, because it lives in the inspector (see R1).
  - Force-directed layout from edges: more code, and it moves on each reload unless seeded.

## R7. Panel shell, sections and isolation

- **Decision**: `panel.js` mounts a list of sections from `registry.js`. Each section declares
  `requires` (a signal id or a channel group) and `render(container, model)`. A section whose
  requirement is missing is not mounted. A section that throws shows its own error text, and the
  other sections keep rendering. Section output is set with `textContent`, so no value is parsed as
  HTML (FR-014).
- **Rationale**: New channels and signals are added as declarations, and a broken section cannot
  take the panel down.
- **Alternatives considered**:
  - One render function for the whole panel: any error in new code breaks the panel.

## R8. Layout and resize

- **Decision**: `index.html` gets a `main#stage` with the `canvas#world` and an `aside#fly-panel`.
  CSS grid puts the world and the panel side by side at 900 px and wider (panel 360 px). Below
  900 px the panel stacks under the world with a 16 px gutter and no horizontal scroll. The
  renderer and camera size come from the world container instead of `innerWidth` and
  `innerHeight`.
- **Rationale**: The viewport split is what the spec asks for, and the container-based size is
  needed so the world does not draw under the panel.
- **Alternatives considered**:
  - An overlay panel: rejected by the spec (the panel must not hide the world).

## R9. Scale risk (full admitted brain)

- **Decision**: The panel draws every neuron of the selected brain with no level of detail. The
  full admitted brain (143,219 neurons) is not a default world brain, so it is not a planned
  target. If it is loaded, the point cloud is drawn at reduced update frequency. A later feature
  would add level-of-detail.
- **Rationale**: Keeps this feature small. The risk is recorded for the planner of a later
  feature.
