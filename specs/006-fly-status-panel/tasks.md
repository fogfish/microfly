# Tasks: Fly Status Side Panel

**Input**: Design documents from `/specs/006-fly-status-panel/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: The spec does not ask for TDD. The constitution requires tests for two changes this feature makes: the snapshot format (contract tests on both the Python and the browser side) and the worker protocol. Those are included in Phase 2. Panel-level tests are limited to the pure modules that the spec's independent tests depend on.

**Organization**: Setup and Foundational phases first. Then one phase per user story in priority order (US1 P1, US2 P2, US3 P3, US4 P3, US5 P3), then Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1 to US5). Setup, Foundational and Polish tasks have no story label.
- Every task names its exact file path.

## Path Conventions

Static web app and Python tool in one repository (see plan.md, Project Structure):
`public/js/` for browser modules, `public/brains/` for snapshots, `extract/malecns_brain/` for the
Python pipeline, `extract/tests/` for Python tests, `tests/` for Node tests, `public/world/` for world configs.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The one configuration change that the foundational phase depends on.

- [X] T001 [P] Add the `capabilities` block to `extract/configs/smallest-functional-brain.json`. Signals `["spikes"]`. Inputs: `food-odour` (label "Food odour", side "both", neuron 0, range [0, 1]). Outputs: `left-motor` (label "Left motor", side "L", neuron 1, range [0, 1], drive "left") and `right-motor` (label "Right motor", side "R", neuron 2, range [0, 1], drive "right"). Use exactly the example in `specs/006-fly-status-panel/contracts/snapshot-format-v3.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The declaration, the snapshot format version 3, the worker protocol version 2 and the
shared spike and output plumbing. Every user story depends on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Declaration rules (shared by browser and Python)

- [X] T002 [P] Create `public/js/brain/capabilities.js`. Export `TOY_CAPABILITIES` (signals `["spikes"]`, input `food-odour` on neuron 0 with side "both", outputs `left-motor` drive "left" on neuron 1 and `right-motor` drive "right" on neuron 2, all with range [0, 1]), `BASELINE_CAPABILITIES` (signals `[]`, the same two outputs without spike signal), and `validateCapabilities(decl, neuronCount)` which returns an array of error strings (empty when valid). Implement rules 11–18 of `specs/006-fly-status-panel/contracts/snapshot-format-v3.md` with the exact messages listed there. Channel constraints to enforce, quoted from `specs/006-fly-status-panel/data-model.md` Channel table: `id` "Matches `^[a-z][a-z0-9-]*$`. Unique across inputs and outputs."; `label` "Non-empty, at most 40 characters."; `side` "`"L"` | `"R"` | `"both"`"; `neuron` "Index below `neuronCount`. Inputs must be `0`."; `range` "`[number, number]` `min < max`. Defaults to `[0, 1]`."; `drive` "Output only. Exactly one `left` and one `right` when the brain drives a fly."
- [X] T003 [P] Create `extract/malecns_brain/capabilities.py` with a `validate_capabilities(decl, neuron_count)` function that applies the same rules and raises `ValueError` with the same messages as T002 (first error wins, in rule order). Export `DECLARATION_FIELDS` for the channel field list.

### Snapshot format version 3

- [X] T004 Update `extract/malecns_brain/container.py`: set `FORMAT_VERSION = 3`; `write_container` requires `header["capabilities"]` and writes it unchanged; `read_container` calls `validate_capabilities` from T003 after rule 5 and before the section checks. The version message comes from the constant, so a version 2 file reads "unsupported snapshot version 2; this build supports 3".
- [X] T005 [P] Update `extract/malecns_brain/config.py` to require a `capabilities` block in the extract config. A missing block fails with `E-CONFIG: capabilities is required`. The block is validated with T003 and copied into the header, so `configHash` covers it.
- [X] T006 Create `extract/malecns_brain/migrate.py` with a command-line entry point `python -m malecns_brain.migrate <in.brain> <config.json> <out.brain>`. It reads a version 2 file with `read_container`, takes `capabilities` from the config (validated), and writes a version 3 file with `write_container`, passing the original offsets, targets, weights and synapses unchanged. Depends on T004 and T005.
- [X] T007 [P] Create `extract/tests/test_capabilities.py`. One test per rule (11–18) in `specs/006-fly-status-panel/contracts/snapshot-format-v3.md`, each checking the exact message. Include the valid declaration from T001.
- [X] T008 [P] Update `extract/tests/test_container.py`: a version 3 container round-trips `capabilities`; a version 2 file is rejected with "unsupported snapshot version 2; this build supports 3"; a version 3 file with a malformed channel is rejected with the rule message.
- [X] T009 [P] Create `extract/tests/test_migrate.py`. The migrated file's body bytes (offsets, targets, weights, synapses) equal the input's body bytes. The header differs only in `capabilities`, `formatVersion`, and `sections`.
- [X] T010 Run the migration on the reference brain: `cd extract && .venv/bin/python -m malecns_brain.migrate ../public/brains/smallest-functional-brain.brain configs/smallest-functional-brain.json ../public/brains/smallest-functional-brain.brain`. Confirm the body bytes match the old file, then commit the regenerated file. Depends on T001, T004, T006.
- [X] T011 Update `public/js/brain/snapshot.js`: `FORMAT_VERSION = 3`; after `checkRoles` and `checkPositions`, call `validateCapabilities` from T002 with `neuronCount` and reject with its first message; return `capabilities` in the result of `parseSnapshot`.
- [X] T012 [P] Update the snapshot tests `tests/snapshot.test.mjs`, `tests/validate-snapshot.test.mjs` and `tests/reference-brain.test.mjs` for version 3. Add a case that a version 2 buffer is rejected, and a case that a bad channel is rejected with the rule message. Regenerate `tests/fixtures/synthetic-smallest.brain` as version 3 with the migration tool from T006 (its config is `tests/fixtures/` if present, else the extract config).

