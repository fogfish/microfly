# Quickstart: Odour Layer

**Feature**: [spec.md](spec.md) | **Contract**: [contracts/odour-layer.md](contracts/odour-layer.md)

## Prerequisites

- Node 20+ (for `npm test`)
- Python 3 (for the static server)
- An evergreen browser

## 1. Unit tests

```sh
npm test
```

Expected:
- every existing test still passes, including `body`, `determinism` and `fly-world`, which prove that
  `fruitIntensity` is unchanged
- the new `odour-field`, `heatmap` and `layers` tests pass (contract §3–§5)

## 2. Run the app

```sh
cd public && python3 -m http.server 8000
```

Open http://localhost:8000/ and keep the console open.

| # | Step | Expected | Covers |
|---|---|---|---|
| 1 | Load the page | No tint on the map. World tab shows a **Layers** box with `ODOUR [OFF]` above the fly list. No console errors. | FR-002, SC-001 |
| 2 | Press the ODOUR switch | Switch reads `ON` and is filled. A yellow→red heatmap appears around every flower, strongest on the flower and fading to nothing about 3 cells away. The legend appears. | US1, US2, FR-005, FR-006, FR-012 |
| 3 | Find two flowers close together | The area between them is redder than the same distance from a lone flower | US1 sc. 3 |
| 4 | Look at a fly crossing the tint | The fly is drawn above the tint. Terrain detail stays visible under the strongest red. | FR-001, FR-008 |
| 5 | Pan and zoom from min to max | The tint stays locked to the flowers. Its edge stays at the radius. Panning feels as smooth as with the layer off. | FR-009, FR-014, SC-005 |
| 6 | Select a fly, then move between World and Fly tabs | The switch keeps its state. On the Fly tab, the "Food odour" bar rises as the fly enters red areas. | SC-003 |
| 7 | Tab to the switch and press Space | The layer toggles. A screen reader announces "Odour layer, switch, on/off". | FR-003 |
| 8 | Press the switch again | Tint and legend disappear on the next frame | US2 sc. 3 |
| 9 | Reload | The layer is off again | FR-002 |
| 10 | Switch the OS to light and to dark theme | The tint is visible on the terrain in both. The legend colours follow. | FR-013 |

## 3. Simulation is unaffected (SC-006)

Run the headless experiment twice and compare. It does not import the layer modules, which
`tests/layers.test.mjs` also checks:

```sh
npm run experiment
```

The results are byte-identical to `main`.
