// Fetches and parses the world config. Returns { config } or { errors }.

const DEFAULT_WORLD = 'world/world.json';

export async function loadWorldConfig({ root, search = location.search }) {
  const path = new URLSearchParams(search).get('world') ?? DEFAULT_WORLD;

  let response;
  try {
    response = await fetch(new URL(path, root));
  } catch (e) {
    return { errors: [{ path, message: `Could not load world.json (network error: ${e.message})` }] };
  }
  if (!response.ok) {
    return { errors: [{ path, message: `Could not load world.json (HTTP ${response.status})` }] };
  }

  const text = await response.text();
  try {
    return { config: JSON.parse(text) };
  } catch (e) {
    return { errors: [{ path, message: `world.json is not valid JSON: ${e.message}` }] };
  }
}
