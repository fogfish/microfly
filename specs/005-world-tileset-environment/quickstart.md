# Quickstart: Validate the Detailed World

Run these checks after implementation. Each step states the expected result.

## Prerequisites

- Repository checked out on branch `005-world-tileset-environment`.
- Python 3 available.
- A current evergreen browser.

## 1. Start the app

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/public/` (or the documented web root).

**Expected**: The world appears within 3 seconds. The browser console shows no errors.

## 2. Automated tests

```sh
node --test public/tests/*.test.js
```

**Expected**: All tests pass. They cover catalogue resolution, the logic grid (water blocked,
edibles and dangers not on water), the water field and shore decor (BUG-002), the scatter seed,
and version 2 validation.

## 3. Visual checks (map)

| Check | How | Expected |
|---|---|---|
| Sharp pixels | Zoom to min, default, max | No blur, even pixel squares. |
| No seams | Pan across grass | No lines between ground cells. |
| Water is static | Watch one pond for 30 s | The water does not move. |
| Water bodies | Survey the map | One lake and 2 to 3 ponds, all natural shapes of different size. |
| Shoreline | Follow every pond and lake edge (WATER-SPEC §8, BUG-002) | No straight waterline run longer than about 24 px and no square corner. A lush grass band of varying width with a ragged outer edge. An earth bank face with a dark line under it on north banks, a light rim on south banks. Dithered shallow steps. A reed bed, stone or tuft across the waterline every 60 to 100 px. Nothing in open water without a ripple ring. No sand, no raw tall-grass rectangles. |
| Plants and bushes | Look at open grass | At least three plant or bush kinds, in clusters and clearings. |
| Trees | Survey the map | Several single trees and at least two groves of 4 to 12. |
| Depth | Find overlapping trees | Lower trees cover upper ones. |

## 4. Visual checks (flies and stimuli)

| Check | How | Expected |
|---|---|---|
| Six flies | Count fly sprites | Six flies, all inside the world. |
| Edibles | Look for flowers | Flowers visible, not on water, in every part of the map (FR-032). |
| Dangers | Look for the spider stand-in and the lantern | Visible and distinct from scenery, in every part of the map. No campfire logs as a danger (BUG-003). |
| Flies visible | Fly near a tree or bush | The fly is drawn above scenery. |

## 5. Edit the world

1. Move one tree in `public/world/world.json` by changing its `x`.
2. Reload.

**Expected**: Only that tree moves. Undo the change; the world returns to its previous state.

## 6. Invalid definitions

Create each of these in a copy and reload:

| Change | Expected message |
|---|---|
| `"version": 1` | Says the version is not supported. |
| A sprite id that does not exist | Names the entry, e.g. `objects[3]`. |
| An edible placed on water | Names the entry and says it is on water. |
| A group with 3 trees | Says a group needs 4 to 12 trees. |

**Expected**: A clear message for each. No partial world is drawn.

## 7. Determinism

Load the page twice with the same definition.

**Expected**: The two worlds are identical, including scatter layouts.
