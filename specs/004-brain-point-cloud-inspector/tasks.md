# Tasks: Brain Point-Cloud Inspector

**Input**: Design documents from `specs/004-brain-point-cloud-inspector/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Prerequisites**: plan.md and spec.md (required). research.md, data-model.md, contracts/ and quickstart.md are used for the tasks below.

**Tests**: Included. The constitution requires tests for the Python pipeline, contract tests on both sides for any snapshot format change, and tests for pure browser modules (Development Workflow & Quality Gates). Test tasks are marked by file, not as optional.

**Phase order note**: The spec's old User Story 3 (positions in the snapshot) blocks every viewer story, so it is Phase 2 (Foundational). The spec's P3 story for level filter and annotations is Phase 5 here, because the request makes it required; spec.md's priority line should be updated to match.

**Organization**: Phases 3–5 are the user stories (US1 inspect, US2 switch and filter, US3 level filter and annotations).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1, US2, US3 (user story phases only)
- Paths are relative to the repository root `/Users/kolesnik/devel/go/src/github.com/fogfish/microfly`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Vendor the one new library and create the viewer folders.

- [X] T001 Vendor three.js r160 into `public/brains/vendor/three/`: download the npm package `three@0.160.0` (for example `npm pack three@0.160.0` into the scratch directory, then extract it there). Copy `build/three.module.min.js` as `public/brains/vendor/three/three.module.min.js` (if that file is absent in the package, copy `build/three.module.js` instead and record the choice in T002). Copy `examples/jsm/controls/OrbitControls.js` as `public/brains/vendor/three/OrbitControls.js`. Copy `LICENSE` as `public/brains/vendor/three/LICENSE`. Do not add `node_modules` or `package.json` changes to the repository.
- [X] T002 [P] Create `public/brains/vendor/three/README.md` recording: package `three`, version `0.160.0`, the source (npm registry), the exact file list copied in T001, the reason (constitution I: vendored library justified in plan.md Complexity Tracking), and the module file chosen (`three.module.min.js` or `three.module.js`).
- [X] T003 [P] Create the folders `public/brains/js/` (empty placeholders are not needed; the files in later phases create them) and confirm `public/brains/` holds `smallest-functional-brain.brain` only, with no other files changed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Carry the 3D soma position and the superclass through the extractor, the container contract, both readers and the reference brain. Every viewer story depends on this.

**⚠️ CRITICAL**: No viewer story (Phase 3+) can start until this phase is complete.

### Extractor

- [X] T004 [P] Add `"somaLocation"` to `ANNOTATION_COLUMNS` in `extract/malecns_brain/dataset.py` (currently `["bodyId", "class", "superclass", "somaSide", "status", "type"]`). Nothing else in that file changes.
- [X] T005 In `extract/malecns_brain/selection.py`, function `admit()`: for each admitted body, add `"soma"` to the body dict. Value: the row's `somaLocation` if it is a list of exactly three integers (Python `int`, not `bool`), converted to a plain `list` of `int`; otherwise `None`. Do not change which bodies are admitted.
- [X] T006 In `extract/malecns_brain/selection.py`, function `select_brain()`: in each neuron record built in step 8 (the `neurons.append({...})` block), add `"superclass": b["superclass"]` and `"soma": b["soma"]`. Keys are inserted in any order (the header is written with sorted keys). Depends on T005.
- [X] T007 In `extract/malecns_brain/__main__.py`: (a) in `build_header()`, add `"positionSource": "body-annotations-male-cns-v1.0-minconf-0.5.feather:somaLocation"` to the `provenance` dict; (b) in `report()`, add a line after the `edges` line: `positions      N with soma, M without` where N and M count neurons whose `soma` is a list and is `None`. Depends on T006.
- [X] T008 Update `extract/tests/make_fixture.py` so the synthetic annotation table has a `somaLocation` column (list of int64). Give every synthetic body a three-integer position except one interneuron, which gets `None` (to exercise the null path). Then regenerate `tests/fixtures/synthetic-smallest.brain` with `cd extract && python3 tests/make_fixture.py <scratch-dataset-dir>` and update the hand-checked expected values in that file. Depends on T006.

### Container contract (Python reader and writer)

- [X] T009 In `extract/malecns_brain/container.py`, function `read_container()`: after the role check (rule 5), add rule 8 and rule 9 from `specs/004-brain-point-cloud-inspector/contracts/snapshot-header-additions.md`. For each neuron index `i`: if `soma` is present and not `None` and not a list of exactly three `int`, call `_reject(f"snapshot neuron {i} has a malformed soma position")`. If `superclass` is present and not `None` and not a `str`, call `_reject(f"snapshot neuron {i} has a malformed superclass")`. Missing keys are allowed. Messages must match the contract exactly.

### Extractor tests (run with `cd extract && .venv/bin/python -m unittest discover -s tests -t .`)

- [X] T010 [P] In `extract/tests/test_selection.py`, add tests: a body with a three-integer `somaLocation` gets that `soma` in the selected neuron; a body with `None`, an empty list, or a list of two values gets `soma: None`; `superclass` is carried to the neuron record. Depends on T006.
- [X] T011 [P] In `extract/tests/test_container.py`, add tests: a header with `soma` and `superclass` round-trips through `write_container()` and `read_container()`; a neuron with `soma: [1, 2]` raises `ValueError` with `snapshot neuron <i> has a malformed soma position`; a neuron with `superclass: 5` raises `snapshot neuron <i> has a malformed superclass`; a header without either field is still accepted. Depends on T009.
- [X] T012 [P] In `extract/tests/test_cli.py`, add a test that the report contains the line `positions` with the counts of neurons with and without `soma`, and that `provenance.positionSource` is written. Depends on T007.

### Browser reader and its contract test

- [X] T013 In `public/js/brain/snapshot.js`, function `parseSnapshot()`: after the role check, add the same two rules as T009 with the same messages. Use `reject()` as the rest of the file does. Do not change any other check.
- [X] T014 In `tests/snapshot.test.mjs` (existing file), add tests for T013: accepts a file with `soma` and `superclass`; rejects `soma: [1, 2]` and `superclass: 5` with the exact messages; accepts a file with neither field. Build the test fixture in memory from the existing helpers in that file, not from the network. Depends on T013 and T008.

### Reference brain regeneration

- [X] T015 Regenerate `public/brains/smallest-functional-brain.brain`. Steps: (1) copy the current file to a scratch directory as `before.brain`; (2) run `cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract --config configs/smallest-functional-brain.json --out ../public/brains/smallest-functional-brain.brain`; (3) confirm exit status 0 and the report says `self-check identical` and `positions  11 with soma, 0 without`; (4) confirm the body bytes are identical to `before.brain` using the byte comparison in `specs/004-brain-point-cloud-inspector/quickstart.md` step 2. If the body differs, stop and report it; do not commit the file. Depends on T007 and T009.
- [X] T016 [P] Create `tests/reference-brain.test.mjs`: parse `public/brains/smallest-functional-brain.brain` with `parseSnapshot()` from `public/js/brain/snapshot.js`; assert `neuronCount` is 11, `edgeCount` is 78, every neuron has a `soma` of three integers, `provenance.positionSource` is present. Depends on T015.

### Contract documentation

- [X] T017 [P] Add a short section to `specs/003-malecns-brain-extractor/contracts/snapshot-format.md` titled "Header additions (spec 004)" that links to `specs/004-brain-point-cloud-inspector/contracts/snapshot-header-additions.md` and states that `soma`, `superclass` and `provenance.positionSource` are optional fields within version 2.

**Checkpoint**: The extractor writes positions, both readers enforce the new rules, and the reference brain carries positions with an unchanged body. Viewer stories can start.

---

## Phase 3: User Story 1 - Inspect a brain snapshot in 3D (Priority: P1) 🎯 MVP

**Goal**: A page in `public/brains/` shows the reference brain as a 3D point cloud with edges, hover identity, camera controls, role colours and point/edge toggles.

**Independent Test**: Serve `python3 -m http.server 8000 -d public`, open `http://localhost:8000/brains/`. The reference brain shows 11 points and 78 edges. Hovering a point shows its `bodyId`, class, type, side, role and transmitter. Rotate, zoom, reset and the two toggles work. Quickstart step 4, items 1, 3, 4 and 5.

