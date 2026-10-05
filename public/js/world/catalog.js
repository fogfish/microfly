// Atlas catalogue (assets/atlas/catalog.json, see OBJECTS.md). Sprites are indexed by id and by
// name. A name shared by several sprites is ambiguous and must be referred to by id.
// indexCatalog is pure. loadCatalog only adds the fetch.

// Returns { catalog, errors }. catalog: { atlases, sprites, lookup(ref) }.
// lookup(ref) returns { sprite } or { error }, where error is a message for the entry.
export function indexCatalog(json) {
  if (json === null || typeof json !== 'object' || !Array.isArray(json.sprites)) {
    return { catalog: null, errors: [{ path: 'atlas', message: 'art catalogue must have a "sprites" list' }] };
  }
  if (!Array.isArray(json.atlases) || json.atlases.length === 0) {
    return { catalog: null, errors: [{ path: 'atlas', message: 'art catalogue must list at least one atlas' }] };
  }

  const byId = new Map();
  const byName = new Map();
  for (const sprite of json.sprites) {
    if (typeof sprite?.id !== 'string' || !sprite.atlas) {
      return { catalog: null, errors: [{ path: 'atlas', message: 'art catalogue has a sprite without "id" or "atlas"' }] };
    }
    byId.set(sprite.id, sprite);
    const names = byName.get(sprite.name) ?? [];
    names.push(sprite);
    byName.set(sprite.name, names);
  }

  const lookup = (ref) => {
    if (typeof ref !== 'string' || ref === '') return { error: 'must be a sprite id or name' };
    if (byId.has(ref)) return { sprite: byId.get(ref) };
    const named = byName.get(ref);
    if (named === undefined) return { error: `unknown sprite "${ref}"` };
    if (named.length > 1) return { error: `"${ref}" is shared by ${named.length} sprites; use the id` };
    return { sprite: named[0] };
  };

  return { catalog: { atlases: json.atlases, sprites: byId, lookup }, errors: [] };
}

// Fetches and indexes the catalogue. url is the catalogue file (assets/atlas/catalog.json).
export async function loadCatalog(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    return { catalog: null, errors: [{ path: 'atlas', message: `Could not load the art catalogue (network error: ${e.message})` }] };
  }
  if (!response.ok) {
    return { catalog: null, errors: [{ path: 'atlas', message: `Could not load the art catalogue (HTTP ${response.status})` }] };
  }

  let json;
  try {
    json = await response.json();
  } catch (e) {
    return { catalog: null, errors: [{ path: 'atlas', message: `art catalogue is not valid JSON: ${e.message}` }] };
  }
  return indexCatalog(json);
}
