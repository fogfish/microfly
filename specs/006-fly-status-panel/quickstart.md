# Quickstart: Fly Status Side Panel

Validation guide for the feature. It proves the panel works end to end and that the declaration can
be extended. Implementation detail is in `tasks.md` (created later by `/speckit-tasks`).

## Prerequisites

- Node 20+, Python 3.11+ with the extractor venv at `extract/.venv` (`extract/requirements.txt`).
- The repository root as the working directory.

## 1. Run the unit tests

```bash
npm test
extract/.venv/bin/python -m unittest discover -s extract/tests -p "test_*.py"
```

Expected: all tests pass. New tests cover the declaration rules, the fade envelope, the layout, the
action label, the section registry, snapshot version 3 and protocol version 2
(see the Tests list in `plan.md`).

## 2. Migrate the reference brain (once)

```bash
cd extract
.venv/bin/python -m malecns_brain.migrate \
  ../public/brains/smallest-functional-brain.brain \
  configs/smallest-functional-brain.json \
  ../public/brains/smallest-functional-brain.brain
cd ..
```

Expected:

- the header reports `formatVersion` 3 and a `capabilities` block,
- the body bytes equal the old body bytes (the migration test checks this),
- the old version 2 file is rejected by the browser with `unsupported snapshot version 2; this build supports 3`
  before the migration.

## 3. Start the app and check the layout

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/` in a desktop-width browser window.

- The world is on the left and the status panel on the right, with no overlap (FR-001).
- The panel opens on the **World** tab, which lists the flies. Choosing a fly switches to the **Fly** tab (FR-016).
- Narrow the window below 900 px: the panel stacks under the world, with no horizontal scroll (FR-015).
- The browser console shows no errors (constitution, run check).

## 4. Check the fly status

Select a fly by clicking it in the world, or from the fly list.

- The **Action** section shows one of Forward, Turn left, Turn right, Idle, and changes as the fly moves.
- The **Brain activity** section shows the point cloud. Neurons that spike brighten and fade over about
  a second. Silent neurons stay dim (SC-003).
- Each channel is one centred row with a zero line in the middle. The **Inputs** section shows `Food odour` as a
  bar on both sides of zero, rising near fruit (User Story 3, FR-017).
- The **Outputs** section shows `Left motor` as a bar growing left from zero and `Right motor` as a bar growing
  right, in different colours (User Story 4, FR-017, FR-018).

## 5. Check the extension path

Add a display-only output to the toy declaration in `public/js/brain/capabilities.js` (or to the config's
`capabilities` block for a snapshot brain) with an id, label and side, and no `drive`.

- Reload the page. The new row appears in the Outputs section as a centred bar on its side, with no other file
  changed (SC-004).
- The fly still turns and moves as before, because the new output has no `drive`.

## 6. Check the error paths

- Set a channel label to an empty string in the declaration. The error panel names the channel id and
  the field, and no fly starts with it (FR-009, SC-005).
- Set a baseline fly in `flies.mode` to `baseline`. The map shows `This brain exposes no spike signal`,
  and the Action and Outputs sections still work (FR-011).

## 7. Check the connectome world

Run the app with the world config set to `world/world-connectome.json` (the connectome world, with the
snapshot brain) and confirm the same panel content, with the reference brain's 11 neurons and its
three declared channels.

## Recorded results (2026-10-05)

- `npm test`: 218 passing. `extract/.venv/bin/python -m unittest discover -s extract/tests -p "test_*.py"`: 95 passing.
- Point cloud budget (`node scripts/bench-activity.mjs`, 1,000 neurons): 0.003 ms mean per frame for the brightness
  and colour writes (budget 2 ms). The GPU upload is not included in that figure.
- Headless Chrome, 1280 × 800 and 390 px wide, toy world, connectome world (`?world=world/world-connectome.json`) and a
  baseline world: the split layout is 920 px beside a 360 px panel; the narrow layout stacks the panel under the world with no
  horizontal scroll. Each section renders with live values, and the baseline fly shows "This brain exposes no spike signal".
  The only console message is the browser's automatic `favicon.ico` 404, which the app has never served.