### Worker protocol version 2

- [X] T013 Update `public/js/brain/protocol.js`: `PROTOCOL_VERSION = 2`. The `init` validator rejects a `brain.telemetry` key with "init.brain.telemetry is removed in protocol 2". The `motor` validator takes the declared output count and checks, in order: `outputs` is a `Float32Array` of that length; `spikes` is a `Uint32Array` with every index below `neuronCount` and strictly ascending; `left` and `right` equal the `outputs` entries at the drive positions. `transferables(msg)` returns `[msg.outputs.buffer, msg.spikes.buffer]` for `motor`, otherwise `[]`. Rules are in `specs/006-fly-status-panel/contracts/worker-protocol-v2.md`.
- [X] T014 Update `public/js/brain/fly-brain.js`: `createFlyBrain` returns `{ neuronCount, capabilities, step }`. `step(sensory)` returns `{ tick, sensory, left, right, outputs, spikes }`, where `outputs` is a `Float32Array` with one moving-average value per declared output (in declaration order), `left` and `right` are the outputs with `drive`, and `spikes` is an ascending `Uint32Array` of neurons that spiked. Remove the `telemetry` handling and `selected`. The toy path uses `TOY_CAPABILITIES`; the snapshot path uses the snapshot's `capabilities`.
- [X] T015 Update `public/js/brain/worker-core.js` and keep the `fly.worker.js` shell as it is: `ready` carries `capabilities` (a plain object) along with `neuronCount`, and `motor` is built as protocol v2 from T014's output.
- [X] T016 [P] Update `tests/fly-brain.test.mjs` and `tests/protocol.test.mjs` for v2: outputs and spikes agree with the LIF spike vector for a fixed seed, and the `telemetry` key is rejected.
- [X] T017 [P] Create `tests/protocol-v2.test.mjs`. Builders and validators for `motor` (wrong `outputs` length, unsorted or out-of-range `spikes`, `left`/`right` disagreeing with `outputs`, transferables), and the `init` rejection of `telemetry`.

### Configuration and host plumbing

- [X] T018 [P] Remove the `telemetry` key from `flies.brain` in `public/world/world.json` and `public/world/world-connectome.json`. Update `public/js/fly/fly-config.js` so `resolveBrain` no longer sets or keeps `telemetry`. Optional override: `flies.brain.capabilities` is accepted, validated with T002, and used in place of `TOY_CAPABILITIES` (`specs/006-fly-status-panel/contracts/channel-declaration.md`).
- [X] T019 [P] Update the flies validator in `public/js/world/validate.js`: reject `flies.brain.telemetry` with "flies.brain.telemetry was removed; the panel reads the full spike stream". Update `tests/validate-flies.test.mjs` and `tests/fly-config-snapshot.test.mjs` to match.
- [X] T020 Update `public/js/fly/fly-host.js`: `loadSnapshot` returns `{ url, release, createdAt, neuronCount, capabilities, neurons }`, where `neurons` is the array of `{ soma, superclass }` from the header. `startFlies` takes each fly's declaration (the snapshot's for connectome flies, `TOY_CAPABILITIES` or the override for toy flies, `BASELINE_CAPABILITIES` for baseline flies), stores it on the record, and checks each incoming `motor` against it through T013. A failing check marks the fly as failed. Records keep `history` of `{ tick, sensory, left, right, outputs, spikes }` and no longer use `telemetry`.
- [X] T021 Update `public/js/main.js` boot: run `validateCapabilities` on the toy declaration (or override) and on the snapshot declaration before any fly starts. Errors go to the error panel with the path `flies.brain.capabilities` (or `snapshot`) and the message (FR-009).
- [X] T022 Keep the app working between phases: in `public/js/ui/fly-panel.js`, change the readout that used `history.selected` and `telemetry` to count from `history[].spikes`. This file is replaced in US1 (T041).
- [X] T023 Update `scripts/compare-baseline.mjs` (and any other `scripts/` file) that reads `telemetry` or `selected`, so it reads `spikes` and `outputs`. Use `grep -rn "telemetry\|selected" scripts/ public/js/ tests/` to find all uses.

**Checkpoint**: `npm test` and `extract/.venv/bin/python -m unittest discover -s extract/tests -p "test_*.py"` pass. The reference brain is version 3 and its body bytes are unchanged. The app starts with one fly.

---

## Phase 3: User Story 1 - See the Selected Fly's Status Beside the World (Priority: P1) 🎯 MVP

