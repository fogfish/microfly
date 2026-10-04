# Quickstart: Arcade World

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Config contract**: [contracts/world-config.md](contracts/world-config.md)

This guide proves the feature works end to end. It is a run and verify guide, not an implementation guide.

## Prerequisites

- Python 3 (for the static server)
- Node.js 20 or later (for the automated tests only; the app itself does not need Node)
- A current evergreen browser (Chrome, Firefox or Safari)

## 1. Run the app

From the repository root:

```bash
cd public
python3 -m http.server 8000
```

Open <http://localhost:8000/>. The world appears centred at the default zoom.

Expected: the canvas fills the window, grass, water, rocks and trees are visible, and fruits, honey, fires and spiders are scattered on grass. The browser console shows no errors.

## 2. Run the automated tests

From the repository root:

```bash
npm test
```

(This runs `node --test tests/*.test.mjs`. Node 21 and later need a file glob, not a directory. No packages are installed.)

Expected: all tests pass. They cover:
- validation accepts `world.json` and rejects each broken-config case with the expected `path`
- generation gives the same grid and objects for the same seed, and different ones for another seed
- no object is placed on a terrain it does not allow, and no object is placed on water
- the generation report lists any shortfall
- camera zoom keeps the cursor point fixed, respects min and max, and clamps pan to the world bounds

## 3. Verify controls (manual)

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Press and drag with the left mouse button | The world pans in the drag direction |
| 3.2 | Drag far past each edge of the world | The view stops at the world edge. No empty space is shown |
| 3.3 | Hover over a tree, then scroll the wheel up | The view zooms in and the tree stays under the cursor |
| 3.4 | Scroll the wheel down repeatedly | Zoom stops at the configured minimum. Nothing breaks |
| 3.5 | Scroll the wheel up repeatedly | Zoom stops at the configured maximum |
| 3.6 | Resize the browser window | The world stays visible and the zoom level is kept |

Covers FR-006 to FR-010 and SC-002, SC-003.

## 4. Verify element readability (manual)

At the default zoom, check that:

- fruits (apple, cherry) and honey look different from each other and from the terrain
- fire and spider look different from edible items and from terrain
- at minimum zoom, edible items and dangers remain distinguishable

Covers FR-003 to FR-005. Also run a short viewer check: show the page to two people who have not seen it and ask which items are edible and which are dangerous.

## 5. Verify configuration (manual)

1. Open `public/world/world.json` and change `"count": 300` for `tree` to `"count": 50`.
2. Reload the page. Expected: visibly fewer trees.
3. Restore `300` and reload. Expected: the original density is back.

Then check the error paths:

| Edit | Expected message in the error panel |
|------|-------------------------------------|
| Change `"version": 1` to `"version": 2` | `unsupported version 2; this app supports 1` |
| Change `"sprite": "tree"` to `"sprite": "treee"` in an object | `objects[N].sprite: unknown sprite "treee"` |
| Delete the file (or rename it) and reload | `Could not load world.json (HTTP 404)` |

In each error case, no world is drawn and the console shows the same message.

Covers FR-011, FR-014, FR-015, FR-017 and SC-005, SC-007.

## 6. Verify reproducibility (manual)

Load the page, note the layout of one area (for example, a lake and the apples next to it). Reload without changing anything. Expected: the same layout.

Covers FR-013 and SC-006.

## 7. Verify static delivery

Stop the server and confirm the app needs nothing else. Serve `public/` from any static host and open the page. Expected: the same behaviour, with no backend calls in the network panel other than requests for files under `public/`.

Covers FR-018 and SC-008.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Blank page, console says the module failed to load | Server was started from the repository root instead of `public/`. Paths in `index.html` are relative to `public/`. |
| Error panel says a sprite sheet is outside the image | A sheet rectangle in `world.json` does not match the image size. Check `x`, `y`, `w`, `h`. |
| Some objects are missing | The rule's `allowedTerrain` or `minSpacing` is too strict for the map. The console shows the shortfall. |
