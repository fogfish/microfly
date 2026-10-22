// Visual layers over the world map (specs/007-odor-layer/contracts/odour-layer.md §5, contracts/odour-layer-
// v2.md §1). Pure: no DOM. The state is in memory only and is not persisted. Nothing under fly/ or brain/
// imports it (R7), so turning a layer on or off cannot change the simulation.

export const LAYERS = [
  { id: 'odour-food', label: 'Food odour' },
  { id: 'odour-danger', label: 'Danger odour' },
  { id: 'odour-heat', label: 'Heat odour' },
  // ADR 012 R8 (contracts/world-config-v3-social.md): off on load like every other layer, but its switch row
  // is shown only when the world declares odour:conspecific (panel.js's view.available, main.js).
  { id: 'odour-conspecific', label: 'Conspecific odour' },
  { id: 'grid', label: 'Grid' },
];

// Every layer starts off (FR-002).
export function initialLayers() {
  return Object.fromEntries(LAYERS.map((l) => [l.id, false]));
}

// Returns a new state with layer id flipped. An unknown id returns a copy with the same values.
export function toggleLayer(state, id) {
  if (!LAYERS.some((l) => l.id === id)) return { ...state };
  return { ...state, [id]: !state[id] };
}