**Goal**: The viewport is split into the world and a right-hand panel. The panel shows the selected
fly's action (Forward, Turn left, Turn right, Idle). Selection by click or by the fly list still works.

**Independent Test**: Open the app at 900 px or wider. The world and the panel sit side by side with no
overlap. Select a fly and confirm the action matches its motion (quickstart step 3 and 4).

### Pure logic and tests

- [X] T024 [P] [US1] Create `public/js/fly/action.js` exporting `actionLabel(left, right)`. Labels per `specs/006-fly-status-panel/data-model.md` Action table: `left + right < 0.1` → "Idle"; `|left − right| < 0.1` → "Forward"; `left > right` → "Turn right"; `right > left` → "Turn left". Thresholds are named constants in this file.
- [X] T025 [P] [US1] Create `tests/action.test.mjs`. Idle at (0, 0); Forward at (0.6, 0.6); Turn right at (0.9, 0.2); Turn left at (0.2, 0.9); a threshold edge at each boundary.
- [X] T026 [P] [US1] Create `public/js/ui/panel/registry.js` (pure part): `selectSections(sections, capabilities)` returns the sections whose `requires` is met (`channels` by kind, `signal` by id, `{}` always), in declaration order. `runSection(section, model)` calls `section.render`, catches errors and returns `{ ok: true }` or `{ ok: false, error: "<title>: <message>" }`. Rules: `specs/006-fly-status-panel/contracts/panel-sections.md`. _(BUG-002: `runSection` gains `mount`, `update` and `dispose` handling, see T083.)_
- [X] T027 [P] [US1] Create `tests/panel-registry.test.mjs`: a section with a missing signal is not selected; a section with a present signal is selected; a thrown error gives `ok: false` with the title and message, and the next section still runs.
- [X] T028 [P] [US1] Create `public/js/ui/panel/model.js` (pure part): `buildStatusModel(record)` returns `{ flyId, brainLabel, action, neuronCount, capabilities }` from a fly record, with `action` from T024 (or `null` before the first tick). Fields per `specs/006-fly-status-panel/data-model.md` FlyStatusModel.
- [X] T029 [P] [US1] Create `tests/panel-model.test.mjs`: `action` is `null` before the first tick, and matches `actionLabel` after one. `flyId` and `brainLabel` come from the record.

### Browser shell

- [X] T030 [US1] Update `public/index.html`: replace `section#fly-panel` with `main#stage` containing `canvas#world` and `aside#fly-panel`. Add an `importmap` mapping `"three"` to `./brains/vendor/three/three.module.min.js`, for the point cloud (US2). Keep the `error-panel` element.
- [X] T031 [US1] Update `public/css/style.css`: `#stage` is a CSS grid with two columns (`1fr` and `360px`) at 900 px and wider, with the panel on the right. Below 900 px the panel stacks under the world, with a 16 px gutter and no horizontal page scroll. Remove the bottom-overlay rules for `#fly-panel`. Keep the colour tokens and `prefers-color-scheme` rules unchanged.
- [X] T032 [US1] Update `public/js/render/renderer.js` callers and `public/js/main.js` so the world canvas and camera use the size of `#stage`'s world column (`canvas.parentElement` or a `#world` wrapper), not `innerWidth` and `innerHeight`. The `resize` handler reads the same size.
- [X] T033 [US1] Create `public/js/ui/panel/sections/action.js`: `{ id: 'action', title: 'Action', requires: {}, render(container, model) }` writes the action label with `textContent`, or "Waiting for the first tick" when `model.action` is null. _(BUG-002: writes the label only when it changes, see T089.)_
- [X] T034 [US1] Create `public/js/ui/panel/panel.js`: `renderPanel(container, records, selectedId, onSelect, sections)`. It draws the fly list (buttons with `aria-pressed`, as the existing `fly-panel.js` does), then for the selected fly calls `selectSections` and `runSection` for each section. A failing section shows its `error` string in its own box. _(Superseded by T073, BUG-001: the list and the status are now two tabs.)_
- [X] T035 [US1] Update `public/js/main.js`: import `renderPanel` from `ui/panel/panel.js` and the section list from `ui/panel/sections/` (action only for now). Keep click-to-select and the fly list (FR-013): the click handler and the list call the same selection function.
- [X] T036 [US1] Delete `public/js/ui/fly-panel.js` once nothing imports it (`grep -rn "fly-panel.js" public/`). Remove the T022 readout with it.

**Checkpoint**: User Story 1 works. The split layout is in place, the action follows motion, selection by click and list works, and the app has no console errors. The MVP can ship here.

---

## Phase 4: User Story 2 - See Which Brain Neurons Were Recently Active (Priority: P2)

**Goal**: The panel shows the selected brain as a three.js point cloud. Neurons brighten on a spike and
fade out over about a second. The panel gives neuron and active counts.

**Independent Test**: Select a fly and watch the neuron map for a few seconds (quickstart step 4). Spiking
neurons brighten and fade back to dim; the counts update.

### Pure logic and tests