### Tests for User Story 1 (write first; they fail until T021–T024 exist)

- [X] T018 [US1] Create `tests/brain-inspector-model.test.mjs` (node test runner) with tests for `public/brains/js/model.js` (created in T019): `sceneTransform()` centres the bounding box of the given positions at the origin and scales the largest extent to 220; `bodyEdges()` returns one entry per CSR edge with `source` (the neuron whose offsets range holds the edge), `target` (`targets[k]`), `synapses` (raw count) and `weight` (from `weights[k]`), for a small hand-built snapshot object; neurons with `soma: null` are excluded from the drawable set and their edges are excluded.

### Implementation for User Story 1

- [X] T019 [US1] Create `public/brains/js/model.js`: pure ES module, no DOM, no three.js import. Export: `drawableNeurons(snapshot)` (indices of neurons whose `soma` is not `null`); `sceneTransform(positions)` returning `{ centre, scale }` per the reference rule (centre of the bounding box, scale = 220 / largest extent); `toScene(position, transform)` returning `[x, y, z]` with `x = (p0 - c0) * s`, `y = -(p1 - c1) * s`, `z = (p2 - c2) * s`; `bodyEdges(snapshot)` returning typed arrays `source`, `target`, `synapses`, `weight` for edges whose both ends are drawable. Depends on nothing; make the test in T018 pass.
- [X] T020 [P] [US1] Create `public/brains/js/scene.js`: three.js scene. Import three and OrbitControls from the import map (`three` and `three/addons/OrbitControls.js`, see T022). Export `createScene(canvas)` returning `{ setBrain(snapshot, drawableIndices), setPointsVisible(bool), setEdgesVisible(bool), setAutoRotate(bool), resetView(), pick(event) -> neuron index or null, dispose() }`. Points: one `THREE.Points` with a `Float32Array` position buffer and a colour buffer; colour by role (sensory, left, right, interneuron) with the palette `sensory #ffd166`, `left #06d6a0`, `right #ef476f`, `interneuron #8ecae6`; `PointsMaterial` with `size: 1, sizeAttenuation: false, vertexColors: true`. Edges: one `THREE.LineSegments` built from a `Float32Array` of endpoints, opacity from `0.15 + 0.8 * log10(synapses+1) / log10(max+1)` as in the reference. Camera: `PerspectiveCamera(45, aspect, 1, 5000)` at `(260, 170, 260)`, OrbitControls with damping. Picking: `Raycaster` against the points with a threshold. Do not import anything from `inspector/`.
- [X] T021 [US1] Create `public/brains/index.html`: page structure copied from the layout of `inspector/malecns-3d.html` (sidebar `#side` 340px and view `#view`, same dark CSS variables and classes; the copied CSS is pasted inline, not linked). Add an import map: `"three": "./vendor/three/three.module.min.js"` and `"three/addons/": "./vendor/three/"` (adjust the OrbitControls key so `three/addons/OrbitControls.js` resolves to `vendor/three/OrbitControls.js`; the OrbitControls file imports `three` only). Sidebar sections for this story only: heading, counts placeholder, Display (Soma points, Auto-rotate), Reset view button, Selected/hovered info panel, Help line. Error panel element `#error` (hidden by default). Module script `js/main.js`. No CDN URLs. Depends on T001.
- [X] T022 [US1] Create `public/brains/js/controls.js` (DOM only): `renderCounts({ neuronsInFile, edgesInFile, neuronsDrawn, edgesDrawn })`, `showInfo(html)`, `bindDisplay({ onPoints, onEdges, onAutoRotate, onReset })`. The info text for a neuron lists `bodyId`, class, type, soma side, role, transmitter with confidence, sign, and superclass where present. Use `textContent` or escaped text for values from the file (no raw HTML from the snapshot). Depends on nothing.
- [X] T023 [US1] Create `public/brains/js/main.js` for this story: fetch `smallest-functional-brain.brain` (fixed for now; the switcher comes in Phase 4), parse with `parseSnapshot` from `../../js/brain/snapshot.js`, compute drawable neurons with `model.js`, build the scene with `scene.js`, bind `controls.js`. Connect hover (`pick` on pointer move) to `showInfo`. Depends on T019, T020, T021, T022.
- [X] T024 [US1] In `public/brains/js/main.js` (same file as T023, so run after it): error states from the contract `specs/004-brain-point-cloud-inspector/contracts/brain-inspector-page.md`. A reader rejection shows the error panel with the reader's message and draws nothing. A brain with no drawable neuron shows "No neuron has a 3D position". A missing WebGL context shows a message naming WebGL. Errors are logged with `console.error`. Depends on T023.

