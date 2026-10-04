# Vendored: three.js

- Package: `three`
- Version: `0.160.0`
- Source: npm registry (`npm pack three@0.160.0`)
- Files copied from the package:
  - `build/three.module.min.js` → `three.module.min.js` (the minified ES module build; the non-minified `three.module.js` was not needed)
  - `examples/jsm/controls/OrbitControls.js` → `OrbitControls.js`
  - `LICENSE` → `LICENSE`
- Reason: the brain point-cloud inspector needs a 3D renderer and orbit controls. The library is vendored so the page runs offline with no CDN (constitution I; see `specs/004-brain-point-cloud-inspector/plan.md` Complexity Tracking).
- Module resolution: `public/brains/index.html` maps `three` to `three.module.min.js` and `three/addons/` to this folder through an import map.