- [X] T037 [P] [US2] Create `public/js/brain/activity.js`: `envelope(tMs, { base = 0.12, riseMs = 120, fallMs = 600 })` returns `base` when `tMs` is `Infinity` (never spiked), otherwise `base + (1 − base) × min(1, tMs / riseMs) × exp(−tMs / fallMs)`. Also `createActivity(neuronCount)` with `recordTick(spikes, nowMs)` (sets `lastSpikeAt[n] = nowMs` for each spiked neuron), `brightness(nowMs)` (Float32Array of `envelope` values, `t = now − lastSpikeAt`), and `isFading(nowMs)` (true while any neuron is above `base`). Formulas per `specs/006-fly-status-panel/data-model.md` ActivityState.
- [X] T038 [P] [US2] Create `tests/activity.test.mjs`: `envelope` at t = 0 (base), 60 ms (mid-rise), 120 ms (peak), 600 ms (≈ 0.37 of the peak above base), and `Infinity` (base). `recordTick` then `brightness` gives the right value for the spiked neurons only. `isFading` is false once all neurons are past about 4 × `fallMs`.
- [X] T039 [P] [US2] Create `public/js/brain/layout.js` exporting `neuronPositions(neurons, seed)`. Neurons with a `soma` are centred and scaled uniformly into a unit cube (the largest extent maps to 2). Neurons with `soma` `null` (and all neurons of a toy brain, which has none) are placed on a seeded sphere using a fixed PRNG, so the layout is stable between reloads. Returns a `Float32Array` of `3 × neuronCount`. Rules: `specs/006-fly-status-panel/research.md` R6.
- [X] T040 [P] [US2] Create `tests/layout.test.mjs`: the soma layout keeps the aspect ratio (uniform scale); the seeded layout is the same for the same seed and different for another; the output length is `3 × neuronCount`.
- [X] T041 [P] [US2] Create `public/js/ui/panel/counts.js` (pure part): `windowCounts(history, neuronCount, windowTicks = 20)` returns a `Uint32Array` of spike counts over the last `windowTicks` entries, and `activeCount(counts)` the number of non-zero entries. Update `public/js/ui/panel/model.js` (T028) to add `activeCount`, `coveredCount` and `brightness` fields from these and `activity`.
- [X] T042 [P] [US2] Create `tests/panel-counts.test.mjs` for `windowCounts` (only the last 20 entries count) and `activeCount`.

### Browser rendering

- [X] T043 [US2] Create `public/js/viz/point-cloud.js` using three.js from the vendored file (`three` via the importmap in T030). Export `createPointCloud(canvas)` with `setPoints(positions, baseColour)`, `update(brightness)` (writes the colour attribute as `baseColour × brightness`), `resize()`, and `dispose()`. Orbit controls from `public/brains/vendor/three/OrbitControls.js`. Use the same background colour as the inspector (`#0e1016`), so the two views match. _(BUG-002: `dispose` must be called on every removal path, see T087.)_
- [X] T044 [US2] ⚠️ Reopened Create `public/js/ui/panel/sections/neuron-map.js`: `{ id: 'neuron-map', title: 'Brain activity', requires: { signal: 'spikes' }, render }`. It mounts the point cloud from T043 once per selected fly, shows the counts "N neurons, K active in the last 20 ticks", and shows "This brain exposes no spike signal" when a brain has no spikes. The section runs its own `requestAnimationFrame` loop while `activity.isFading(now)` is true, and stops when it is false; the next spike restarts it. (reopened — BUG-002: the point cloud is rebuilt and the old one leaked when the readout is replaced, the selection is cleared or a section errors; the map is also drawn by every refresh. Closed by T086–T088.) _(Done: closed by T086 and T087; the map is mounted once per fly and disposed on every removal path.)_
- [X] T045 [US2] Update `public/js/fly/fly-host.js`: each record gets `activity = createActivity(neuronCount)`. On each accepted `motor`, call `activity.recordTick(msg.spikes, performance.now())`. `loadSnapshot` (T020) already returns `neurons`, so the neuron map gets the soma positions.
- [X] T046 [US2] Update `public/js/main.js` and the panel so that each fly's point cloud positions come from `neuronPositions(neurons, seed)` (T039), computed once per brain and not per tick. Toy brains use the seeded sphere.
- [X] T047 [US2] Add the performance check for the point cloud in `tests/` as a Node script `scripts/bench-activity.mjs` (not run by `npm test`): 1,000 neurons, one `brightness` plus a colour-attribute write per frame; report the mean in ms. Target: under 2 ms at 1,000 neurons (SC-006 budget).

**Checkpoint**: User Story 2 works. Spiking neurons brighten and fade, the counts update, and the point cloud keeps the world responsive.

---

## Phase 5: User Story 3 - Read the Input Signals per Channel (Priority: P3)

**Goal**: The Inputs section shows one row per declared input channel, grouped under L and R, with a
bar, the label and the value.

**Independent Test**: Select a fly near fruit and watch "Food odour" rise. Move it away and the bar falls to
the resting level (quickstart step 4).