**Checkpoint**: User Story 1 works on the reference brain alone. Tests in T018 pass with `node --test tests/brain-inspector-model.test.mjs`.

---

## Phase 4: User Story 2 - Choose other snapshots and filter edges (Priority: P2)

**Goal**: The user switches between brains from a manifest, can filter edges by minimum synapse count, and large brains show a capped number of top edges with the counts on screen.

**Independent Test**: Open `http://localhost:8000/brains/?brain=smallest-functional-brain.brain`; the switcher shows the label from the manifest. Put a second valid brain in the manifest (a test copy in the scratch directory is enough) and switch: the view changes, the address updates. The top-edge slider never draws more than its value; the minimum-synapse slider removes edges below it. Quickstart step 4, item 3; step 5 error paths.

### Tests for User Story 2 (write first)

- [X] T025 [US2] Extend `tests/brain-inspector-model.test.mjs` (created in T018) with tests for: `topEdges(snapshot, n)` returns exactly `min(n, edgeCount)` edges, the largest by `synapses`, with ties resolved by ascending edge index; `filterMinSynapses(edges, min)` keeps edges with `synapses >= min`; `validateManifest(object)` accepts the contract in `specs/004-brain-point-cloud-inspector/contracts/brains-manifest.md` and returns the listed errors for a wrong `format`, a `default` that is not an entry, a duplicate `file`, and a `file` with a path separator. Depends on T018.
- [X] T026 [US2] Create `tests/brain-inspector-manifest.test.mjs`: read `public/brains/brains.json`, validate it with `validateManifest` from `public/brains/js/model.js`, and parse every listed brain file with `parseSnapshot`. Depends on T027 (manifest exists) and T028 (`validateManifest` exists).

