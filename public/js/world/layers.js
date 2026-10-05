// Visual layers over the world map (specs/007-odor-layer/contracts/odour-layer.md §5). Pure: no DOM.
// The state is in memory only and is not persisted. Nothing under fly/ or brain/ imports it (R7),
// so turning a layer on or off cannot change the simulation.

export const LAYERS = [{ id: 'odour', label: 'Odour' }];

// Every layer starts off (FR-002).
export function initialLayers() {
  return Object.fromEntries(LAYERS.map((l) => [l.id, false]));
}

// Returns a new state with layer id flipped. An unknown id returns a copy with the same values.
export function toggleLayer(state, id) {
  if (!LAYERS.some((l) => l.id === id)) return { ...state };
  return { ...state, [id]: !state[id] };
}