- [X] T048 [P] [US3] Create `public/js/ui/panel/channel-rows.js` (pure part): `groupBySide(channels)` returns `{ L: [...], R: [...] }`, placing `side: "both"` channels in both groups. `barFraction(value, [min, max])` returns the value clamped to the range as a fraction of it, between 0 and 1. _(BUG-001: `groupBySide` is no longer used for display; `barFraction` is kept. See T076.)_
- [X] T049 [P] [US3] Create `tests/channel-rows.test.mjs`: `groupBySide` puts a "both" channel in L and R; `barFraction` clamps below min and above max, and returns 0.5 at the midpoint.
- [X] T050 [US3] Update `public/js/ui/panel/model.js`: add `inputs` as `{ channel, value }[]` for each input channel of the declaration. The value comes from the record's last tick for the channel's neuron: `sensory` for neuron 0 (the only input the world drives). With no tick yet, the value is the resting level (`0`).
- [X] T051 [US3] Create `public/js/ui/panel/channels.js` (DOM part): `renderChannelRows(container, rows)` writes one row per channel, grouped under "Left (L)" and "Right (R)" headings. Each row has the label, a bar whose width is `barFraction(value, range)` as a percentage, and the value with two decimals (the true value, not the clamped one). All text via `textContent`. _(Superseded by T078, BUG-001: one centred row per channel, no L/R headings.)_
- [X] T052 [US3] Create `public/js/ui/panel/sections/inputs.js`: `{ id: 'channels-input', title: 'Inputs', requires: { channels: 'inputs' }, render }`, using `renderChannelRows` with `model.inputs`.
- [X] T053 [US3] Add `inputs` to the section list in `public/js/main.js` (after action and neuron-map). Confirm the Inputs section is not mounted for a brain with no input channel (FR-008 via `selectSections`).

**Checkpoint**: User Story 3 works. Input rows appear from the declaration and follow the fruit signal.

---

## Phase 6: User Story 4 - Read the Output Signals per Channel (Priority: P3)

**Goal**: The Outputs section shows one row per declared output channel, grouped under L and R, with the same
bar and value rendering as the inputs.

**Independent Test**: Select a fly and turn it. The bar of the side it turns toward grows, and the action
agrees with the bars (quickstart step 4).

- [X] T054 [US4] Update `public/js/ui/panel/model.js`: add `outputs` as `{ channel, value }[]`. The value of each output channel is `record.history.at(-1).outputs[k]`, where `k` is the channel's index in the declaration's outputs. With no tick yet, the value is `0`.
- [X] T055 [US4] Create `public/js/ui/panel/sections/outputs.js`: `{ id: 'channels-output', title: 'Outputs', requires: { channels: 'outputs' }, render }`, using `renderChannelRows` (T051) with `model.outputs`.
- [X] T056 [US4] Add a test to `tests/panel-model.test.mjs`: the `outputs` values match the record's `outputs` by declaration index, and the output with `drive: "left"` equals the `left` value of the last tick (the check the protocol relies on).
- [X] T057 [US4] Add `outputs` to the section list in `public/js/main.js`. Confirm the body still reads `left` and `right` from the message, so turning and speed are unchanged. Check with `tests/fly-brain.test.mjs` (T016).

**Checkpoint**: User Story 4 works. The output bars match the drive that moves the fly.

---

## Phase 7: User Story 5 - Extend the Panel to New Brain and Neuron Capabilities (Priority: P3)

**Goal**: A new channel or signal is a declaration change. A bad declaration is reported, and a failing section
cannot break the others.

**Independent Test**: Add one display-only output to the toy declaration and reload. The new row appears under
its side with no panel file changed (quickstart step 5).

- [X] T058 [P] [US5] Add a test to `tests/panel-model.test.mjs`: a declaration with one extra output and no `drive` produces one more row in `model.outputs`, and the drive outputs are unchanged. This is the "add a channel, change no panel code" check (SC-004).
- [X] T059 [P] [US5] Add a test to `tests/panel-registry.test.mjs`: a new section that requires an unknown signal (for example `membrane`) is not selected for a brain whose signals are `["spikes"]`, and it is selected once the declaration lists `membrane`.
- [X] T060 [P] [US5] Add a test to `tests/validate-snapshot.test.mjs` (or `tests/capabilities.test.mjs`, created here): each malformed declaration (empty label, side "X", input on neuron 1, duplicate id, two left drives, no drive at all) is rejected with the error that names the channel id and the field (SC-005).
- [X] T061 [US5] Confirm that the error path reaches the user: in `public/js/main.js` (T021), a bad toy declaration or override puts its message on the error panel and no fly starts. Check the message names the channel id and the field (FR-009, quickstart step 6).
- [X] T062 [US5] Confirm that a baseline fly (no brain) shows "This brain exposes no spike signal" in the neuron map, while the Action and Outputs sections still work (FR-011, quickstart step 6). Adjust `public/js/ui/panel/sections/neuron-map.js` (T044) if needed.

**Checkpoint**: User Story 5 works. A new channel is data, and a broken section stays inside its box.

---

## Phase 8: Bugfix BUG-001 - Tabs and Centred Channel Bars

**Goal**: The panel has two tabs, World (fly list) and Fly (status). Each channel is one row with a zero line
in the middle: L bars grow left, R bars grow right, and colours tell the sides apart.

**Source**: `specs/006-fly-status-panel/bugs/BUG-001.md`. Behaviour is defined by FR-016 to FR-018 and the
BUG-001 decisions in `spec.md`.