### Implementation for User Story 2

- [X] T027 [P] [US2] Create `public/brains/brains.json` with the format from `specs/004-brain-point-cloud-inspector/contracts/brains-manifest.md`: `format: "brain-manifest"`, `version: 1`, `default: "smallest-functional-brain.brain"`, one entry `{ "file": "smallest-functional-brain.brain", "label": "Smallest functional brain" }`.
- [X] T028 [US2] Extend `public/brains/js/model.js` (same file as T019, so run after it) with: `topEdges(snapshot, n)` using the histogram method from research R7 (a `Uint32Array` of 65,536 counts over `synapses`, find the largest threshold with at least `n` edges above or equal to it, then take edges above it plus edges equal to it in index order until `n`); `filterMinSynapses(edges, min)`; `validateManifest(object)` returning an array of error strings (empty when valid); `brainFromAddress(search, manifest)` returning the `?brain=` value when it is in the manifest, else `manifest.default`. Depends on T019.
- [X] T029 [US2] Extend `public/brains/js/controls.js` (same file as T022, so run after it): a brain switcher `<select>` filled from the manifest labels; a "Minimum synapses" slider (log scale from 1 to 10,000, as the reference's minimum-weight slider); a "Top edges" slider (20 to 3,000, default 300); count display updated for drawn edges. Depends on T022.
- [X] T030 [US2] Extend `public/brains/js/scene.js` (same file as T020, so run after it): `setBrain()` must release previous geometry (`dispose()` on geometries and materials) so switching does not leak; the edge buffer is built from the arrays returned by `topEdges` and `filterMinSynapses`, with no per-edge objects. Depends on T020 and T028.
- [X] T031 [US2] Extend `public/brains/js/main.js` (same file as T024, so run after it): read the manifest from `brains.json` (error panel per T024 on failure), choose the brain with `brainFromAddress`, load it on the switcher's `change` event, update the address with `history.replaceState` to `?brain=<file>`, and when a switch fails show the error panel and clear the view (never show a mixed view). Edge drawing applies the minimum-synapse filter and the top-edge cap from the controls. Depends on T024, T028, T029, T030.

**Checkpoint**: The switcher works for every manifest entry. Edge counts stay within the top-edge cap. The URL is shareable.

---

## Phase 5: User Story 3 - Level filter and annotations like the reference inspector (Priority: P2 per request; P3 in spec.md)

**Goal**: Region, Superclass, Class and Type levels; group legend with visibility; group graph and body modes; role descriptions and sources copied from `inspector/malecns-3d.html`.

**Independent Test**: With the reference brain open, switch Level through Region, Superclass, Class, Type; the legend and the group points update. Group graph draws one curve per group pair. Hide a group in the legend and its points and edges disappear. Hovering a group shows its description. Quickstart step 4, item 2.

### Verification and tests for User Story 3

- [X] T032 [US3] Region rule check (research R4): with `extract/.venv/bin/python` and the annotation feather, count bodies per region using the rule in `specs/004-brain-point-cloud-inspector/research.md` R4 (superclass prefixes). Compare the counts with the `n` values of `levels.region.groups` in `inspector/malecns-3d.html` (read the embedded `const DATA = ...` JSON by reading the line; do not edit the file). Put the comparison table in the scratch directory. If any count differs, update R4 in research.md and the rule before T034 is written. Record the result in a comment at the top of `public/brains/js/model.js` as a one-line summary.
- [X] T033 [P] [US3] Create `tests/brain-inspector-groups.test.mjs`: tests for `regionOf(superclass)` (every rule in data-model.md section 4, including `null` → Unannotated and an unknown string → Unannotated); `groupsForLevel(snapshot, level)` produces one group per distinct value with the correct `members` and `count`; a neuron with no `soma` is not a member of any placed group but is counted in the group's total as the spec requires; `groupCentroids` places a group with no member positions at the weighted mean of its neighbours (research R6); `groupEdges(snapshot, level)` sums body synapses between groups and excludes self-pairs. Depends on nothing (uses the public API named here; the module comes in T034).

### Implementation for User Story 3

- [X] T034 [US3] Extend `public/brains/js/model.js` (same file as T019 and T028, so run after T028) with: `regionOf(superclass)` (rules from data-model.md section 4); `groupsForLevel(snapshot, level)` (levels `region`, `superclass`, `class`, `type`; value naming: class missing with superclass present is `(no class) <superclass>`; missing region value is `Unannotated`, missing type value is `Untyped`); `groupCentroids(groups, edges, positions)`; `groupEdges(snapshot, level)`. Depends on T028 and T032.
- [X] T035 [P] [US3] Create `public/brains/js/annotations.js` by generating it with a one-off script in the scratch directory: read `inspector/malecns-3d.html` (read only), extract the `ROLES` object and the sources list (the `sources` array written into `#sources`), and write them as `export const ROLES = {...}; export const SOURCES = [...];` with JSON values copied verbatim. Do not hand-type the descriptions. The inspector file must stay byte-identical (checksum in quickstart step 1). Commit only the generated file.
- [X] T036 [US3] Extend `public/brains/js/scene.js` (same file as T020 and T030, so run after T030): group mode drawing: one sphere per placed group at its centroid, radius `2 + 5 * log10(count + 1) / log10(maxCount + 1)`, colour from the region palette for region level (`Optic lobe #4fc3f7`, `Central brain #ffb74d`, `Ventral nerve cord #81c784`, `Brain-VNC pathways #e57373`, `ENS #ba68c8`, `Unannotated #7d7d7d`) and a hue from the name hash for other levels (reference rule); one quadratic curve per group pair (reference `curvePoints` with lift 0.22); labels for the 14 largest visible groups; point density with a stable random rank per neuron (reference `keepRand` with seed 12345). Depends on T030 and T034.
- [X] T037 [US3] Extend `public/brains/js/controls.js` (same file as T022, T029, so run after T029): Level radio group (Region, Superclass, Class default, Type); Connections radio group (Group graph default, Top body-to-body); group-mode minimum-synapse slider (reuse the T029 slider); a Display "Unannotated" checkbox; a point-density slider; a Groups legend with a checkbox, colour swatch, name and count per group, sorted by count, with "Show all" and "Hide all" buttons. Type level hides "Other typed" and "Untyped" by default (reference default). Depends on T029.
- [X] T038 [US3] Extend `public/brains/js/controls.js` (same file as T037, so run after it): the info panel for a group shows its name, level label, count, the role description from `ROLES` in `annotations.js` (T035), "placed by neighbours" when the group has no member positions, and the largest outgoing and incoming groups with synapse totals. Add the `(no class) <superclass>` description using the superclass text, with the note "Unclassified: superclass <name> only." (reference `roleFor`). Depends on T037 and T035.
- [X] T039 [US3] Extend `public/brains/index.html` (same file as T021 and T029): the Level, Connections, Groups and Sources sections, the sidebar note "Snapshots hold only Traced bodies, so the reference status filter is not shown.", and the sources list rendered from `SOURCES` in `annotations.js`. Depends on T021, T037.
- [X] T040 [US3] Extend `public/brains/js/main.js` (same file as T031, so run after it): wire Level and Connections changes to rebuild the view; hidden-group state per level stored in memory (not persisted); the group graph uses `groupsForLevel`, `groupCentroids` and `groupEdges`; the body mode continues to use `topEdges`. Depends on T031, T036, T037, T038.

**Checkpoint**: All four levels work on the reference brain. Group graph and body modes agree with the reference inspector's behaviour (same defaults and labels).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the whole feature against the spec, the constitution and the quickstart.

- [X] T041 [P] Run `npm test` from the repository root. Fix any failing test in the viewer and reader files; do not weaken a test to make it pass. Report any failure with its output.
- [X] T042 [P] Run `cd extract && .venv/bin/python -m unittest discover -s tests -t .`. Fix failures the same way as T041.
- [X] T043 [P] Check the viewer has no network dependency: `grep -RnE "https?://" public/brains --include=*.html --include=*.js --include=*.json` must return nothing except comments and the `LICENSE`/`README.md` in `vendor/three/`. Remove any runtime URL.
- [X] T044 [P] Check `inspector/malecns-3d.html` is unchanged: `shasum -a 256 inspector/malecns-3d.html` must equal `fcd9e96285aa49b6256b28a829607b491edb4c71df103851477be4ddfda0775c`.
- [X] T045 Run the app per `specs/004-brain-point-cloud-inspector/quickstart.md` steps 4 and 5 with `python3 -m http.server 8000 -d public`. Check the reference brain loads, the error paths show the messages from the contracts, and the browser console has no errors on `http://localhost:8000/brains/` and `http://localhost:8000/`. Confirm one fly still starts on the simulator page (constitution run check).
- [X] T046 [P] Confirm the contract docs match the code: the messages in `specs/004-brain-point-cloud-inspector/contracts/snapshot-header-additions.md` appear verbatim in `extract/malecns_brain/container.py` and `public/js/brain/snapshot.js`; the page behaviour in `contracts/brain-inspector-page.md` matches the labels in `public/brains/index.html`. Fix the code or the doc, whichever is wrong, and say which.
- [X] T047 Remove scratch files created during the work from the repository (any `before.brain`, scratch dataset or test copies in `public/brains/`). Check `git status` shows only the intended changes.
- [ ] T048 Optional, local only: run quickstart step 6 with the full admitted subgraph. It is not committed. Confirm the drawn edge count is at most 3,000 and the on-screen count matches.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup for T001 (vendored files are needed only by the viewer, so T004–T017 can start in parallel with Setup).
- **US1 (Phase 3)**: Depends on Foundational (needs the regenerated reference brain, T015).
- **US2 (Phase 4)**: Depends on US1 (extends its files).
- **US3 (Phase 5)**: Depends on US2 (extends its files; T032 can start after Phase 2).
- **Polish (Phase 6)**: Depends on all phases.

### Within each phase

- Files shared by several tasks are edited in sequence (noted in each task). Tasks in different files may run in parallel when marked [P].
- Test tasks named in the "Tests" subsections are written before their implementation and fail until it exists.

### Parallel Opportunities

- Phase 1: T002 and T003 in parallel with T001's file copy.
- Phase 2: T004, T010–T012 are parallel once their dependencies exist; T016 and T017 are parallel with the rest of Phase 2.
- Phase 3: T020 (scene.js) and T022 (controls.js) are parallel with T019 (model.js) and T021 (index.html).
- Phase 4: T026 and T027 in parallel once T028 and T030 exist; T025 is the test extension.
- Phase 5: T033 and T035 in parallel with T032.
- Phase 6: T041–T044, T046 in parallel.

---

## Parallel Example: User Story 1

```text
# In parallel once Phase 2 is done:
T019 Create public/brains/js/model.js
T020 Create public/brains/js/scene.js
T021 Create public/brains/index.html
T022 Create public/brains/js/controls.js
# Then:
T023 Create public/brains/js/main.js (needs T019–T022)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (Setup) and Phase 2 (Foundational) — extractor, readers, reference brain with positions.
2. Phase 3 (US1) — the inspector shows the reference brain in 3D.
3. **Stop and validate**: quickstart step 4, items 1, 3, 4, 5.

### Incremental Delivery

1. Add US2: switcher, manifest, minimum-synapse filter, top-edge cap. Validate quickstart step 4 item 3 and step 5.
2. Add US3: level filter, legend, group graph, annotations. Validate quickstart step 4 item 2.
3. Polish: full test runs, no-network check, inspector checksum, simulator run check.

---

## Notes

- The reference brain is regenerated once (T015). Its body bytes must match the old file; only the header changes.
- `inspector/malecns-3d.html` is read but never written (T032, T035, T044).
- Fixtures: `tests/fixtures/synthetic-smallest.brain` is regenerated in T008 and is labelled as synthetic (constitution III).
- Commit only after a task group is verified; the git hooks offer commits, and none is run by this command.
