// Seeded value noise. The lattice is a fixed 256×256 table drawn from the
// PRNG at construction, so the same stream position gives the same noise.

const LATTICE = 256;

export function createValueNoise(prng, scale) {
  const lattice = new Float64Array(LATTICE * LATTICE);
  for (let i = 0; i < lattice.length; i++) {
    lattice[i] = prng.next();
  }

  const smooth = (t) => t * t * (3 - 2 * t);

  // Value in [0, 1) at cell coordinates (x, y)
  function sample(x, y) {
    const gx = x / scale;
    const gy = y / scale;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = smooth(gx - x0);
    const fy = smooth(gy - y0);

    const ix0 = ((x0 % LATTICE) + LATTICE) % LATTICE;
    const iy0 = ((y0 % LATTICE) + LATTICE) % LATTICE;
    const ix1 = (ix0 + 1) % LATTICE;
    const iy1 = (iy0 + 1) % LATTICE;

    const a = lattice[iy0 * LATTICE + ix0];
    const b = lattice[iy0 * LATTICE + ix1];
    const c = lattice[iy1 * LATTICE + ix0];
    const d = lattice[iy1 * LATTICE + ix1];

    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
    return top + (bottom - top) * fy;
  }

  return { sample };
}