- [X] T071 [P] [US1] Create `public/js/ui/panel/tabs.js` (pure part): `TABS = ["world", "fly"]`, `initialTab = "world"`, and `nextTab(current, event)`. A `{ type: "select" }` event (a fly chosen by click or from the list) returns `"fly"`. A `{ type: "tab", tab }` event returns `tab` when it is in `TABS`, otherwise `current`.
- [X] T072 [P] [US1] Create `tests/tabs.test.mjs`: the initial tab is `world`; a select event gives `fly`; a tab event with an unknown name leaves the tab unchanged.
- [X] T073 [US1] Update `public/js/ui/panel/panel.js`: replace the single column of T034 with a tab bar (two buttons, `role="tab"`, `aria-selected`) and two panes. The World pane holds the fly list (the T034 buttons, unchanged). The Fly pane shows the sections for the selected fly, or the prompt "Select a fly in the world or in the list" when none is selected. Switching tabs does not change the selection. Signature: `renderPanel(container, records, selectedId, onSelect, sections, tab, onTab)`. _(BUG-002: the shell owns the section lifecycle, see T085.)_
- [X] T074 [US1] Update `public/js/main.js`: keep the current tab in one variable. The selection function (T035) sets the tab with `nextTab(tab, { type: "select" })`, so a world click and a list pick both switch to Fly. The tab buttons call `nextTab(tab, { type: "tab", tab: name })` and re-render. The world click and the list still call the same selection function (FR-013). _(BUG-002: the refresh is split into a structural render and a value update, see T084.)_
- [X] T075 [US1] Update `public/index.html` and `public/css/style.css`: add the tab bar markup and styles, show one pane at a time at every width, keep the stage grid from T031, and keep the 16 px gutter with no horizontal scroll below 900 px (FR-015, FR-016). _(Done: `index.html` needed no change, because `panel.js` builds the tab bar at runtime, as it already builds the fly list.)_
- [X] T076 [P] [US3] Update `public/js/ui/panel/channel-rows.js`: add `centredFraction(value, range)`, which returns the value clamped to `[0, range[1]]` as a fraction of `range[1]`, between 0 and 1. Negative values give 0. The declared minimum is not used, so it does not move the zero line. Keep `barFraction` and `groupBySide` (see T048 note).
- [X] T077 [P] [US3] Update `tests/channel-rows.test.mjs`: `centredFraction` gives 0 at 0 and below, 1 at `range[1]` and above, 0.5 at half of `range[1]`, and ignores `range[0]` (range `[0.2, 2]`, value 1 gives 0.5).
- [X] T078 [US3] Update `public/js/ui/panel/channels.js` (supersedes T051): `renderChannelRows(container, rows)` writes one row per channel, with no L/R headings. Each row has the label, a track with a zero line at its centre, and a bar. A `side: "L"` bar is anchored at the centre and grows left, with width `centredFraction` × 50% of the track. A `side: "R"` bar grows right. A `side: "both"` channel draws one bar on each side in the neutral colour. The value shows the true number with two decimals. All text via `textContent`. _(BUG-002: rows are built once per fly and updated in place, see T088.)_
- [X] T079 [US3] Update `public/css/style.css`: row layout for the centred track. Add the tokens `--bar-left`, `--bar-right` and `--bar-both` on `:root`, with dark-mode values under both existing dark-mode selectors. Keep the other colour tokens unchanged. The three colours must be distinguishable in both themes.
- [X] T080 [US4] Check that `public/js/ui/panel/sections/inputs.js` and `outputs.js` need no change: they keep their titles and call `renderChannelRows`. Change them only if a title or a side heading is still rendered.
- [X] T081 [US1] Update `specs/006-fly-status-panel/quickstart.md` steps 3–5 for the World and Fly tabs and the centred bars, and `specs/006-fly-status-panel/checklists/requirements.md` for FR-016 to FR-018. Run `npm test`, then walk through quickstart steps 3–5 at `python3 -m http.server 8000` with no console errors. _(Done: quickstart updated. `checklists/requirements.md` was not changed, because the implement rules keep checklist files read-only; its items still hold.)_

**Bugfix**: 2026-10-05 — BUG-001 Updated from bugfix patch

---

## Phase 9: Bugfix BUG-002 - Value Updates in Place and Brain Map Lifetime

**Goal**: A tick or a refresh changes only values in the existing panel elements, so nothing flickers.
The brain map is built once per selected fly, is kept across ticks and tab switches, and is disposed
exactly once, so at most one WebGL context is alive and the map draws in Safari and Chrome.

**Source**: `specs/006-fly-status-panel/bugs/BUG-002.md`. Behaviour is defined by FR-012, FR-019, FR-020,
SC-008, SC-009 and the BUG-002 decision in `spec.md`, and by Key Design Decision 8 in `plan.md`.

