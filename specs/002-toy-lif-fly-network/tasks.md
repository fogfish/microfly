# Tasks: Toy LIF Fly Network

**Input**: Design documents from `/specs/002-toy-lif-fly-network/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/ (fly-config.md, worker-protocol.md), quickstart.md

**Tests**: Included. The spec does not ask for TDD, but Constitution "Development Workflow & Quality Gates" requires unit tests for the LIF core, and contract tests on both sides for any change to the worker message protocol. Those tests are listed in each story phase.

**Organization**: Tasks are grouped by user story. The engine (LIF core and graph) is built in Foundational because every story needs it. Phase 4 (US2) verifies the engine in isolation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, US3 map to the user stories in spec.md
- Paths are relative to the repository root. Browser code is under `public/`.

## Path Conventions

- Pure modules (no DOM, Worker or fetch): `public/js/brain/`, `public/js/fly/`, `public/js/world/`. Imported by Node tests and `scripts/`.
- Browser-only modules: `public/js/fly/fly-host.js`, `public/js/brain/fly.worker.js`, `public/js/ui/fly-panel.js`, and changes to `public/js/render/`, `public/js/main.js`, `public/index.html`, `public/css/style.css`.
- Tests: `tests/*.test.mjs`, run with `npm test`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create directories and the experiment entry point.

- [X] T001 Create directories `public/js/brain/`, `public/js/fly/` and `scripts/` (the last already exists; confirm it is empty before use)
- [X] T002 [P] Add `"experiment": "node scripts/compare-baseline.mjs"` to the `scripts` block in `package.json` (keep `"test": "node --test tests/*.test.mjs"` unchanged)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The LIF engine (ADR 001 Stage 1). Every user story depends on it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `public/js/brain/lif.js`, a pure module with no DOM or Worker dependency. Export `LIF_DEFAULTS` as a frozen object with named parameters `dt` (1.0), `tau` (20.0), `vRest` (0.0), `vReset` (0.0), `vThreshold` (1.0), `refractorySteps` (2), `synapticScale` (0.2), each with a one-line comment giving its meaning. Export `createNetwork(graph, params)` and `step(net, external)` following the ADR annex: spikes delivered with a one-step delay, refractory neurons skip integration, `external` is a `Float64Array(n)`. `createNetwork` must reject with a clear `Error` naming the parameter when `dt` or `tau` is not positive, `refractorySteps` is not an integer of 0 or more, `vThreshold` is not greater than `vReset`, or a key is not one of the names above. Keep the core at about 40 lines of code (ADR goal).
- [X] T004 [P] Create `public/js/brain/graph.js` exporting `randomGraph({ neuronCount, outDegree, inhibitoryFraction, rand })`. Fixed out-degree, Dale's law (each neuron is excitatory `+1` or inhibitory `-1`, all its outgoing edges share that sign), no self-edges, no repeated edges from the same neuron. `rand` is the seeded PRNG from `public/js/world/prng.js` (`createPrng(seed).next`). Throw `Error` with the message `outDegree must be less than neuronCount` when `outDegree >= neuronCount` (ADR: "Requires `outDegree < neuronCount`").

**Checkpoint**: The engine loads in Node without a browser (`node -e "import('./public/js/brain/lif.js')"`).

---

## Phase 3: User Story 1 - Six Flies Driven by Their Own Toy Brains (Priority: P1) 🎯 MVP

**Goal**: Six flies move in the arcade world. Each is driven by its own toy network running in its own Web Worker. The readout shows sensory, LEFT and RIGHT values and spikes for each fly.

**Independent Test**: Open `http://localhost:8000/` from `public/` with the default `world.json`. Six flies appear, each reports `running` and is labelled as a toy (synthetic test fixture). Click a fly and its readout updates live. (quickstart.md, manual checks 1–3.)

### Configuration

- [X] T005 [US1] Edit `public/world/world.json`. (a) Add two pixel sprites to `sprites`: `fly` (8×8, body and wings) and `fly-baseline` (8×8, same shape in a different colour), each with a `palette` and `pixels` in the form from `specs/001-arcade-world-setup/contracts/world-config.md`. (b) Add a top-level `flies` section with the defaults from `specs/002-toy-lif-fly-network/contracts/fly-config.md`: `count` 6, `mode` "toy", `tickHz` 20, `sprite` "fly", `baselineSprite` "fly-baseline", `body` {`maxSpeed` 3, `turnRate` 4}, `stimulus` {`objects` ["apple","cherry"], `radius` 3, `gain` 1.0, `max` 1.0}, `brain` {`neuronCount` 40, `outDegree` 4, `inhibitoryFraction` 0.2, `motorSmoothing` 0.05, `telemetry` [0,1,2]}, `experiment` {`seeds` [1,2,3,4,5], `ticks` 3000}. Do not change `format`, `version` or any existing field.
- [X] T006 [P] [US1] Extend `public/js/world/validate.js`: add `validateFlies(flies, config, err)` and call it from `validateConfig` only when `config.flies` is present. Rules are verbatim from `contracts/fly-config.md` and `data-model.md`: `count` integer 0..64; `mode` must be "toy" or "baseline"; `tickHz` integer 1..60; `sprite` and `baselineSprite` must exist in `sprites`; `body.maxSpeed` and `body.turnRate` numbers greater than 0; `stimulus.objects` non-empty, each an id of an object rule with `kind: "edible"`; `stimulus.radius` > 0; `stimulus.gain` ≥ 0; `stimulus.max` > 0; `brain.neuronCount` integer 3..1000; `brain.outDegree` integer 1..neuronCount−1 (message: "must be an integer from 1 to N (neuronCount - 1)"); `brain.inhibitoryFraction` 0..1; `brain.motorSmoothing` 0 < x ≤ 1; `brain.telemetry` unique integers below neuronCount; `brain.lif` keys must be LIF parameter names. `brain` is required only when `mode` is "toy". `experiment.seeds` non-empty integers 0..4294967295; `experiment.ticks` integer 1..1000000. Errors use `{path, message}` as in the existing validator.

### Protocol and brain

- [X] T007 [P] [US1] Create `public/js/brain/protocol.js` exporting `PROTOCOL_VERSION = 1`, builders `init`, `sense`, `stop` (host → worker) and `ready`, `motor`, `error` (worker → host), exactly as in `contracts/worker-protocol.md`, and `validateMessage(msg, direction)` returning `null` or an error string. Reject a missing or different `v`, a `sense.tick` that is not an integer ≥ 0, and a `sensory` that is not a finite number ≥ 0. Use `Uint8Array` for `selected` and list it as transferable.
- [X] T008 [P] [US1] Create `public/js/brain/fly-brain.js` exporting `createFlyBrain(brainConfig, seed)`. Build the graph with `randomGraph` (seed via `createPrng(seed)`) and the network with `createNetwork`, using `LIF_DEFAULTS` overridden by `brainConfig.lif`. Neuron 0 is the sensory input, neuron 1 is LEFT, neuron 2 is RIGHT. Operation `step(sensoryValue)` sets `external[0] = sensoryValue`, runs one LIF step, updates `left` and `right` as `rate += motorSmoothing × (spike − rate)`, and returns `{ tick, sensory, left, right, selected }`, where `selected` is a `Uint8Array` of spikes for `brainConfig.telemetry` in the same order.
- [X] T009 [US1] Create `public/js/brain/worker-core.js` exporting `createWorkerCore()` with `handle(msg)` returning `{ reply, transfer }`. Handle `init` (build the brain with `createFlyBrain`, reply `ready`), `sense` (require `tick` to be exactly one more than the last tick, otherwise reply `error` with the message `sense tick N out of order (expected M)`; reply `motor`), and `stop` (release state, no reply). Validate every incoming message with `validateMessage`; on failure reply `error`. Catch exceptions from `createFlyBrain` and reply `error`. Depends on T007, T008.
- [X] T010 [US1] Create `public/js/brain/fly.worker.js`, a module Worker shell: `const core = createWorkerCore(); self.onmessage = (e) => { const { reply, transfer } = core.handle(e.data); if (reply) self.postMessage(reply, transfer ?? []); };`. Contains no logic beyond wiring. Depends on T009.

### Fly body and world (pure)

- [X] T011 [P] [US1] Create `public/js/fly/stimulus.js` exporting `fruitIntensity(points, x, y, radius)` where `points` is an array of `{x, y}` cell centres (in tiles), returning `Σ max(0, 1 − d / radius)`. Exporting `sensoryValue(intensity, gain, max)` returning `Math.min(max, Math.max(0, gain × intensity))`. Pure, no DOM.
- [X] T012 [P] [US1] Create `public/js/fly/body.js` exporting `createBody({ x, y, heading })` and `stepBody(body, motor, env)`. `motor` is `{ left, right }`. `env` is `{ dt, maxSpeed, turnRate, width, height, isWalkable(cx, cy), cellIndex(cx, cy) }`, `dt` is `1 / tickHz`. Movement: `v = maxSpeed × (left + right) / 2`, `ω = turnRate × (right − left)`, `heading += ω × dt`, then try the full move, then x only, then y only (sliding). A move into a non-walkable cell or outside `[0, width) × [0, height)` is rejected. Keep the cell string `cell` and increment `contacts` only when the fly enters a cell that `env.isStimulusCell(cx, cy)` reports (add this predicate to `env`). Return the updated body.
- [X] T013 [P] [US1] Create `public/js/fly/fly-world.js` exporting `buildWorld(config, grid, objects)` returning `{ width, height, blocked, stimulusCells, walkable }`: `blocked` is a `Uint8Array(width × height)` that is 1 where the terrain is not walkable (`terrain[t].walkable !== true`) or a `kind: "scenery"` object stands; `stimulusCells` is a `Map` from cell index to `true` for objects whose rule id is in `flies.stimulus.objects`. Export `spawnFlies(config, world)` using `createPrng(flies.seed)` to pick `count` walkable cells that are not blocked (at most 200 attempts per fly, otherwise throw `Error("no walkable cell for fly N")`), with heading also drawn from the PRNG. Set `mode` per fly from config and `sprite` to `flies.sprite` or `flies.baselineSprite` depending on mode. Brain seed per research R10: `(flies.seed + (i + 1) × 0x9E3779B1) >>> 0`.

### Host (browser)

- [X] T014 [US1] Create `public/js/fly/fly-host.js` (browser). Export `startFlies({ config, world, onUpdate })`. For each toy fly, create `new Worker(new URL('../brain/fly.worker.js', import.meta.url), { type: 'module' })`, send `init` (from `protocol.js` builders, with the validated `brain` section and the brain seed), and set status `starting` until `ready`. Lockstep per research R2: a fly is due when `status === 'running'`, `pending` is false, and its `tick` is below `floor(elapsed × tickHz)`. When due, compute `sensory = sensoryValue(fruitIntensity(points, x, y, radius), gain, max)` using the stimulus points from `world.stimulusCells` (convert cell indices to centres), send `sense` with `tick`, set `pending`. On `motor`, apply `stepBody` with the reply (`tick` must match, otherwise mark error), append to a 200-entry history ring, set `pending` false, call `onUpdate()`. On worker `error` or `onerror`, set status `error` and message, keep other flies running. Pause while `document.hidden`; on resume reset the clock base so there is no catch-up burst. Export `stopFlies()` that sends `stop` and terminates workers. Depends on T007, T010, T011, T012, T013.

### UI and rendering

- [X] T015 [P] [US1] Create `public/js/ui/fly-panel.js` (browser). Export `renderFlyPanel(container, flies, selectedId, onSelect)`. Show a list with one row per fly: id, mode, status, contacts, and for toy flies the label "toy (synthetic test fixture)". Show the selected fly's readout: sensory, LEFT and RIGHT rates, and a row per telemetry neuron showing its spike count over the last 20 ticks. Show the error message when status is `error`. Cover the case with no flies with "No flies configured". Rerender on each update, no framework.
- [X] T016 [US1] Edit `public/js/render/renderer.js`: add a `flies` array to the `world` argument and draw each fly after the objects pass, centred on `(x × tileSize, y × tileSize)` using the sprite from `sprites.get(fly.sprite)`, at the same device-pixel rounding as objects. Skip flies outside the visible range. Depends on nothing in US1 except the sprites from T005.
- [X] T017 [P] [US1] Edit `public/js/render/input.js`: add an optional `options.onClick(tileX, tileY)` argument to `attachInput`. Treat pointerdown followed by pointerup with less than 4 px movement as a click. Convert the click to world tile coordinates with the camera (`camera.x + sx` over `zoom × tileSize`). Existing drag and wheel behaviour unchanged.
- [X] T018 [P] [US1] Edit `public/index.html`: add a fly panel container (`<section id="fly-panel" aria-live="polite"></section>`) after the canvas.
- [X] T019 [P] [US1] Edit `public/css/style.css`: style `#fly-panel` with the existing light and dark colour tokens, and make it readable at phone width (16 px side gutter, no horizontal scroll), as the 001 plan requires.

### Integration

- [X] T020 [US1] Edit `public/js/main.js`: after `startWorld` builds the world, if `config.flies` is present, call `buildWorld`, `spawnFlies`, `startFlies({ config, world, onUpdate })`. `onUpdate` requests a redraw and re-renders the fly panel. Wire `attachInput` `onClick` to select the nearest fly within 1 tile. If `config.flies` is absent, the behaviour is exactly as feature 001 (no flies, no panel). Depends on T014, T015, T016, T017.

### Tests for User Story 1 (protocol and pure modules)

- [X] T021 [P] [US1] Create `tests/protocol.test.mjs`: host-side encode and validate for every message type; worker side: `init` gives `ready`, `sense` gives `motor` with the same `tick`, out-of-order tick gives `error`, a wrong `v` gives `error`, `stop` gives no reply. Covers the contract tests required by Constitution Dev Workflow.
- [X] T022 [P] [US1] Create `tests/fly-brain.test.mjs`: same seed and same sensory sequence give the same `left`, `right` and `selected` sequence; `left` and `right` stay in [0, 1]; a sustained high sensory value raises the LEFT rate above its value at tick 0 after 100 ticks; `selected.length` equals `telemetry.length`.
- [X] T023 [P] [US1] Create `tests/body.test.mjs`: forward motion with equal motors; turning with unequal motors; blocked cell stops the fly; sliding along a wall (x blocked, y free moves in y); world bounds clamp; `contacts` increments once per entry into a stimulus cell and not while staying in it.
- [X] T024 [P] [US1] Create `tests/stimulus.test.mjs`: falloff is 1 at the source, 0 at `radius` and beyond; two points add; `sensoryValue` clamps to `[0, max]` and scales by `gain`.
- [X] T025 [P] [US1] Create `tests/fly-world.test.mjs`: `buildWorld` marks water and scenery blocked and grass free; `spawnFlies` gives the same positions for the same seed; every spawn is walkable and not blocked; spawns `count` flies; a fully blocked world throws `no walkable cell for fly N`.
- [X] T026 [P] [US1] Create `tests/validate-flies.test.mjs`: the default `world.json` with `flies` validates with no errors; each invalid case from `contracts/fly-config.md` gives an error at the right path (for example `flies.brain.outDegree` when `outDegree` equals `neuronCount`); `flies` absent validates as before; `honey` in `stimulus.objects` is rejected.

**Checkpoint**: Open the app from `public/` with `python3 -m http.server 8000`. Six toy flies move and the readout works (quickstart manual checks 1–6). `npm test` passes for the US1 tests.

---

## Phase 4: User Story 2 - Verify the Simulation Engine in Isolation (Priority: P2)

**Goal**: A developer can verify the LIF engine and graph with `npm test`, without a browser or the world.

**Independent Test**: Run `npm test`. The engine tests pass, and an invalid parameter gives a clear error. (The engine itself is built in Foundational; this phase holds its verification.)

- [X] T027 [P] [US2] Create `tests/lif.test.mjs` with the four ADR Stage 1 checks: (1) same seed and graph give identical spike trains over 500 steps; (2) a constant drive gives inter-spike intervals that are all equal after the first spike; (3) a neuron never spikes during `refractorySteps` after a spike; (4) an inhibitory edge from a neuron that spikes lowers the downstream firing rate compared with the same network without that edge.
- [X] T028 [P] [US2] Create `tests/graph.test.mjs`: each neuron has exactly `outDegree` distinct targets; no self-edges; all outgoing edges of a neuron have one sign; the same seed gives the same edge list; a different seed gives a different edge list; `outDegree >= neuronCount` throws `outDegree must be less than neuronCount`.
- [X] T029 [P] [US2] Create `tests/lif-params.test.mjs`: `createNetwork` rejects, with a message naming the parameter, `dt <= 0`, `tau <= 0`, `refractorySteps` not an integer, `vThreshold <= vReset`, and an unknown key. `LIF_DEFAULTS` is frozen (assignment throws in strict mode).

**Checkpoint**: `npm test` passes all engine tests without a browser.

---

## Phase 5: User Story 3 - Compare Toy Flies Against a Random-Walk Baseline (Priority: P3)

**Goal**: A developer can run toy and random-walk baseline flies in the same world and compare fruit contacts, from configuration only.

**Independent Test**: Set `flies.mode` to "baseline" and reload: flies show the baseline sprite, no workers start, and the panel labels them "baseline". Run `npm run experiment` and read the totals and verdict.

- [X] T030 [P] [US3] Create `public/js/fly/baseline.js` exporting `createBaselineMotor(seed)` returning `next()` → `{ left, right }`, each uniform in [0, 1] from `createPrng((seed ^ 0xB5297A4D) >>> 0)`.
- [X] T031 [US3] Edit `public/js/fly/fly-host.js`: for flies whose mode is "baseline", create no Worker. Each tick, take the motor from `createBaselineMotor` and apply `stepBody` the same way as toy flies, with status `running` immediately. Keep the same tick clock and pause behaviour. Depends on T014 and T030.
- [X] T032 [US3] Edit `public/js/ui/fly-panel.js`: label baseline flies "baseline (random walk, no brain)" and hide the telemetry rows for them. Depends on T015.
- [X] T033 [P] [US3] Create `scripts/compare-baseline.mjs`. Load `public/world/world.json`, validate it (exit with the error list if invalid), generate terrain and objects with `generateTerrain` and `placeObjects`, then for each seed in `flies.experiment.seeds` run `flies.experiment.ticks` brain ticks for every toy fly and every baseline fly using the pure modules (`createFlyBrain`, `stepBody`, `createBaselineMotor`, `sensoryValue`, `fruitIntensity`). The stimulus source is the same one the browser uses. Print a table with one row per seed (toy and baseline contacts), a totals row, and `toy - baseline: +N` with `verdict: toy > baseline` or `verdict: toy <= baseline`. With `--verbose`, also print each toy fly's mean LEFT and RIGHT rate and the number of ticks each motor spiked. Always exit 0 (research R12).
- [X] T034 [P] [US3] Create `tests/baseline.test.mjs`: the same seed gives the same motor sequence; values stay in [0, 1]; the seed for the baseline is different from the toy brain seed for the same fly.

**Checkpoint**: Mode switch works with no code change. `npm run experiment` prints the table and verdict.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Verification, results and documentation.

- [X] T035 Run `npm test` and fix any failure in tests from Phases 2–5. Paste the summary line into the completion report.
- [X] T036 Run `npm run experiment` and record the printed table and verdict in `specs/002-toy-lif-fly-network/quickstart.md` under section 2. If the verdict is `toy <= baseline`, record it as a finding and do not change the thresholds to pass it (ADR Stage 2 says the wiring is the problem, not the metric).
- [ ] T037 Run the manual browser checks in `specs/002-toy-lif-fly-network/quickstart.md` (sections 3 and 4) with `python3 -m http.server 8000` from `public/`, confirm no console errors for 5 minutes with six flies, and record the result.
- [X] T038 [P] Update `specs/002-toy-lif-fly-network/contracts/fly-config.md` and `worker-protocol.md` if any implementation detail differs from the contract. Constitution requires documentation to change in the same change as the format.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories (the engine is needed by all of them).
- **US1 (Phase 3)**: Depends on Foundational. The MVP.
- **US2 (Phase 4)**: Depends on Foundational only. Can run in parallel with US1.
- **US3 (Phase 5)**: Depends on US1 (T014, T015 are edited by US3 tasks T031 and T032).
- **Polish (Phase N)**: Depends on all stories.

### Within User Story 1

- T005 (config) before T006 (validation tests use the default config) and T020 (integration).
- T007 (protocol) and T008 (fly brain) in parallel. T009 after both. T010 after T009.
- T011, T012, T013 in parallel.
- T014 (host) after T007, T010, T011, T012, T013.
- T015, T016, T017, T018, T019 in parallel with each other, and in parallel with T007–T013.
- T020 (integration) last in the story.
- Test tasks T021–T026 can be written in parallel with the implementation they cover, and must pass before the checkpoint.

### User Story Dependencies

- US1 is independent of US2 and only needs Foundational.
- US3 needs US1 files (`fly-host.js`, `fly-panel.js`), so it runs after US1.

---

## Parallel Example: User Story 1

```text
# After Foundational is done, these can run together (different files):
T007 protocol.js
T008 fly-brain.js
T011 stimulus.js
T012 body.js
T013 fly-world.js
T015 fly-panel.js
T017 input.js
T018 index.html
T019 style.css

# Then, sequentially:
T009 worker-core.js → T010 fly.worker.js
T014 fly-host.js → T016 renderer.js → T020 main.js

# Tests for US1 in parallel once their module exists:
T021 protocol.test.mjs, T022 fly-brain.test.mjs, T023 body.test.mjs,
T024 stimulus.test.mjs, T025 fly-world.test.mjs, T026 validate-flies.test.mjs
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001–T002).
2. Phase 2: Foundational engine (T003–T004).
3. Phase 3: US1 (T005–T026).
4. **STOP and VALIDATE**: `npm test`, then the manual checks 1–6 in quickstart.md. Six flies run, each with its own worker.

### Incremental Delivery

1. Setup + Foundational → engine testable in Node.
2. US1 → six toy flies in the world (MVP).
3. US2 → engine verification suite in `npm test`.
4. US3 → baseline mode and the ADR Stage 2 experiment.
5. Polish → record results and confirm the run check.

---

## Notes

- [P] tasks touch different files and have no dependency on incomplete tasks.
- Every US task names its file path. Tests for pure modules run with `node --test`, with no browser.
- Stop at the US1 checkpoint before starting US3. If the Stage 2 verdict is `toy <= baseline` (T036), the next step is fixing the wiring, not Stage 3 (ADR 001).
- Avoid editing the same file in parallel: `fly-host.js` (T014, T031), `fly-panel.js` (T015, T032), `main.js` (T020) and `world.json` (T005) are sequential.
