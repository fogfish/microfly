# Contract Amendment: `noiseClassScale` (L13) on LIF core version 1 (`lif-v1.js`)

**Amends**: `specs/008-hungry-forager-brain/contracts/lif-v1.md`, the canonical LIF-v1 contract, updated in the same
change. **Motivated by**: the MB-brain recalibration of 2026-10-22. At `synapticScale` 15, bulk noise is what keeps
the central brain and the descending neurons active, but the same noise on Kenyon cells and the antennal lobe
drowns the sparse KC odour code that the regime gate (FR-006) needs. No setting of the existing parameters met both
(sweep record: `specs/019-mb-valence-learning/recalibration-active.md`). This is a **backward-compatible
addition**: the default is `null`, a no-op, so there is no version bump. G1 holds unconditionally.

## Parameter table addition

| Name              | Default | Meaning                                                                                  |
| ----------------- | ------- | ---------------------------------------------------------------------------------------- |
| `noiseClassScale` | `null`  | `{ "<class>": scale, ... }`. A non-input neuron of a named class gets noise half-width `noiseAmplitude × scale` in place of `noiseAmplitude × noiseBulkScale`. |

```json
{ "noiseAmplitude": 0.05, "noiseBulkScale": 4,
  "noiseClassScale": { "Kenyon_Cell": 0, "ALPN": 0, "ALLN": 0 } }
```

- Applied once in `createNetwork` while building the per-neuron noise half-widths (L7′). Neurons in
  `graph.inputNeurons` always keep the full `noiseAmplitude`, whatever their class.
- It does not change the PRNG stream: a draw is still made for every neuron every step, so the stream position
  never depends on the scales.
- Ignored when `noiseAmplitude` is 0.
- It needs `graph.neuronClass`, which `fly-brain-v1.js` passes from the manifest.

`resolveParams` rejects, naming the path:
- not a plain object: `'LIF parameter "noiseClassScale" must be null or an object'`;
- a scale that is not a finite number ≥ 0: `'LIF parameter "noiseClassScale.<class>" must be a number of 0 or more'`.

`createNetwork` rejects a class that no neuron has: `E-LIF-NOISE: class "<name>" is not in the snapshot`.

## Guarantees

- **G1 (unchanged).** With every default, `lif-v1.js` equals `lif-v0.js` bit for bit (`tests/lif-golden.test.mjs`).
- **G9 (new).** `noiseClassScale: null` gives spikes identical to the same parameters without the key
  (`tests/lif-noise-class.test.mjs`).

## Contract tests

`tests/lif-noise-class.test.mjs`, on a labelled synthetic fixture: G9; per-neuron half-widths for a declared class,
for an input neuron of a declared class, and for other neurons; determinism with the key set; each rejection above.
The world validator (`validate.js`) accepts the key as an object or `null` and defers its shape to `resolveParams`.