- [X] T082 [US5] Update `specs/006-fly-status-panel/contracts/panel-sections.md`: _(Done: `mount` returns a handle `{ update, dispose }`, so per-mount state stays out of the shared section object.)_ a section is `{ id, title, requires, unmet, mount(container, model), update(model), dispose() }`. `mount` builds the section's elements once per selected fly; `update` writes only values that changed and builds no element; `dispose` frees what `mount` created and is called exactly once, before the section's element is removed. Record the structural-change list from FR-019 and the rule that an error in `mount` or `update` stays in the section's box.
- [X] T083 [P] [US5] Update `public/js/ui/panel/registry.js` (pure part): replace `runSection(section, body, model)` with `mountSection(section, body, model)`, `updateSection(mounted, model)` and `disposeSection(mounted)`. Each catches errors and returns `{ ok: true }` or `{ ok: false, error: "<title>: <message>" }`. `disposeSection` is idempotent (a second call does nothing). Add tests to `tests/panel-registry.test.mjs`: an error in `update` gives `ok: false` and the next section still updates; `dispose` runs once per mount even when called twice; a section without `dispose` is accepted.
- [X] T084 [US1] Update `public/js/main.js`: keep `updatePanel` (structural render, one per frame) for select, tab, layer toggle and a change of the selected fly's status. Replace the `PANEL_INTERVAL_MS` timer body with a value update: it calls a new `updatePanelValues(panel, records, selectedId)` from `panel.js` only when the selected fly's last tick is newer than at the previous update. Ticks of other flies only refresh the fly list text. Keep `PANEL_INTERVAL_MS = 200` (FR-012).
- [X] T085 [US1] Update `public/js/ui/panel/panel.js`: keep the mounted sections of the selected fly in a shell-owned record `{ flyId, sections: [{ section, body, ok }] }`. The structural render mounts sections for a new fly and calls `disposeSection` for every mounted section on each path that removes them: another fly selected (before the readout is replaced), the selection cleared (before `showMessage`), the fly status `error`, a section error that writes text into its box, and a section dropped from the shown set. Export `updatePanelValues(container, records, selectedId)`, which builds the model once and calls `updateSection` on each mounted section; it creates and removes no element (FR-019, SC-009).
- [X] T086 [US2] Update `public/js/ui/panel/sections/neuron-map.js` (closes T044): split into `mount` (canvas, counts element, `createPointCloud`, `setPoints`, `resize`), `update` (counts text when it changes, `activity` reference, restart the loop) and `dispose` (cancel the loop, `cloud.dispose()`). Remove the `WeakMap` lookup and the `body.contains` checks. The rAF loop is the only path that calls `cloud.update`. It stops while the Fly pane is hidden and restarts when the Fly tab is shown, calling `resize` then.
- [X] T087 [US2] Update `public/js/viz/point-cloud.js`: keep a module-level count of live point clouds, increased in `createPointCloud` and decreased in `dispose` (which becomes idempotent). Export `livePointClouds()` for a development check. `neuron-map.js` logs `console.error` when a mount finds a live count above 0 after the previous mount was disposed (FR-020: at most one brain map).
- [X] T088 [US3] Update `public/js/ui/panel/channels.js` (closes the BUG-002 part of T078): split `renderChannelRows` into `mountChannelRows(container, rows)`, which builds one row per channel once, and `updateChannelRows(container, rows)`, which sets each fill's `style.width` and the value text only when they change. Update `public/js/ui/panel/sections/inputs.js` and `outputs.js` to the `mount` / `update` shape. Row layout, colours and `centredFraction` are unchanged (FR-017, FR-018).
- [X] T089 [US1] Update `public/js/ui/panel/sections/action.js` to the `mount` / `update` shape. `update` writes the label only when it differs from the shown text.
- [X] T090 [US1] Update `public/js/ui/panel/sections/index.js` and any other section so every entry in `SECTIONS` has `mount` and `update`. Grep for leftovers: `grep -rn "runSection\|render(body\|renderChannelRows" public/js tests`.
- [X] T091 [P] [US1] Add a test `tests/panel-lifecycle.test.mjs` with fake sections and a minimal DOM stub (or the pure part of T085 if it is extracted) _(Done: the pure part is `public/js/ui/panel/lifecycle.js`, used by `panel.js`.)_: select fly A, update 10 times, select fly B, clear the selection. `mount` runs once per fly, `dispose` once per mount, and `update` never calls `mount`.
- [X] T092 [US2] Update `specs/006-fly-status-panel/quickstart.md`: add a Safari and Chrome step for SC-008. Six flies run for one minute; select a fly, switch tabs 10 times, select other flies 10 times, clear the selection. The brain map draws each time the Fly tab shows a fly, nothing flickers, `livePointClouds()` is at most 1, and the console has no WebGL context warnings. Add the SC-009 check: in the Elements panel, no node is added or removed while flies run and the user does nothing. Run `npm test`, then this step in both browsers (closes T069 with it).

**Bugfix**: 2026-10-05 — BUG-002 Updated from bugfix patch

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup and the constitution's run check.

- [X] T063 [P] Update `specs/003-malecns-brain-extractor/contracts/snapshot-format.md` with a pointer to `specs/006-fly-status-panel/contracts/snapshot-format-v3.md` as the current version (the constitution requires the documents to change in the same change).
- [X] T064 [P] Update `specs/002-toy-lif-fly-network/contracts/worker-protocol.md` with a pointer to `specs/006-fly-status-panel/contracts/worker-protocol-v2.md`, and `specs/002-toy-lif-fly-network/contracts/fly-config.md` to say `telemetry` was removed.
- [X] T065 [P] Add an entry for this feature to `specs/CHANGELOG.md` under the 2026-10-05 heading, in the existing style (one line naming the feature and what changed).
- [X] T066 Grep the repository for leftovers: `grep -rn "telemetry\|selected\|fly-panel.js\|innerWidth" public/js public/index.html scripts tests extract/malecns_brain`. Remove what is no longer used.
- [X] T067 Run `npm test` and `extract/.venv/bin/python -m unittest discover -s extract/tests -p "test_*.py"`. All pass.
- [X] T068 Run the performance script from T047 and record the result in `specs/006-fly-status-panel/quickstart.md`.
- [X] T069 ⚠️ Reopened Run `python3 -m http.server 8000` and walk through `specs/006-fly-status-panel/quickstart.md` steps 3–7. Confirm no console errors (constitution run check). (reopened — BUG-002: the brain map does not draw in Safari, a target platform. Re-run in Safari and Chrome after T092.) _(Done: re-run in Playwright WebKit and Chromium with quickstart step 8; desktop Safari is still to be checked by hand.)_
- [X] T070 [P] Update the feature `specs/006-fly-status-panel/checklists/requirements.md` if any spec requirement changed during implementation. Otherwise leave it.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T001 is needed by T010.
- **Foundational (Phase 2)**: Depends on Setup. Blocks all user stories, because the declaration, the
  protocol and the spike stream are used by every panel section.
- **User Stories (Phase 3+)**: All depend on Foundational. US1 (P1) is the MVP.
  - US2 needs US1's panel shell (T034) and section list (T035).
  - US3 and US4 need the model (T028, T050, T054) and the channel rows (T048, T051).
  - US5 is verification plus tests, and needs US1 to US4.
- **Bugfix (Phase 8, BUG-001)**: Depends on US1, US3 and US4. It supersedes T034 and T051, which stay checked
  as history. Polish runs after it.
- **Bugfix (Phase 9, BUG-002)**: Depends on Phase 8. T082 first, then T083. T084 and T085 depend on T083.
  T086 and T087 depend on T085; T088 and T089 depend on T083 and can run in parallel with T086. T090 after
  T086–T089. T091 after T085. T092 last, then re-run T069.
- **Polish (final phase)**: Depends on all user stories and the bugfix phases. T069 is reopened until T092
  passes in Safari and Chrome.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories.
- **US2 (P2)**: After US1. Adds the neuron-map section to the shell.
- **US3 (P3)**: After US1. Independent of US2.
- **US4 (P3)**: After US3, because it reuses the channel rows (T051).
- **US5 (P3)**: After US1 to US4. Verifies the extension path.

### Within Each User Story

- Pure modules and their tests (marked [P]) come before the browser rendering.
- Model before sections. Sections before the section list in `main.js`.

### Parallel Opportunities

- Setup: T001 alone.
- Foundational: T002, T003 (different languages, no dependency) run together. T005, T007, T008, T009 are parallel
  once T004 is in progress. T016, T017, T018, T019 are parallel after T013 and T014.
- US1: T024–T029 are parallel. T030 and T031 are separate files and can be parallel.
- US2: T037–T042 are parallel. T043 can start once T030 is done.
- US3: T048 and T049 are parallel.

---

## Parallel Example: User Story 2

```bash
# Pure logic and tests together (different files):
Task: "T037 Create public/js/brain/activity.js"
Task: "T039 Create public/js/brain/layout.js"
Task: "T041 Create public/js/ui/panel/counts.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001) and Phase 2 (T002–T023). Run both test suites.
2. Complete Phase 3 (T024–T036).
3. **STOP and VALIDATE**: quickstart steps 3 and 4 (the split layout and the action).

### Incremental Delivery

1. Foundation (Phases 1–2). The app runs with the declaration and the v2 protocol.
2. US1: split layout and action. Demo the MVP.
3. US2: the fading point cloud.
4. US3 and US4: input and output bars.
5. US5 and Polish: validation, extension check, docs.

---

## Notes

- Tests that the constitution requires (snapshot format and protocol contract tests) are in Phase 2. The
  panel tests are limited to pure modules.
- The snapshot and protocol changes are foundational because every story depends on them.
- The only regenerated binary is the reference brain (T010). Its body bytes must not change.
- Stop at each checkpoint to validate the story independently.

---

## Summary

- **Total tasks**: 92
- **Per phase**: Setup 1 · Foundational 22 · US1 13 · US2 11 · US3 6 · US4 4 · US5 5 · Bugfix 11 (BUG-001) · Bugfix 11 (BUG-002) · Polish 8
- **Parallel tasks** (marked [P]): 39
- **Suggested MVP**: Phases 1–3 (T001–T036), the split layout and the action readout.

Format check: every task line starts with `- [ ] T` followed by the three-digit ID, uses `[P]` only for
parallelizable tasks, carries a `[US#]` label only in Phases 3–9, and names a file path.

**Bugfix**: 2026-10-05 — BUG-002 Updated from bugfix patch (Phase 9, T082–T092; T044 and T069 reopened).
